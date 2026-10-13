import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { IS_PUBLIC } from './public.decorator.js';

export const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Every route needs the shared key the web app's server sends in `x-api-key`; the browser never talks to the API
 * directly. Routes marked @Public() check their own credentials.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const key = ctx.switchToHttp().getRequest<Request>().header('x-api-key') ?? '';
    if (!safeEqual(key, env().API_INTERNAL_KEY)) throw new UnauthorizedException();
    return true;
  }
}
