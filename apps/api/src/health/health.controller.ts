import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from '../common/public.decorator.js';
import { type Db, InjectDb } from '../db/db.module.js';

@Controller('health')
export class HealthController {
  constructor(@InjectDb() private readonly db: Db) {}

  /** Full check: the process is up and the database answers */
  @Public()
  @Get()
  async check() {
    await this.db.execute(sql`select 1`);
    return { ok: true };
  }

  /**
   * The process is up. Used by the host's health checks and the keep-alive ping, so they do not wake the
   * serverless database every few minutes.
   */
  @Public()
  @Get('live')
  live() {
    return { ok: true };
  }
}
