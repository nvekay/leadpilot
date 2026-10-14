import { randomUUID } from 'node:crypto';
import { createTestApp, type TestApp } from './app.js';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.app.close();
});
beforeEach(async () => {
  await t.reset();
});

const sendDemo = async (sampleId: string) => {
  const res = await t.api.post('/intake/demo', { sampleId });
  expect(res.status).toBe(201);
  return res.body.id as string;
};

const postmark = (messageId: string) => ({
  MessageID: messageId,
  FromFull: { Email: 'Rachel.Moore@brightlane-demo.example', Name: 'Rachel Moore' },
  Subject: 'Need a quote for a web app',
  TextBody: 'We want to build a web app for bookings. Budget $30k.',
});

describe('lead pipeline', () => {
  it('takes a sales lead from the inbox to a draft waiting for approval', async () => {
    const id = await sendDemo('saas-dashboard');
    const lead = await t.waitForStatus(id, 'awaiting_approval');
    expect(lead.crmDealId).toMatch(/^d-/);
    expect(lead.draftReply).toContain('Hi Rachel');

    // The Slack request is its own job, so it can land just after the status changes
    const events = await t.waitForEvent(id, 'approval_requested');
    expect(events.map((e) => e.type)).toEqual([
      'received',
      'analyzed',
      'crm_synced',
      'draft_ready',
      'approval_requested',
    ]);
  });

  it('stops spam after analysis without touching the CRM', async () => {
    const id = await sendDemo('spam');
    const lead = await t.waitForStatus(id, 'ignored');
    expect(lead.analysis?.category).toBe('spam');
    expect(t.crm.calls).toBe(0);
  });

  it('turns the same email delivered twice into one lead', async () => {
    const messageId = `<${randomUUID()}@mail.example>`;
    const url = '/intake/email?token=test-inbound-token-0123456789';
    const first = await t.http().post(url).send(postmark(messageId));
    const second = await t.http().post(url).send(postmark(messageId));
    expect(first.body).toEqual({ id: expect.any(String), duplicate: false });
    expect(second.body).toEqual({ id: first.body.id, duplicate: true });

    await t.waitForStatus(first.body.id, 'awaiting_approval');
    expect(t.crm.calls).toBe(1);
    const { lead } = await t.lead(first.body.id);
    expect(lead.fromEmail).toBe('rachel.moore@brightlane-demo.example');
  });

  it('sends exactly one reply when approve is clicked twice at once', async () => {
    const id = await sendDemo('saas-dashboard');
    await t.waitForStatus(id, 'awaiting_approval');

    const [a, b] = await Promise.all([
      t.api.post(`/leads/${id}/approve`, { by: 'sam' }),
      t.api.post(`/leads/${id}/approve`, { by: 'sam' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);

    await t.waitForStatus(id, 'replied');
    expect(t.mailer.sent).toHaveLength(1);
    expect(t.mailer.sent[0]?.to).toBe('rachel.moore@brightlane.example.com');
  });

  it('sends the edited text when the reviewer changes the draft', async () => {
    const id = await sendDemo('saas-dashboard');
    await t.waitForStatus(id, 'awaiting_approval');
    await t.api.post(`/leads/${id}/approve`, { by: 'sam', text: 'Hi Rachel, edited by a human.' });
    await t.waitForStatus(id, 'replied');
    expect(t.mailer.sent[0]?.text).toBe('Hi Rachel, edited by a human.');
    const { events } = await t.lead(id);
    expect(events.find((e) => e.type === 'approved')?.data).toEqual({ by: 'sam', edited: true });
  });

  it('does not count an unchanged text box as an edit', async () => {
    const id = await sendDemo('saas-dashboard');
    const lead = await t.waitForStatus(id, 'awaiting_approval');
    // Same text with trailing whitespace, as a textarea may send it
    await t.api.post(`/leads/${id}/approve`, { by: 'sam', text: `${lead.draftReply}\n` });
    const { events } = await t.lead(id);
    expect(events.find((e) => e.type === 'approved')?.data).toEqual({ by: 'sam', edited: false });
  });

  it('closes a rejected lead without sending anything', async () => {
    const id = await sendDemo('saas-dashboard');
    await t.waitForStatus(id, 'awaiting_approval');
    const res = await t.api.post(`/leads/${id}/reject`, { by: 'sam', reason: 'Not a fit' });
    expect(res.status).toBe(201);
    expect((await t.lead(id)).lead.status).toBe('rejected');
    expect(t.mailer.sent).toHaveLength(0);
  });

  it('retries a step when the CRM is briefly down', async () => {
    t.crm.failuresLeft = 2;
    const id = await sendDemo('saas-dashboard');
    await t.waitForStatus(id, 'awaiting_approval');
    expect(t.crm.calls).toBe(3);
  });

  it('marks the lead failed after five attempts, and Retry picks it up from the failed step', async () => {
    t.crm.failuresLeft = 5;
    const id = await sendDemo('saas-dashboard');
    const failed = await t.waitForStatus(id, 'failed');
    expect(failed).toMatchObject({ failedStep: 'crm-sync', error: 'HubSpot is down (503)' });
    expect(t.crm.calls).toBe(5);

    const res = await t.api.post(`/leads/${id}/retry`, { by: 'sam' });
    expect(res.status).toBe(201);
    await t.waitForStatus(id, 'awaiting_approval');
    const { events } = await t.lead(id);
    expect(events.map((e) => e.type)).toContain('step_failed');
    expect(events.map((e) => e.type)).toContain('retried');
  });

  it('fails at once, without retries, when the CRM rejects the data', async () => {
    t.crm.rejectWith = 400;
    const id = await sendDemo('saas-dashboard');
    const failed = await t.waitForStatus(id, 'failed');
    expect(failed.failedStep).toBe('crm-sync');
    expect(t.crm.calls).toBe(1);
    const { events } = await t.lead(id);
    expect(events.find((e) => e.type === 'step_failed')?.data).toMatchObject({ step: 'crm-sync', permanent: true });
  });

  it('keeps the lead awaiting approval when Slack is down', async () => {
    t.notifier.fail = true;
    const id = await sendDemo('saas-dashboard');
    await t.waitForStatus(id, 'awaiting_approval');
    const deadline = Date.now() + 10_000;
    let types: string[] = [];
    while (!types.includes('approval_request_failed') && Date.now() < deadline) {
      types = (await t.lead(id)).events.map((e) => e.type);
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(types).toContain('approval_request_failed');
    expect((await t.lead(id)).lead.status).toBe('awaiting_approval');
  });
});

describe('access', () => {
  it('rejects calls without the internal key', async () => {
    expect((await t.http().get('/leads')).status).toBe(401);
    expect((await t.http().get('/health')).status).toBe(200);
  });

  it('rejects the email webhook with a wrong token', async () => {
    const res = await t.http().post('/intake/email?token=nope').send(postmark('<x@mail.example>'));
    expect(res.status).toBe(403);
  });

  it('caps website leads per visitor, counting each visitor separately', async () => {
    const send = (ip: string) => t.api.post('/intake/demo', { sampleId: 'spam' }).set('x-visitor-ip', ip);
    for (let i = 0; i < 3; i++) expect((await send('203.0.113.7')).status).toBe(201);
    const blocked = await send('203.0.113.7');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe('Too many leads from you this hour. Try again later.');
    expect((await send('198.51.100.4')).status).toBe(201);
  });

  it('validates the website form', async () => {
    const res = await t.api.post('/intake/form', { submissionId: randomUUID(), name: '', email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});
