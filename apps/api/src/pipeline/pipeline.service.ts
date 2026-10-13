import { checkDraft, scoreLead } from '@leadpilot/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Lead } from '../db/schema.js';
import { LeadsService } from '../leads/leads.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { PipelineQueue } from './pipeline.queue.js';
import { CRM, type Crm, LEAD_AI, type LeadAi, MAILER, type Mailer, NOTIFIER, type Notifier } from './ports.js';
import { STEP_PRECONDITION, type Step } from './steps.js';

export type StepOutcome = 'done' | 'skipped';

/**
 * The lead pipeline, one method per step. Each step first checks the lead is in the status it expects and moves it
 * on with a conditional update, so a job that runs twice (retry after a crash, duplicate delivery) does nothing the
 * second time. Side effects in other systems use idempotency keys or lookups for the same reason.
 */
@Injectable()
export class PipelineService {
  constructor(
    private readonly leads: LeadsService,
    private readonly settings: SettingsService,
    private readonly queue: PipelineQueue,
    @Inject(LEAD_AI) private readonly ai: LeadAi,
    @Inject(CRM) private readonly crm: Crm,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) {}

  run(step: Step, leadId: string): Promise<StepOutcome> {
    switch (step) {
      case 'analyze':
        return this.analyze(leadId);
      case 'crm-sync':
        return this.crmSync(leadId);
      case 'draft':
        return this.draft(leadId);
      case 'notify':
        return this.notify(leadId);
      case 'send':
        return this.send(leadId);
    }
  }

  /** Reads the message with the model, then scores it with plain rules */
  async analyze(leadId: string): Promise<StepOutcome> {
    const lead = await this.ready(leadId, 'analyze');
    if (!lead) return 'skipped';
    const { analysis, usage } = await this.ai.analyze({
      fromEmail: lead.fromEmail,
      fromName: lead.fromName,
      subject: lead.subject,
      body: lead.body,
    });
    const { icp } = await this.settings.get();
    const { score, reasons } = scoreLead(analysis, icp);
    const next = analysis.category === 'sales_lead' ? 'analyzed' : 'ignored';
    const moved = await this.leads.transition(leadId, 'received', next, {
      analysis,
      score,
      scoreReasons: reasons,
      error: null,
    });
    if (!moved) return 'skipped';
    await this.leads.event(leadId, {
      type: 'analyzed',
      actor: 'llm',
      data: { category: analysis.category, score, model: usage.model, tokens: usage.inputTokens + usage.outputTokens },
      costUsd: usage.costUsd,
      durationMs: usage.durationMs,
    });
    if (next === 'analyzed') await this.queue.enqueue('crm-sync', leadId);
    return 'done';
  }

  async crmSync(leadId: string): Promise<StepOutcome> {
    const lead = await this.ready(leadId, 'crm-sync');
    if (!lead?.analysis) return 'skipped';
    const started = Date.now();
    const result = await this.crm.syncLead(lead, lead.analysis, lead.score ?? 0);
    const moved = await this.leads.transition(leadId, 'analyzed', 'synced', {
      crmContactId: result.contactId,
      crmCompanyId: result.companyId,
      crmDealId: result.dealId,
    });
    if (!moved) return 'skipped';
    await this.leads.event(leadId, {
      type: 'crm_synced',
      actor: 'crm',
      data: { contactCreated: result.contactCreated, ...result.urls },
      durationMs: Date.now() - started,
    });
    await this.queue.enqueue('draft', leadId);
    return 'done';
  }

  async draft(leadId: string): Promise<StepOutcome> {
    const lead = await this.ready(leadId, 'draft');
    if (!lead?.analysis) return 'skipped';
    const { calendarUrl, replySignature } = await this.settings.get();
    const draft = await this.ai.draftReply({
      lead,
      analysis: lead.analysis,
      calendarUrl,
      signature: replySignature,
    });
    const warnings = checkDraft(draft.text, { calendarUrl, senderEmail: lead.fromEmail });
    const moved = await this.leads.transition(leadId, 'synced', 'awaiting_approval', {
      replySubject: draft.subject,
      draftReply: draft.text,
      draftWarnings: warnings,
    });
    if (!moved) return 'skipped';
    await this.leads.event(leadId, {
      type: 'draft_ready',
      actor: 'llm',
      data: { model: draft.usage.model, tokens: draft.usage.inputTokens + draft.usage.outputTokens, warnings },
      costUsd: draft.usage.costUsd,
      durationMs: draft.usage.durationMs,
    });
    await this.queue.enqueue('notify', leadId);
    return 'done';
  }

  /** Posts the approval request; the lead stays awaiting approval whether or not this works */
  async notify(leadId: string): Promise<StepOutcome> {
    const lead = await this.ready(leadId, 'notify');
    if (!lead?.analysis) return 'skipped';
    const posted = await this.notifier.approvalNeeded(lead, lead.analysis, lead.score ?? 0);
    if (posted) await this.leads.event(leadId, { type: 'approval_requested', actor: 'slack', data: posted });
    return 'done';
  }

  async send(leadId: string): Promise<StepOutcome> {
    const lead = await this.ready(leadId, 'send');
    if (!lead?.draftReply || !lead.replySubject) return 'skipped';
    const sent = await this.mailer.send({
      to: lead.fromEmail,
      subject: lead.replySubject,
      text: lead.draftReply,
      // The provider drops a second send with the same key, so a retry after a timeout cannot email twice
      idempotencyKey: `reply-${lead.id}`,
    });
    if (lead.crmDealId) await this.crm.logReply(lead.crmDealId, lead.replySubject, lead.draftReply);
    const moved = await this.leads.transition(leadId, 'approved', 'replied', { repliedAt: new Date() });
    if (!moved) return 'skipped';
    await this.leads.event(leadId, { type: 'reply_sent', actor: 'mail', data: { messageId: sent.id } });
    return 'done';
  }

  /** A person approves the draft (optionally edited) in the app or in Slack */
  async approve(leadId: string, by: string, editedText?: string): Promise<Lead | null> {
    const current = await this.leads.get(leadId);
    const text = editedText?.trim();
    // The web app always sends the text box; it only counts as an edit when it differs from the draft
    const edited = Boolean(text && current?.draftReply && text !== current.draftReply.trim());
    const lead = await this.leads.transition(
      leadId,
      'awaiting_approval',
      'approved',
      edited ? { draftReply: text } : {},
    );
    if (!lead) return null;
    await this.leads.event(leadId, { type: 'approved', actor: 'user', data: { by, edited } });
    await this.queue.enqueue('send', leadId);
    return lead;
  }

  async reject(leadId: string, by: string, reason?: string): Promise<Lead | null> {
    const lead = await this.leads.transition(leadId, 'awaiting_approval', 'rejected');
    if (!lead) return null;
    await this.leads.event(leadId, { type: 'rejected', actor: 'user', data: { by, reason } });
    return lead;
  }

  /** Called when a step has used all its attempts */
  async markFailed(leadId: string, step: Step, error: string) {
    if (step === 'notify') {
      // A missed Slack message does not block the lead; it can still be approved in the app
      await this.leads.event(leadId, { type: 'approval_request_failed', actor: 'slack', data: { error } });
      return;
    }
    const lead = await this.leads.transition(leadId, STEP_PRECONDITION[step], 'failed', { error, failedStep: step });
    if (lead) await this.leads.event(leadId, { type: 'step_failed', actor: 'system', data: { step, error } });
  }

  /** Puts a failed lead back where its failed step starts and runs that step again */
  async retry(leadId: string, by: string): Promise<Lead | null> {
    const current = await this.leads.get(leadId);
    const step = current?.failedStep as Step | null | undefined;
    if (!current || current.status !== 'failed' || !step) return null;
    const lead = await this.leads.transition(leadId, 'failed', STEP_PRECONDITION[step], {
      error: null,
      failedStep: null,
    });
    if (!lead) return null;
    await this.leads.event(leadId, { type: 'retried', actor: 'user', data: { by, step } });
    await this.queue.retry(step, leadId);
    return lead;
  }

  private async ready(leadId: string, step: Step) {
    const lead = await this.leads.get(leadId);
    return lead?.status === STEP_PRECONDITION[step] ? lead : null;
  }
}
