import { BullModule, InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { and, inArray, lt, notLike } from 'drizzle-orm';
import { type Db, InjectDb } from '../db/db.module.js';
import { leads } from '../db/schema.js';
import { PipelineModule } from '../pipeline/pipeline.module.js';
import { DemoSeeder, SEED_PREFIX } from './demo-seeder.js';

export const MAINTENANCE_QUEUE = 'maintenance';
/** Leads from the public website are kept this long; the seeded examples stay */
export const DEMO_RETENTION_HOURS = 72;

@Injectable()
export class MaintenanceService {
  constructor(@InjectDb() private readonly db: Db) {}

  /** Deletes visitors' demo and form leads older than the retention window (events go with them) */
  async cleanupDemoLeads(now = new Date()) {
    const cutoff = new Date(now.getTime() - DEMO_RETENTION_HOURS * 3600_000);
    const deleted = await this.db
      .delete(leads)
      .where(
        and(
          inArray(leads.source, ['demo', 'form']),
          lt(leads.receivedAt, cutoff),
          notLike(leads.externalId, `${SEED_PREFIX}%`),
        ),
      )
      .returning({ id: leads.id });
    return deleted.length;
  }
}

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger('Maintenance');

  constructor(private readonly maintenance: MaintenanceService) {
    super();
  }

  async process() {
    const n = await this.maintenance.cleanupDemoLeads();
    this.logger.log(`Removed ${n} old demo leads`);
    return { removed: n };
  }
}

/** Registers the daily cleanup; upserting keeps one schedule however many instances start */
@Injectable()
export class MaintenanceScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap() {
    await this.queue.upsertJobScheduler('cleanup-demo-leads', { pattern: '0 3 * * *' }, { name: 'cleanup' });
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: MAINTENANCE_QUEUE }), PipelineModule],
  providers: [MaintenanceService, MaintenanceProcessor, MaintenanceScheduler, DemoSeeder],
  exports: [MaintenanceService, DemoSeeder],
})
export class MaintenanceModule {}
