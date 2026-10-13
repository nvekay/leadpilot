import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PipelineService } from './pipeline.service.js';
import { QUEUE, type Step, STEPS, type StepJob } from './steps.js';

@Processor(QUEUE, { concurrency: 5 })
export class PipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(PipelineProcessor.name);

  constructor(private readonly pipeline: PipelineService) {
    super();
  }

  async process(job: Job<StepJob>) {
    const step = job.name as Step;
    if (!STEPS.includes(step)) throw new Error(`Unknown step ${job.name}`);
    return this.pipeline.run(step, job.data.leadId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<StepJob> | undefined, error: Error) {
    if (!job) return;
    const outOfAttempts = job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.warn(`${job.name} for ${job.data.leadId} failed (attempt ${job.attemptsMade}): ${error.message}`);
    if (outOfAttempts) await this.pipeline.markFailed(job.data.leadId, job.name as Step, error.message);
  }
}
