import { LEAD_STATUSES } from '@leadpilot/shared';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { parse } from '../common/zod.js';
import { PipelineService } from '../pipeline/pipeline.service.js';
import { LeadsService } from './leads.service.js';

const listQuery = z.object({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : undefined))
    .pipe(z.array(z.enum(LEAD_STATUSES)).optional()),
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
const actor = z.object({ by: z.string().min(1).max(100) });

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly pipeline: PipelineService,
  ) {}

  @Get()
  async list(@Query() query: unknown) {
    return this.leads.list(parse(listQuery, query));
  }

  @Get('counts')
  async counts() {
    return this.leads.counts();
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const lead = await this.leads.get(id);
    if (!lead) throw new NotFoundException();
    return { lead, events: await this.leads.events(id) };
  }

  @Post(':id/approve')
  async approve(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const { by, text } = parse(actor.extend({ text: z.string().max(10_000).optional() }), body);
    return this.orConflict(await this.pipeline.approve(id, by, text), 'awaiting approval');
  }

  @Post(':id/reject')
  async reject(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const { by, reason } = parse(actor.extend({ reason: z.string().max(500).optional() }), body);
    return this.orConflict(await this.pipeline.reject(id, by, reason), 'awaiting approval');
  }

  @Post(':id/retry')
  async retry(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const { by } = parse(actor, body);
    return this.orConflict(await this.pipeline.retry(id, by), 'failed');
  }

  /** null from the pipeline means the lead was not in the expected status (already handled, or wrong state) */
  private orConflict<T>(result: T | null, expected: string): T {
    if (!result) throw new ConflictException(`The lead is not ${expected}`);
    return result;
  }
}
