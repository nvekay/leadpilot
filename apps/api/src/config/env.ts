import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  // Shared secret between the web app's server and this API; the browser never sees it
  API_INTERNAL_KEY: z.string().min(16),
  WEB_URL: z.url().default('http://localhost:3000'),
  // Secret in the inbound email webhook URL (?token=...); the endpoint is off without it
  INBOUND_WEBHOOK_TOKEN: z.string().min(16).optional(),
  // First retry delay of a failed pipeline step; doubles on each attempt (tests use a few ms)
  // Without a key the pipeline uses keyword rules instead of Claude (offline development)
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
  ANALYZE_MODEL: z.string().default('claude-haiku-5-5'),
  DRAFT_MODEL: z.string().default('claude-sonnet-5-5'),
  // HubSpot private app token (scopes: crm.objects.contacts/companies/deals read+write, crm.schemas.deals write)
  HUBSPOT_TOKEN: z.string().optional(),
  // Slack app: bot token with chat:write, the channel for approvals, and the signing secret for button clicks
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-').optional(),
  SLACK_CHANNEL_ID: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  // Outgoing replies through Resend; MAIL_REDIRECT_TO sends every reply to one address (the public demo)
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
  MAIL_FROM: z.string().default('Northwind Studio <onboarding@resend.dev>'),
  MAIL_REDIRECT_TO: z.email().optional(),
  // Caps on leads from the public website: per visitor per hour, and for everyone per day
  DEMO_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(10),
  DEMO_LIMIT_PER_DAY: z.coerce.number().int().positive().default(300),
  PIPELINE_RETRY_DELAY_MS: z.coerce.number().int().positive().default(5000),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated configuration; fails fast at startup with every missing variable listed */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
    cached = parsed.data;
  }
  return cached;
}
