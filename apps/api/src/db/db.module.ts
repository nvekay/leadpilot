import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import { pgConfig } from './pg-config.js';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;
export const DB = Symbol('DB');
const POOL = Symbol('POOL');

/** Inject the Drizzle client with `@InjectDb() db: Db` */
export const InjectDb = () => Inject(DB);

@Global()
@Module({
  providers: [
    { provide: POOL, useFactory: () => new pg.Pool(pgConfig(env().DATABASE_URL, { max: 10 })) },
    { provide: DB, inject: [POOL], useFactory: (pool: pg.Pool): Db => drizzle(pool, { schema }) },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
