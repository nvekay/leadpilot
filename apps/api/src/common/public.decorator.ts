import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
/** Opens a route without the internal API key (health check, webhooks that verify their own signature) */
export const Public = () => SetMetadata(IS_PUBLIC, true);
