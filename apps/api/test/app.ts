import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DB, type Db } from '../src/db/db.module.js';
import type { Lead } from '../src/db/schema.js';
import { FakeCrm } from '../src/pipeline/fakes.js';
import { CRM, MAILER, NOTIFIER, type Crm, type Mailer, type Notifier } from '../src/pipeline/ports.js';
import { QUEUE } from '../src/pipeline/steps.js';

/** CRM double that can be told to fail, to exercise retries */
export class TestCrm implements Crm {
  private readonly real = new FakeCrm();
  failuresLeft = 0;
  calls = 0;

  async syncLead(...args: Parameters<Crm['syncLead']>) {
    this.calls++;
    if (this.failuresLeft > 0) {
      this.failuresLeft--;
      throw new Error('HubSpot is down (503)');
    }
    return this.real.syncLead(args[0]);
  }

  async logReply() {}
}

/** Mail double that drops repeated idempotency keys, like the real provider */
export class TestMailer implements Mailer {
  readonly sent: { to: string; subject: string; text: string }[] = [];
  private readonly keys = new Set<string>();

  async send(m: { to: string; subject: string; text: string; idempotencyKey: string }) {
    if (!this.keys.has(m.idempotencyKey)) {
      this.keys.add(m.idempotencyKey);
      this.sent.push({ to: m.to, subject: m.subject, text: m.text });
    }
    return { id: `msg-${m.idempotencyKey}` };
  }
}

export class TestNotifier implements Notifier {
  fail = false;
  async approvalNeeded(lead: Lead) {
    if (this.fail) throw new Error('Slack is down');
    return { ref: `slack-${lead.id}` };
  }
}

export const API_KEY = 'test-internal-key-0123456789';

export async function createTestApp() {
  const crm = new TestCrm();
  const mailer = new TestMailer();
  const notifier = new TestNotifier();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CRM)
    .useValue(crm)
    .overrideProvider(MAILER)
    .useValue(mailer)
    .overrideProvider(NOTIFIER)
    .useValue(notifier)
    .compile();
  const app: INestApplication = moduleRef.createNestApplication();
  await app.init();

  const db = app.get<Db>(DB);
  const queue = app.get<Queue>(getQueueToken(QUEUE));
  const http = () => request(app.getHttpServer());
  const api = {
    get: (path: string) => http().get(path).set('x-api-key', API_KEY),
    post: (path: string, body?: object) =>
      http()
        .post(path)
        .set('x-api-key', API_KEY)
        .send(body ?? {}),
  };

  return {
    app,
    db,
    queue,
    crm,
    mailer,
    notifier,
    http,
    api,
    /** Empties the tables and the queue between tests */
    async reset() {
      await db.execute(sql`truncate leads, lead_events, settings cascade`);
      await queue.obliterate({ force: true });
      crm.failuresLeft = 0;
      crm.calls = 0;
      mailer.sent.length = 0;
      notifier.fail = false;
    },
    async lead(id: string) {
      const res = await api.get(`/leads/${id}`);
      return res.body as { lead: Lead; events: { type: string; data: Record<string, unknown> }[] };
    },
    /** Polls until the lead reaches one of the statuses (the worker runs in the background) */
    async waitForStatus(id: string, ...statuses: Lead['status'][]) {
      const deadline = Date.now() + 15_000;
      for (;;) {
        const { lead } = await this.lead(id);
        if (statuses.includes(lead.status)) return lead;
        if (Date.now() > deadline)
          throw new Error(`Lead ${id} stuck in ${lead.status}, expected ${statuses.join('/')}`);
        await new Promise((r) => setTimeout(r, 50));
      }
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
