/** Client errors that a retry cannot fix: bad data, missing permissions, unknown records */
const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 422]);

/**
 * True for API errors that will fail the same way on every attempt. Rate limits (429), server errors (5xx) and
 * network failures are worth retrying; a rejected email address or a revoked token is not.
 */
export function isPermanent(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && PERMANENT_STATUSES.has(status);
}
