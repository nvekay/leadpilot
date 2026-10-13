import { icpSchema } from '@leadpilot/shared';
import { Body, Controller, Get, Put } from '@nestjs/common';
import { z } from 'zod';
import { parse } from '../common/zod.js';
import { SettingsService } from './settings.service.js';

const settingsSchema = z.object({
  icp: icpSchema,
  replySignature: z.string().trim().min(1).max(500),
  calendarUrl: z.url(),
});

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async get() {
    return this.settings.get();
  }

  @Put()
  async update(@Body() body: unknown) {
    return this.settings.update(parse(settingsSchema, body));
  }
}
