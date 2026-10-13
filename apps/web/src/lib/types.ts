import type { LeadAnalysis, LeadSource, LeadStatus, ScoreReason, Icp } from '@leadpilot/shared';

/** A lead as the API returns it (dates are ISO strings) */
export interface Lead {
  id: string;
  source: LeadSource;
  externalId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  body: string;
  receivedAt: string;
  status: LeadStatus;
  analysis: LeadAnalysis | null;
  score: number | null;
  scoreReasons: ScoreReason[] | null;
  crmContactId: string | null;
  crmCompanyId: string | null;
  crmDealId: string | null;
  replySubject: string | null;
  draftReply: string | null;
  draftWarnings: string[] | null;
  repliedAt: string | null;
  error: string | null;
  failedStep: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadEvent {
  id: string;
  leadId: string;
  type: string;
  actor: 'system' | 'user' | 'llm' | 'crm' | 'mail' | 'slack';
  data: Record<string, unknown> | null;
  costUsd: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface QueueJob {
  id: string;
  step: string;
  leadId: string;
  attemptsMade: number;
  failedReason: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface QueueOverview {
  counts: Record<'active' | 'waiting' | 'delayed' | 'failed' | 'completed', number>;
  jobs: QueueJob[];
}

export interface WorkspaceSettings {
  icp: Icp;
  replySignature: string;
  calendarUrl: string;
}

export interface DemoSample {
  id: string;
  label: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  preview: string;
}
