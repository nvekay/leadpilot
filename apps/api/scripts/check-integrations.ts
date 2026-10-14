// Checks each configured integration with one harmless live call and prints ok / the error. Never prints secrets.
// Usage: pnpm --filter @leadpilot/api check
import Anthropic from '@anthropic-ai/sdk';

const env = process.env;
const results: [string, string][] = [];
const run = async (name: string, configured: boolean, fn: () => Promise<string>) => {
  if (!configured) return results.push([name, 'not configured']);
  try {
    results.push([name, `ok: ${await fn()}`]);
  } catch (e) {
    results.push([name, `FAILED: ${e instanceof Error ? e.message : String(e)}`]);
  }
};

await run('Claude', Boolean(env.ANTHROPIC_API_KEY), async () => {
  const model = env.ANALYZE_MODEL ?? 'claude-haiku-5-5';
  const res = await new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }).messages.create({
    model,
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Reply with the word OK.' }],
  });
  const text = res.content.find((b) => b.type === 'text')?.text ?? '';
  return `${model} answered "${text.trim()}"`;
});

await run('Slack', Boolean(env.SLACK_BOT_TOKEN && env.SLACK_CHANNEL_ID), async () => {
  const call = async (method: string, body: object) => {
    const r = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    const j = (await r.json()) as { ok: boolean; error?: string; team?: string; user?: string };
    if (!j.ok) throw new Error(`${method}: ${j.error}`);
    return j;
  };
  const who = await call('auth.test', {});
  await call('chat.postMessage', {
    channel: env.SLACK_CHANNEL_ID,
    text: 'LeadPilot is connected. Approval requests for new leads will appear here.',
  });
  return `bot ${who.user} in ${who.team}, test message posted`;
});

await run('Resend', Boolean(env.RESEND_API_KEY), async () => {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM ?? 'Northwind Studio <onboarding@resend.dev>',
      to: [env.MAIL_REDIRECT_TO ?? 'delivered@resend.dev'],
      subject: 'LeadPilot connection test',
      text: 'If you can read this, LeadPilot can send replies.',
    }),
  });
  const j = (await r.json()) as { id?: string; message?: string };
  if (!r.ok) throw new Error(`${r.status} ${j.message ?? ''}`);
  return `email ${j.id} accepted for ${env.MAIL_REDIRECT_TO ?? 'delivered@resend.dev'}`;
});

await run('HubSpot', Boolean(env.HUBSPOT_TOKEN), async () => {
  const r = await fetch('https://api.hubapi.com/account-info/v3/details', {
    headers: { authorization: `Bearer ${env.HUBSPOT_TOKEN}` },
  });
  const j = (await r.json()) as { portalId?: number; message?: string };
  if (!r.ok) throw new Error(`${r.status} ${j.message ?? ''}`);
  return `portal ${j.portalId}`;
});

for (const [name, result] of results) console.log(`${name.padEnd(8)} ${result}`);
