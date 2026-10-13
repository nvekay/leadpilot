import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/** Creates the test database if needed and brings its schema up to date */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgres://leadpilot:leadpilot@localhost:5433/leadpilot_test');
  const name = url.pathname.slice(1);
  const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString() });
  await admin.connect();
  const exists = await admin.query('select 1 from pg_database where datname = $1', [name]);
  if (!exists.rowCount) await admin.query(`create database "${name}"`);
  await admin.end();

  const pool = new pg.Pool({ connectionString: url.toString() });
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  await pool.end();
}
