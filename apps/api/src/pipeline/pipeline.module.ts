import { BullModule } from '@nestjs/bullmq';
import { ClaudeLeadAi } from '../ai/claude-lead-ai.js';
import { env } from '../config/env.js';
import { Module } from '@nestjs/common';
import { LeadsService } from '../leads/leads.service.js';
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
    // Offline stand-ins until the HubSpot, mail and Slack adapters are configured
    { provide: CRM, useClass: FakeCrm },
    { provide: MAILER, useClass: FakeMailer },
    { provide: NOTIFIER, useClass: FakeNotifier },
  ],
  exports: [LeadsService, SettingsService, PipelineQueue, PipelineService],
})
export class PipelineModule {}
