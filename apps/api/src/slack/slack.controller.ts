import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac } from 'node:crypto';
import { safeEqual } from '../common/internal-key.guard.js';
import { Public } from '../common/public.decorator.js';
import { env } from '../config/env.js';
import { PipelineService } from '../pipeline/pipeline.service.js';
import { APPROVE_ACTION, REJECT_ACTION } from './slack-notifier.js';

interface BlockActionPayload {
  type: string;
  user: { id: string; username?: string; name?: string };
  actions: { action_id: string; value?: string }[];
  response_url: string;
}

/** Verifies a request came from Slack: HMAC of the raw body with the signing secret, at most 5 minutes old */
export function verifySlackSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
  now = Date.now(),
) {
  if (!timestamp || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
  return safeEqual(expected, signature);
}

@Controller('slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(private readonly pipeline: PipelineService) {}

  /** Slack interactivity endpoint: Approve and Reject buttons */
  @Public()
  @Post('actions')
  @HttpCode(200)
  async actions(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-slack-request-timestamp') timestamp: string,
    @Headers('x-slack-signature') signature: string,
  ) {
    const secret = env().SLACK_SIGNING_SECRET;
    if (!secret) throw new NotFoundException();
    const raw = req.rawBody?.toString('utf8') ?? '';
    if (!verifySlackSignature(secret, timestamp, raw, signature ?? '')) throw new ForbiddenException();

    const payload = JSON.parse(new URLSearchParams(raw).get('payload') ?? '{}') as BlockActionPayload;
    const action = payload.actions?.[0];
    if (payload.type !== 'block_actions' || !action?.value) return {};
    const by = `slack:${payload.user.username ?? payload.user.name ?? payload.user.id}`;

    const lead =
      action.action_id === APPROVE_ACTION
        ? await this.pipeline.approve(action.value, by)
        : action.action_id === REJECT_ACTION
          ? await this.pipeline.reject(action.value, by)
          : undefined;
    if (lead === undefined) return {};

    // Replace the buttons with the outcome so nobody clicks twice
    const verb = action.action_id === APPROVE_ACTION ? 'Approved, reply is being sent' : 'Rejected';
    const text = lead ? `${verb} by <@${payload.user.id}>` : 'Already handled in LeadPilot';
    await fetch(payload.response_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ replace_original: false, text }),
    }).catch((e: unknown) => this.logger.warn(`Slack response_url failed: ${String(e)}`));
    return {};
  }
}
