import type { LeadAnalysis } from '@leadpilot/shared';
import type { Lead } from '../db/schema.js';
import type { Crm, CrmSyncResult } from '../pipeline/ports.js';

/** Deal property that ties a HubSpot deal to our lead, so a repeated sync finds the deal instead of creating another */
export const LEAD_ID_PROPERTY = 'leadpilot_lead_id';

/** Personal mailboxes: the domain says nothing about the sender's company */
const FREE_MAIL = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.de',
  'web.de',
  'mail.ru',
  'yandex.ru',
]);

// HubSpot-defined association type ids
const DEAL_TO_CONTACT = 3;
const DEAL_TO_COMPANY = 5;
const NOTE_TO_DEAL = 214;

export class HubSpotError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;
interface HubSpotObject {
  id: string;
  properties: Record<string, string | null>;
}

/**
 * HubSpot adapter over the REST API (private app token). Errors are thrown as they come (429 and 5xx included);
 * the queue retries the step with backoff.
 */
export class HubSpotCrm implements Crm {
  private portalId: string | undefined;

  constructor(
    private readonly token: string,
    private readonly http: Fetch = fetch,
    private readonly base = 'https://api.hubapi.com',
  ) {}

  async syncLead(lead: Lead, a: LeadAnalysis, score: number): Promise<CrmSyncResult> {
    const contact = await this.upsertContact(lead, a);
    const company = await this.findOrCreateCompany(lead, a);
    if (company) {
      await this.call('PUT', `/crm/v4/objects/contacts/${contact.id}/associations/default/companies/${company.id}`);
    }
    const dealId = await this.findOrCreateDeal(lead, a, score, contact.id, company?.id ?? null);
    const portal = await this.portal();
    const url = (type: string, id: string) => `https://app.hubspot.com/contacts/${portal}/record/${type}/${id}`;
    return {
      contactId: contact.id,
      contactCreated: contact.created,
      companyId: company?.id ?? null,
      dealId,
      urls: {
        contact: url('0-1', contact.id),
        company: company ? url('0-2', company.id) : null,
        deal: url('0-3', dealId),
      },
    };
  }

  async logReply(dealId: string, subject: string, text: string) {
    await this.call('POST', '/crm/v3/objects/notes', {
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: `Reply sent by LeadPilot\nSubject: ${subject}\n\n${text}`,
      },
      associations: [
        { to: { id: dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: NOTE_TO_DEAL }] },
      ],
    });
  }

  /** Creates the deal property LeadPilot uses; safe to run more than once */
  async setup() {
    const exists = await this.call('GET', `/crm/v3/properties/deals/${LEAD_ID_PROPERTY}`, undefined, [404]);
    if (exists) return false;
    await this.call('POST', '/crm/v3/properties/deals', {
      name: LEAD_ID_PROPERTY,
      label: 'LeadPilot lead ID',
      type: 'string',
      fieldType: 'text',
      groupName: 'dealinformation',
      description: 'Set by LeadPilot; links the deal to the lead it came from',
    });
    return true;
  }

  private async upsertContact(lead: Lead, a: LeadAnalysis) {
    const [first, ...rest] = (a.contact.name ?? lead.fromName ?? '').trim().split(/\s+/);
    const properties = compact({
      email: lead.fromEmail,
      firstname: first || undefined,
      lastname: rest.join(' ') || undefined,
      jobtitle: a.contact.jobTitle,
      phone: a.contact.phone,
      company: a.company.name,
    });
    const found = await this.searchOne('contacts', 'email', lead.fromEmail);
    if (found) {
      // Only fill gaps; never overwrite what the sales team entered
      const missing = Object.fromEntries(Object.entries(properties).filter(([k]) => !found.properties[k]));
      if (Object.keys(missing).length)
        await this.call('PATCH', `/crm/v3/objects/contacts/${found.id}`, { properties: missing });
      return { id: found.id, created: false };
    }
    const created = await this.call<HubSpotObject>('POST', '/crm/v3/objects/contacts', {
      properties: { ...properties, lifecyclestage: 'lead' },
    });
    return { id: created!.id, created: true };
  }

  private async findOrCreateCompany(lead: Lead, a: LeadAnalysis) {
    const domain = companyDomain(lead.fromEmail, a.company.website);
    if (!domain) return null;
    const found = await this.searchOne('companies', 'domain', domain);
    if (found) return found;
    return this.call<HubSpotObject>('POST', '/crm/v3/objects/companies', {
      properties: compact({
        domain,
        name: a.company.name ?? domain,
        country: a.company.country,
        numberofemployees: a.company.employees?.toString(),
      }),
    });
  }

  private async findOrCreateDeal(
    lead: Lead,
    a: LeadAnalysis,
    score: number,
    contactId: string,
    companyId: string | null,
  ) {
    const found = await this.searchOne('deals', LEAD_ID_PROPERTY, lead.id);
    if (found) return found.id;
    const budget = a.budgetUsd?.max ?? a.budgetUsd?.min ?? null;
    const who = a.company.name ?? a.contact.name ?? lead.fromEmail;
    const deal = await this.call<HubSpotObject>('POST', '/crm/v3/objects/deals', {
      properties: compact({
        dealname: `${who}: ${a.services[0] ?? 'new inquiry'}`.slice(0, 250),
        pipeline: 'default',
        dealstage: 'appointmentscheduled',
        amount: budget?.toString(),
        description: `${a.summary}\n\nLeadPilot score: ${score}/100${a.timeline ? `\nTimeline: ${a.timeline}` : ''}`,
        [LEAD_ID_PROPERTY]: lead.id,
      }),
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: DEAL_TO_CONTACT }],
        },
        ...(companyId
          ? [
              {
                to: { id: companyId },
                types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: DEAL_TO_COMPANY }],
              },
            ]
          : []),
      ],
    });
    return deal!.id;
  }

  private async searchOne(object: string, property: string, value: string) {
    const res = await this.call<{ results: HubSpotObject[] }>('POST', `/crm/v3/objects/${object}/search`, {
      filterGroups: [{ filters: [{ propertyName: property, operator: 'EQ', value }] }],
      properties: ['email', 'firstname', 'lastname', 'jobtitle', 'phone', 'company', 'domain', 'name'],
      limit: 1,
    });
    return res?.results[0] ?? null;
  }

  private async portal() {
    this.portalId ??= String((await this.call<{ portalId: number }>('GET', '/account-info/v3/details'))!.portalId);
    return this.portalId;
  }

  /** Returns null for statuses listed in `allow` (e.g. 404 on a lookup) and throws on any other failure */
  private async call<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    allow: number[] = [],
  ): Promise<T | null> {
    const res = await this.http(`${this.base}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (allow.includes(res.status)) return null;
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new HubSpotError(
        res.status,
        `HubSpot ${method} ${path.split('?')[0]} failed: ${res.status} ${detail.slice(0, 300)}`,
      );
    }
    return res.status === 204 ? null : ((await res.json()) as T);
  }
}

/** Company domain from the website or the sender's address; null for personal mailboxes */
export function companyDomain(email: string, website: string | null): string | null {
  const fromSite = website
    ?.replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split(/[/?#]/)[0]
    ?.toLowerCase();
  const domain = fromSite || email.split('@')[1]?.toLowerCase() || null;
  return domain && !FREE_MAIL.has(domain) ? domain : null;
}

const compact = (o: Record<string, string | null | undefined>) =>
  Object.fromEntries(Object.entries(o).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''));
