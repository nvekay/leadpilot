import { createHmac } from 'node:crypto';
import { APPROVE_ACTION, REJECT_ACTION } from '../src/slack/slack-notifier.js';
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

/** Builds a button click the way Slack sends it: form-encoded payload, signed with the app's signing secret */
function slackClick(actionId: string, leadId: string, opts: { secret?: string; ageSeconds?: number } = {}) {
  const payload = {
    type: 'block_actions',
    user: { id: 'U123', username: 'sam' },
    actions: [{ action_id: actionId, value: leadId }],
    response_url: 'http://127.0.0.1:9/slack-response',
  };
  const body = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
  const ts = String(Math.floor(Date.now() / 1000) - (opts.ageSeconds ?? 0));
  const sig = `v0=${createHmac('sha256', opts.secret ?? 'test-slack-signing-secret')
    .update(`v0:${ts}:${body}`)
    .digest('hex')}`;
  return t
    .http()
    .post('/slack/actions')
    .set('content-type', 'application/x-www-form-urlencoded')
    .set('x-slack-request-timestamp', ts)
    .set('x-slack-signature', sig)
    .send(body);
}

async function leadAwaitingApproval() {
  const { body } = await t.api.post('/intake/demo', { sampleId: 'saas-dashboard' });
  await t.waitForStatus(body.id, 'awaiting_approval');
  return body.id as string;
}

describe('Slack buttons', () => {
  it('approves and sends the reply from Slack', async () => {
    const id = await leadAwaitingApproval();
    expect((await slackClick(APPROVE_ACTION, id)).status).toBe(200);
    await t.waitForStatus(id, 'replied');
    expect(t.mailer.sent).toHaveLength(1);
    const { events } = await t.lead(id);
    expect(events.find((e) => e.type === 'approved')?.data).toEqual({ by: 'slack:sam', edited: false });
  });

  it('rejects from Slack', async () => {
    const id = await leadAwaitingApproval();
    await slackClick(REJECT_ACTION, id);
    expect((await t.lead(id)).lead.status).toBe('rejected');
  });

  it('ignores a click on a lead that was already handled in the app', async () => {
    const id = await leadAwaitingApproval();
    await t.api.post(`/leads/${id}/reject`, { by: 'sam' });
    expect((await slackClick(APPROVE_ACTION, id)).status).toBe(200);
    expect((await t.lead(id)).lead.status).toBe('rejected');
    expect(t.mailer.sent).toHaveLength(0);
  });

  it('refuses a forged signature and a replayed old request', async () => {
    const id = await leadAwaitingApproval();
    expect((await slackClick(APPROVE_ACTION, id, { secret: 'wrong' })).status).toBe(403);
    expect((await slackClick(APPROVE_ACTION, id, { ageSeconds: 600 })).status).toBe(403);
    expect((await t.lead(id)).lead.status).toBe('awaiting_approval');
  });
});
