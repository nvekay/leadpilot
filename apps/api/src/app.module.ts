import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InternalKeyGuard } from './common/internal-key.guard.js';
import { env } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { IntakeController } from './intake/intake.controller.js';
import { LeadsController } from './leads/leads.controller.js';
import { PipelineModule } from './pipeline/pipeline.module.js';
import { QueueController } from './queue/queue.controller.js';
import { SettingsController } from './settings/settings.controller.js';

@Module({
  imports: [
    DbModule,
    BullModule.forRootAsync({ useFactory: () => ({ connection: { url: env().REDIS_URL } }) }),
    PipelineModule,
  ],
  controllers: [HealthController, IntakeController, LeadsController, QueueController, SettingsController],
  providers: [{ provide: APP_GUARD, useClass: InternalKeyGuard }],
})
export class AppModule {}
