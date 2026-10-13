import type { LeadAnalysis } from '@leadpilot/shared';
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Lead } from '../db/schema.js';
import type { Crm, CrmSyncResult, DraftInput, InboundMessage, LeadAi, Mailer, Notifier } from './ports.js';

const usage = (model: string) => ({ model, inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0 });
const shortHash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 10);

/**
 * Keyword rules standing in for the model, so the pipeline runs offline and in tests. Not meant to be accurate.
 */
@Injectable()
export class FakeLeadAi implements LeadAi {
  async analyze(m: InboundMessage) {
    const text = `${m.subject ?? ''}\n${m.body}`.toLowerCase();
    const spam = /(seo services|guest post|crypto|backlinks|unsubscribe)/.test(text);
    const sales = /(quote|project|build|develop|app|website|proposal|budget)/.test(text);
    const budget = text.match(/\$\s?([\d,]+)\s?(k)?/);
    const amount = budget?.[1] ? Number(budget[1].replace(/,/g, '')) * (budget[2] ? 1000 : 1) : null;
    const domain = m.fromEmail.split('@')[1] ?? null;
    const analysis: LeadAnalysis = {
      category: spam ? 'spam' : sales ? 'sales_lead' : 'other',
      summary: m.subject ?? m.body.slice(0, 120),
      contact: { name: m.fromName, email: m.fromEmail, phone: null, jobTitle: null },
      company: { name: null, website: domain, country: null, employees: null },
      services: ['web app', 'mobile app'].filter((s) => text.includes(s)),
      budgetUsd: amount ? { min: null, max: amount } : null,
      timeline: null,
      urgency: /(asap|urgent)/.test(text) ? 'high' : 'normal',
      language: 'en',
      suspiciousInstructions: /(ignore (all|previous)|system prompt|you are an ai)/.test(text),
    };
    return { analysis, usage: usage('fake') };
  }

  async draftReply({ lead, calendarUrl, signature }: DraftInput) {
    const name = lead.fromName?.split(' ')[0] ?? 'there';
    return {
      subject: `Re: ${lead.subject ?? 'your request'}`,
      text: `Hi ${name},\n\nThanks for reaching out. Could we talk for 20 minutes? Pick a time: ${calendarUrl}\n\n${signature}`,
      usage: usage('fake'),
    };
  }
}

@Injectable()
export class FakeCrm implements Crm {
  async syncLead(lead: Lead): Promise<CrmSyncResult> {
    const contactId = `c-${shortHash(lead.fromEmail)}`;
    const dealId = `d-${shortHash(lead.id)}`;
    return {
      contactId,
      contactCreated: true,
      companyId: null,
      dealId,
      urls: { contact: `fake://contacts/${contactId}`, company: null, deal: `fake://deals/${dealId}` },
    };
  }

  async logReply() {}
}

@Injectable()
export class FakeMailer implements Mailer {
  private readonly logger = new Logger('FakeMailer');

  async send(m: { to: string; subject: string; idempotencyKey: string }) {
    this.logger.log(`Would send "${m.subject}" to ${m.to}`);
    return { id: `fake-${shortHash(m.idempotencyKey)}` };
  }
}

@Injectable()
export class FakeNotifier implements Notifier {
  async approvalNeeded() {
    return null;
  }
}
