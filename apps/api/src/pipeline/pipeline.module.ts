import { BullModule } from '@nestjs/bullmq';
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
    // Offline stand-ins until the real Claude, HubSpot, mail and Slack adapters are configured
    { provide: LEAD_AI, useClass: FakeLeadAi },
    { provide: CRM, useClass: FakeCrm },
    { provide: MAILER, useClass: FakeMailer },
    { provide: NOTIFIER, useClass: FakeNotifier },
  ],
  exports: [LeadsService, SettingsService, PipelineQueue, PipelineService],
})
export class PipelineModule {}
