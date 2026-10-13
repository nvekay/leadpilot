import type { LeadAnalysis } from '@leadpilot/shared';
import type { Lead } from '../db/schema.js';

/** What an LLM call cost; recorded on the lead's timeline */
export interface LlmUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface InboundMessage {
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  body: string;
}

export interface DraftInput {
  lead: Lead;
  analysis: LeadAnalysis;
  calendarUrl: string;
  signature: string;
}

/** The language model: turns a message into structured fields and writes the reply draft */
export interface LeadAi {
  analyze(message: InboundMessage): Promise<{ analysis: LeadAnalysis; usage: LlmUsage }>;
  draftReply(input: DraftInput): Promise<{ subject: string; text: string; usage: LlmUsage }>;
}

export interface CrmSyncResult {
  contactId: string;
  contactCreated: boolean;
  companyId: string | null;
  dealId: string;
  /** Links to the records in the CRM, shown on the timeline */
  urls: { contact: string; company: string | null; deal: string };
}

export interface Crm {
  /** Finds or creates the contact (by email) and company (by domain), then creates a deal for this lead */
  syncLead(lead: Lead, analysis: LeadAnalysis, score: number): Promise<CrmSyncResult>;
  /** Logs the sent reply on the deal */
  logReply(dealId: string, subject: string, text: string): Promise<void>;
}

export interface Mailer {
  send(message: { to: string; subject: string; text: string; idempotencyKey: string }): Promise<{ id: string }>;
}

/** Tells the team a draft is waiting (Slack message with Approve / Reject) */
export interface Notifier {
  approvalNeeded(lead: Lead, analysis: LeadAnalysis, score: number): Promise<{ ref: string } | null>;
}

export const LEAD_AI = Symbol('LEAD_AI');
export const CRM = Symbol('CRM');
export const MAILER = Symbol('MAILER');
export const NOTIFIER = Symbol('NOTIFIER');
