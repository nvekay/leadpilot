import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';
import { env } from '../config/env.js';
import { jobId, QUEUE, type Step, type StepJob } from './steps.js';

/** Retries with exponential backoff (5 s, 10 s, 20 s, 40 s by default), then the step is marked failed */
export const jobOptions = (): JobsOptions => ({
  attempts: 5,
  backoff: { type: 'exponential', delay: env().PIPELINE_RETRY_DELAY_MS },
  removeOnComplete: { age: 7 * 24 * 3600 },
  removeOnFail: false,
});

@Injectable()
export class PipelineQueue {
  constructor(@InjectQueue(QUEUE) private readonly queue: Queue<StepJob>) {}

  async enqueue(step: Step, leadId: string) {
    await this.queue.add(step, { leadId }, { ...jobOptions(), jobId: jobId(step, leadId) });
  }

  /** Re-runs a step whose job ran out of attempts */
  async retry(step: Step, leadId: string) {
    const job = await this.queue.getJob(jobId(step, leadId));
    if (job && (await job.isFailed())) await job.retry('failed', { resetAttemptsMade: true });
    else await this.enqueue(step, leadId);
  }

  async jobs(states: ('active' | 'waiting' | 'delayed' | 'failed' | 'completed')[], limit = 50) {
    return this.queue.getJobs(states, 0, limit - 1, false);
  }

  async counts() {
    return this.queue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'completed');
  }
}
