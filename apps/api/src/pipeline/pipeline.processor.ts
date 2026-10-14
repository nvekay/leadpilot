import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';
import { isPermanent } from './errors.js';
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
    if (!STEPS.includes(step)) throw new UnrecoverableError(`Unknown step ${job.name}`);
    try {
      return await this.pipeline.run(step, job.data.leadId);
    } catch (e) {
      // A request the other side rejects (invalid email, missing permission) fails the same way every time
      if (isPermanent(e)) throw new UnrecoverableError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<StepJob> | undefined, error: Error) {
    if (!job) return;
    const permanent = error instanceof UnrecoverableError || error.name === 'UnrecoverableError';
    const outOfAttempts = permanent || job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.warn(
      `${job.name} for ${job.data.leadId} failed (attempt ${job.attemptsMade}${permanent ? ', not retried' : ''}): ${error.message}`,
    );
    if (outOfAttempts) await this.pipeline.markFailed(job.data.leadId, job.name as Step, error.message, permanent);
  }
}
