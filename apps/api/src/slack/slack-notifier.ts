import type { LeadAnalysis } from '@leadpilot/shared';
import type { Lead } from '../db/schema.js';
import type { Notifier } from '../pipeline/ports.js';

export const APPROVE_ACTION = 'lead_approve';
export const REJECT_ACTION = 'lead_reject';

/** Posts "draft ready" to a Slack channel with Approve / Reject buttons and a link to the lead in the app */
export class SlackNotifier implements Notifier {
  constructor(
    private readonly token: string,
    private readonly channel: string,
    private readonly webUrl: string,
    private readonly http: typeof fetch = fetch,
  ) {}

  async approvalNeeded(lead: Lead, a: LeadAnalysis, score: number) {
    const who = [a.contact.name ?? lead.fromName ?? lead.fromEmail, a.company.name].filter(Boolean).join(', ');
    const budget = a.budgetUsd?.max ?? a.budgetUsd?.min;
    const facts = [
      `*Score* ${score}/100`,
      budget ? `*Budget* $${budget.toLocaleString('en-US')}` : null,
      a.company.country ? `*Country* ${a.company.country}` : null,
      a.timeline ? `*Timeline* ${a.timeline}` : null,
    ].filter(Boolean);
    const res = await this.http('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        channel: this.channel,
        text: `New lead from ${who}: reply draft waiting for approval`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `*New lead: ${escape(who)}*\n${escape(a.summary)}` } },
          { type: 'context', elements: [{ type: 'mrkdwn', text: facts.join('  ·  ') }] },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Draft reply*\n>${escape(lead.draftReply ?? '').replace(/\n/g, '\n>')}` },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                style: 'primary',
                text: { type: 'plain_text', text: 'Approve and send' },
                action_id: APPROVE_ACTION,
                value: lead.id,
              },
              {
                type: 'button',
                style: 'danger',
                text: { type: 'plain_text', text: 'Reject' },
                action_id: REJECT_ACTION,
                value: lead.id,
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Edit in LeadPilot' },
                url: `${this.webUrl}/leads/${lead.id}`,
              },
            ],
          },
        ],
      }),
    });
    const body = (await res.json()) as { ok: boolean; error?: string; ts?: string; channel?: string };
    if (!body.ok) throw new Error(`Slack chat.postMessage failed: ${body.error}`);
    return { ref: `${body.channel}/${body.ts}` };
  }
}

/** Slack mrkdwn needs &, < and > escaped */
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
