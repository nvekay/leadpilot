import { Controller, Get } from '@nestjs/common';
import { PipelineQueue } from '../pipeline/pipeline.queue.js';

@Controller('queue')
export class QueueController {
  constructor(private readonly queue: PipelineQueue) {}

  /** Job counts and the latest jobs, failed ones included (the dead-letter view) */
  @Get()
  async overview() {
    const [counts, jobs] = await Promise.all([
      this.queue.counts(),
      this.queue.jobs(['active', 'waiting', 'delayed', 'failed', 'completed'], 50),
    ]);
    return {
      counts,
      jobs: jobs
        .filter((j) => j !== undefined)
        .map((j) => ({
          id: j.id,
          step: j.name,
          leadId: j.data.leadId,
          attemptsMade: j.attemptsMade,
          failedReason: j.failedReason || null,
          createdAt: new Date(j.timestamp).toISOString(),
          finishedAt: j.finishedOn ? new Date(j.finishedOn).toISOString() : null,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }
}
