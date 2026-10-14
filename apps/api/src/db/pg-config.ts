import type { PoolConfig } from 'pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal', 'postgres']);

/**
 * Connection settings for a database URL. Hosted Postgres (Neon, Render, Supabase) refuses connections without TLS,
 * and connection strings often lose their `?sslmode=require` when copied, so TLS is on for every non-local host.
 * An explicit sslmode in the URL still takes precedence.
 */
export function pgConfig(url: string, extra: PoolConfig = {}): PoolConfig {
  const { hostname, searchParams } = new URL(url);
  const local = LOCAL_HOSTS.has(hostname);
  return {
    connectionString: url,
    ...(local || searchParams.has('sslmode') ? {} : { ssl: true }),
    ...extra,
  };
}
