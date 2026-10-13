import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ClaudeLeadAi } from '../ai/claude-lead-ai.js';
import { env } from '../config/env.js';
import { HubSpotCrm } from '../crm/hubspot-crm.js';
import { ResendMailer } from '../mail/resend-mailer.js';
import { SlackNotifier } from '../slack/slack-notifier.js';
import { LeadsService } from '../leads/leads.service.js';
import { RateLimitService } from '../limits/rate-limit.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { FakeCrm, FakeLeadAi, FakeMailer, FakeNotifier } from './fakes.js';
import { PipelineProcessor } from './pipeline.processor.js';
import { PipelineQueue } from './pipeline.queue.js';
import { PipelineService } from './pipeline.service.js';
import { CRM, LEAD_AI, MAILER, NOTIFIER } from './ports.js';
import { QUEUE } from './steps.js';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE })],
  providers: [
    LeadsService,
    SettingsService,
    PipelineQueue,
    PipelineService,
    PipelineProcessor,
    RateLimitService,
    {
      provide: LEAD_AI,
      // Keyword rules stand in for Claude when no API key is set (offline development, CI)
      useFactory: () => {
        const e = env();
        return e.ANTHROPIC_API_KEY
          ? new ClaudeLeadAi(e.ANTHROPIC_API_KEY, { analyze: e.ANALYZE_MODEL, draft: e.DRAFT_MODEL })
          : new FakeLeadAi();
      },
    },
    // Each integration falls back to an offline stand-in until its credentials are set
    {
      provide: CRM,
      useFactory: () => (env().HUBSPOT_TOKEN ? new HubSpotCrm(env().HUBSPOT_TOKEN!) : new FakeCrm()),
    },
    {
      provide: MAILER,
      useFactory: () => {
        const e = env();
        return e.RESEND_API_KEY
          ? new ResendMailer(e.RESEND_API_KEY, e.MAIL_FROM, e.MAIL_REDIRECT_TO)
          : new FakeMailer();
      },
    },
    {
      provide: NOTIFIER,
      useFactory: () => {
        const e = env();
        return e.SLACK_BOT_TOKEN && e.SLACK_CHANNEL_ID
          ? new SlackNotifier(e.SLACK_BOT_TOKEN, e.SLACK_CHANNEL_ID, e.WEB_URL)
          : new FakeNotifier();
      },
    },
  ],
  exports: [LeadsService, SettingsService, PipelineQueue, PipelineService, RateLimitService],
})
export class PipelineModule {}
