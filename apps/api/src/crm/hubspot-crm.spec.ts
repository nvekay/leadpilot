import type { LeadAnalysis } from '@leadpilot/shared';
import type { Lead } from '../db/schema.js';
import { companyDomain, HubSpotCrm, HubSpotError, LEAD_ID_PROPERTY } from './hubspot-crm.js';

/** A tiny in-memory HubSpot: enough of the CRM API to check what the adapter sends */
function fakeHubSpot(searchSpacingMs = 0) {
  type Stored = { id: string; properties: Record<string, string>; associations?: unknown };
  const store: Record<'contacts' | 'companies' | 'deals' | 'notes', Stored[]> = {
    contacts: [],
    companies: [],
    deals: [],
    notes: [],
  };
  const calls: string[] = [];
  const searchTimes: number[] = [];
  let nextId = 100;
  let failWith: number | null = null;

  const fetchImpl = async (url: string, init?: RequestInit) => {
    const path = url.replace('https://api.hubapi.com', '');
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${path}`);
    if (path.endsWith('/search')) searchTimes.push(Date.now());
    if (failWith) return new Response('{"message":"rate limited"}', { status: failWith });
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

    if (path === '/account-info/v3/details') return json({ portalId: 4242 });
    const search = path.match(/^\/crm\/v3\/objects\/(\w+)\/search$/);
    if (search) {
      const f = body.filterGroups[0].filters[0];
      return json({
        results: store[search[1] as keyof typeof store].filter((o) => o.properties[f.propertyName] === f.value),
      });
    }
    const create = path.match(/^\/crm\/v3\/objects\/(\w+)$/);
    if (create && method === 'POST') {
      const obj = { id: String(nextId++), properties: body.properties, associations: body.associations };
      store[create[1] as keyof typeof store].push(obj);
      return json(obj, 201);
    }
    const patch = path.match(/^\/crm\/v3\/objects\/(\w+)\/(\d+)$/);
    if (patch && method === 'PATCH') {
      const obj = store[patch[1] as keyof typeof store].find((o) => o.id === patch[2])!;
      Object.assign(obj.properties, body.properties);
      return json(obj);
    }
    if (path.startsWith('/crm/v4/objects/contacts/')) return json({});
    if (path === `/crm/v3/properties/deals/${LEAD_ID_PROPERTY}`) return json({}, 404);
    if (path === '/crm/v3/properties/deals') return json({}, 201);
    return json({ message: `unexpected ${method} ${path}` }, 500);
  };

  return {
    store,
    calls,
    searchTimes,
    fail: (status: number | null) => (failWith = status),
    crm: new HubSpotCrm('pat-test', fetchImpl as unknown as typeof fetch, undefined, searchSpacingMs),
  };
}

const lead = (overrides: Partial<Lead> = {}) =>
  ({
    id: '11111111-1111-1111-1111-111111111111',
    fromEmail: 'rachel.moore@brightlane.example',
    fromName: 'Rachel Moore',
    ...overrides,
  }) as Lead;

const analysis = (overrides: Partial<LeadAnalysis> = {}): LeadAnalysis => ({
  category: 'sales_lead',
  summary: 'Customer analytics dashboard inside their SaaS.',
  contact: { name: 'Rachel Moore', email: 'rachel.moore@brightlane.example', phone: null, jobTitle: 'Head of Product' },
  company: { name: 'Brightlane', website: 'https://www.brightlane.example/about', country: 'US', employees: 60 },
  services: ['Dashboard'],
  budgetUsd: { min: 35000, max: 40000 },
  timeline: 'Launch by end of Q1',
  urgency: 'normal',
  language: 'en',
  suspiciousInstructions: false,
  ...overrides,
});

describe('HubSpotCrm', () => {
  it('creates contact, company and deal, linked together, and returns record links', async () => {
    const h = fakeHubSpot();
    const result = await h.crm.syncLead(lead(), analysis(), 85);

    expect(h.store.contacts[0]!.properties).toEqual({
      email: 'rachel.moore@brightlane.example',
      firstname: 'Rachel',
      lastname: 'Moore',
      jobtitle: 'Head of Product',
      company: 'Brightlane',
      lifecyclestage: 'lead',
    });
    expect(h.store.companies[0]!.properties).toMatchObject({
      domain: 'brightlane.example',
      name: 'Brightlane',
      country: 'US',
    });
    const deal = h.store.deals[0]!;
    expect(deal.properties).toMatchObject({
      dealname: 'Brightlane: Dashboard',
      amount: '40000',
      [LEAD_ID_PROPERTY]: '11111111-1111-1111-1111-111111111111',
    });
    expect(deal.properties.description).toContain('LeadPilot score: 85/100');
    expect(JSON.stringify(deal.associations)).toContain(`"id":"${result.contactId}"`);
    expect(JSON.stringify(deal.associations)).toContain(`"id":"${result.companyId}"`);
    expect(result).toMatchObject({
      contactCreated: true,
      urls: { deal: `https://app.hubspot.com/contacts/4242/record/0-3/${result.dealId}` },
    });
  });

  it('reuses an existing contact and only fills empty fields', async () => {
    const h = fakeHubSpot();
    h.store.contacts.push({
      id: '7',
      properties: { email: 'rachel.moore@brightlane.example', firstname: 'Rach', jobtitle: '' },
    });
    const result = await h.crm.syncLead(lead(), analysis(), 85);
    expect(result).toMatchObject({ contactId: '7', contactCreated: false });
    expect(h.store.contacts).toHaveLength(1);
    // The name a sales rep typed stays; the missing job title is filled in
    expect(h.store.contacts[0]!.properties).toMatchObject({
      firstname: 'Rach',
      jobtitle: 'Head of Product',
      lastname: 'Moore',
    });
  });

  it('does not create a second deal when the step runs again', async () => {
    const h = fakeHubSpot();
    const first = await h.crm.syncLead(lead(), analysis(), 85);
    const second = await h.crm.syncLead(lead(), analysis(), 85);
    expect(second.dealId).toBe(first.dealId);
    expect(h.store.deals).toHaveLength(1);
    expect(h.store.companies).toHaveLength(1);
  });

  it('skips the company for personal mailboxes', async () => {
    const h = fakeHubSpot();
    const result = await h.crm.syncLead(
      lead({ fromEmail: 'arjun.mehta@gmail.com' }),
      analysis({ company: { name: null, website: null, country: 'IN', employees: null } }),
      40,
    );
    expect(result.companyId).toBeNull();
    expect(h.store.companies).toHaveLength(0);
    expect(h.store.deals[0]!.properties.dealname).toBe('Rachel Moore: Dashboard');
  });

  it('surfaces rate limits as errors so the queue retries the step', async () => {
    const h = fakeHubSpot();
    h.fail(429);
    await expect(h.crm.syncLead(lead(), analysis(), 85)).rejects.toBeInstanceOf(HubSpotError);
  });

  it('spaces out searches so parallel syncs stay under the per-second limit', async () => {
    const h = fakeHubSpot(40);
    await Promise.all([
      h.crm.syncLead(lead(), analysis(), 85),
      h.crm.syncLead(
        lead({ id: '22222222-2222-2222-2222-222222222222', fromEmail: 'ann@other.example' }),
        analysis(),
        50,
      ),
    ]);
    const n = h.searchTimes.length;
    expect(n).toBeGreaterThanOrEqual(6);
    // Timers jitter by a few ms, so check the total spread rather than each gap
    const spread = h.searchTimes[n - 1]! - h.searchTimes[0]!;
    expect(spread).toBeGreaterThanOrEqual((n - 1) * 40 - 20);
  });

  it('creates the custom deal property once', async () => {
    const h = fakeHubSpot();
    expect(await h.crm.setup()).toBe(true);
    expect(h.calls).toContain('POST /crm/v3/properties/deals');
  });
});

describe('companyDomain', () => {
  it.each([
    ['ann@acme.com', null, 'acme.com'],
    ['ann@acme.com', 'https://www.acme.io/en', 'acme.io'],
    ['ann@gmail.com', null, null],
    ['ann@gmail.com', 'acme.io', 'acme.io'],
  ])('%s with website %s gives %s', (email, website, expected) => {
    expect(companyDomain(email, website)).toBe(expected);
  });
});
