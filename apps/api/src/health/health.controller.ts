import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from '../common/public.decorator.js';
import { type Db, InjectDb } from '../db/db.module.js';

@Controller('health')
export class HealthController {
  constructor(@InjectDb() private readonly db: Db) {}

  @Public()
  @Get()
  async check() {
    await this.db.execute(sql`select 1`);
    return { ok: true };
  }
}
