import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { env } from '../config/env.js';
import { DEMO_MESSAGES } from '../intake/demo-messages.js';
import { LeadsService } from '../leads/leads.service.js';
import { PipelineQueue } from '../pipeline/pipeline.queue.js';

export const SEED_PREFIX = 'seed-';

/**
 * Puts the sample emails into the inbox as permanent examples, so the public demo is never empty. Each sample has a
 * fixed id, so running this on every start stores and processes it only once.
 */
@Injectable()
export class DemoSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoSeeder.name);

  constructor(
    private readonly leads: LeadsService,
    private readonly queue: PipelineQueue,
  ) {}

  async onApplicationBootstrap() {
    if (env().SEED_DEMO) await this.seed();
  }

  async seed() {
    let added = 0;
    for (const m of DEMO_MESSAGES) {
      const { lead, duplicate } = await this.leads.ingest({
        source: 'demo',
        externalId: `${SEED_PREFIX}${m.id}`,
        fromEmail: m.fromEmail,
        fromName: m.fromName,
        subject: m.subject,
        body: m.body,
      });
      if (!duplicate) added++;
      if (lead.status === 'received') await this.queue.enqueue('analyze', lead.id);
    }
    if (added) this.logger.log(`Seeded ${added} sample leads`);
    return added;
  }
}
