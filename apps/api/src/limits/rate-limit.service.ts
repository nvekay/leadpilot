import { HttpException, HttpStatus, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

/**
 * Fixed-window counters in Redis. The public demo spends real money on model calls, so leads from the website are
 * capped per visitor and per day across everyone.
 */
@Injectable()
export class RateLimitService implements OnApplicationShutdown {
  private readonly redis = new Redis(env().REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true });

  /** Counts one hit; throws 429 when `key` has already been hit `limit` times in the current window */
  async hit(key: string, limit: number, windowSeconds: number, message: string) {
    const bucket = `ratelimit:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const [[, count]] = (await this.redis.multi().incr(bucket).expire(bucket, windowSeconds).exec()) as [
      [Error | null, number],
      [Error | null, number],
    ];
    if (count > limit) throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }

  async onApplicationShutdown() {
    this.redis.disconnect();
  }
}
