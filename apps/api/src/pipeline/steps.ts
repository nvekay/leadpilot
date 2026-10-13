import type { LeadStatus } from '@leadpilot/shared';

/** Pipeline steps in order; each is one BullMQ job per lead */
export const STEPS = ['analyze', 'crm-sync', 'draft', 'notify', 'send'] as const;
export type Step = (typeof STEPS)[number];

/** The status a lead must be in for a step to run; Retry puts a failed lead back into it */
export const STEP_PRECONDITION: Record<Step, LeadStatus> = {
  analyze: 'received',
  'crm-sync': 'analyzed',
  draft: 'synced',
  notify: 'awaiting_approval',
  send: 'approved',
};

/** One job per step and lead: enqueueing the same step twice is a no-op in BullMQ */
export const jobId = (step: Step, leadId: string) => `${step}-${leadId}`;

export const QUEUE = 'lead-pipeline';

export interface StepJob {
  leadId: string;
}
