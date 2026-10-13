import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

/** Validates a request body or query, answering 400 with the problems listed */
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}
