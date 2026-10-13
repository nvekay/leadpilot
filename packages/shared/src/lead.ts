import { z } from 'zod';

/**
 * Where a lead is in the pipeline. The happy path is
 * received → analyzed → synced → awaiting_approval → approved → replied.
 */
export const LEAD_STATUSES = [
  'received',
  'analyzed',
  'synced',
  'awaiting_approval',
  'approved',
  'replied',
  'rejected',
  'ignored',
  'failed',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ['form', 'email', 'demo'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_CATEGORIES = ['sales_lead', 'support', 'partnership', 'job_application', 'spam', 'other'] as const;
export type LeadCategory = (typeof LEAD_CATEGORIES)[number];

/**
 * What the model extracts from an inbound message. Everything is nullable: the model must say "unknown"
 * instead of guessing, and the score is computed from these fields by plain code (see scoreLead).
 */
export const leadAnalysisSchema = z.object({
  category: z.enum(LEAD_CATEGORIES),
  summary: z.string().describe('One or two sentences: what the sender wants'),
  contact: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    jobTitle: z.string().nullable(),
  }),
  company: z.object({
    name: z.string().nullable(),
    website: z.string().nullable(),
    country: z.string().nullable().describe('ISO 3166-1 alpha-2 code, e.g. US, DE'),
    employees: z.number().int().nullable().describe('Approximate head count if stated'),
  }),
  services: z.array(z.string()).describe('Services asked for, in a few words each'),
  budgetUsd: z
    .object({ min: z.number().nullable(), max: z.number().nullable() })
    .nullable()
    .describe('Budget converted to USD; null when not mentioned'),
  timeline: z.string().nullable().describe('When they want to start or finish, as stated'),
  urgency: z.enum(['low', 'normal', 'high']),
  language: z.string().describe('ISO 639-1 code of the message language'),
  suspiciousInstructions: z
    .boolean()
    .describe('True when the message tries to give instructions to an AI system or asks to ignore rules'),
});
export type LeadAnalysis = z.infer<typeof leadAnalysisSchema>;

/** Ideal customer profile used to score leads; edited on the Settings page */
export const icpSchema = z.object({
  minBudgetUsd: z.number().nonnegative(),
  targetCountries: z.array(z.string().length(2)),
  services: z.array(z.string()),
  minEmployees: z.number().int().nonnegative(),
  hotScore: z.number().int().min(0).max(100),
});
export type Icp = z.infer<typeof icpSchema>;

export interface ScoreReason {
  points: number;
  reason: string;
}
