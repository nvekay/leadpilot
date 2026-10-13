// Puts the sample emails into the inbox as permanent examples, so the demo is never empty.
// Safe to run again: each sample has a fixed id and is stored once.
// Usage: pnpm --filter @leadpilot/api seed   (with the API's .env; the running API's worker processes them)
import { Queue } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../src/db/schema.js';
import { DEMO_MESSAGES } from '../src/intake/demo-messages.js';
import { SEED_PREFIX } from '../src/maintenance/maintenance.module.js';
import { jobOptions } from '../src/pipeline/pipeline.queue.js';
import { jobId, QUEUE } from '../src/pipeline/steps.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
const queue = new Queue(QUEUE, { connection: { url: process.env.REDIS_URL } });

for (const m of DEMO_MESSAGES) {
  const externalId = `${SEED_PREFIX}${m.id}`;
  const [created] = await db
    .insert(schema.leads)
    .values({
      source: 'demo',
      externalId,
      fromEmail: m.fromEmail,
      fromName: m.fromName,
      subject: m.subject,
      body: m.body,
    })
    .onConflictDoNothing()
    .returning();
  const lead =
    created ??
    (
      await db
        .select()
        .from(schema.leads)
        .where(and(eq(schema.leads.source, 'demo'), eq(schema.leads.externalId, externalId)))
    )[0]!;
  if (created)
    await db
      .insert(schema.leadEvents)
      .values({ leadId: lead.id, type: 'received', actor: 'system', data: { source: 'demo' } });
  if (lead.status === 'received')
    await queue.add('analyze', { leadId: lead.id }, { ...jobOptions(), jobId: jobId('analyze', lead.id) });
  console.log(`${created ? 'added' : 'exists'}  ${m.label}`);
}

await queue.close();
await pool.end();
