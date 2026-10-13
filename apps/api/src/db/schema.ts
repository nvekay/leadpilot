import type { Icp, LeadAnalysis, ScoreReason } from '@leadpilot/shared';
import { LEAD_SOURCES, LEAD_STATUSES } from '@leadpilot/shared';
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const leadStatus = pgEnum('lead_status', LEAD_STATUSES);
export const leadSource = pgEnum('lead_source', LEAD_SOURCES);

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: leadSource('source').notNull(),
    // Message-ID of an email or the form's submission id: the same message arriving twice is one lead
    externalId: text('external_id').notNull(),
    fromEmail: text('from_email').notNull(),
    fromName: text('from_name'),
    subject: text('subject'),
    body: text('body').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    status: leadStatus('status').notNull().default('received'),
    analysis: jsonb('analysis').$type<LeadAnalysis>(),
    score: integer('score'),
    scoreReasons: jsonb('score_reasons').$type<ScoreReason[]>(),
    crmContactId: text('crm_contact_id'),
    crmCompanyId: text('crm_company_id'),
    crmDealId: text('crm_deal_id'),
    replySubject: text('reply_subject'),
    draftReply: text('draft_reply'),
    // Problems found in the draft by plain checks (missing booking link, foreign links, leaked addresses)
    draftWarnings: jsonb('draft_warnings').$type<string[]>(),
    repliedAt: timestamp('replied_at', { withTimezone: true }),
    error: text('error'),
    // Pipeline step that ran out of retries; Retry starts the lead again from there
    failedStep: text('failed_step'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (t) => [
    uniqueIndex('leads_source_external_id').on(t.source, t.externalId),
    index('leads_status_received').on(t.status, t.receivedAt),
  ],
);

/** Append-only history of a lead: one row per pipeline step, human action or external call */
export const leadEvents = pgTable(
  'lead_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    actor: text('actor').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>(),
    // LLM spend and latency, so the timeline shows what each lead cost
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('lead_events_lead_created').on(t.leadId, t.createdAt)],
);

/** One row of workspace settings (id is always 1) */
export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  icp: jsonb('icp').$type<Icp>().notNull(),
  replySignature: text('reply_signature').notNull(),
  calendarUrl: text('calendar_url').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type LeadEvent = typeof leadEvents.$inferSelect;
