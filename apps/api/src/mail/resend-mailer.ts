import type { Mailer } from '../pipeline/ports.js';

/**
 * Sends replies through Resend. The idempotency key makes Resend drop a repeated request (a retry after a timeout),
 * so one approval can never send two emails. With `redirectTo` set every reply goes to that address instead of the
 * lead's (the public demo uses Resend's test inbox, so visitors cannot make it email arbitrary people).
 */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly redirectTo: string | undefined,
    private readonly http: typeof fetch = fetch,
  ) {}

  async send(m: { to: string; subject: string; text: string; idempotencyKey: string }) {
    const to = this.redirectTo ?? m.to;
    const res = await this.http('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': m.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.from,
        to: [to],
        subject: this.redirectTo ? `[demo, for ${m.to}] ${m.subject}` : m.subject,
        text: m.text,
      }),
    });
    if (!res.ok) {
      const error = new Error(`Resend failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
      // The status decides whether the queue retries (429, 5xx) or gives up at once (400, 401, 403, 422)
      throw Object.assign(error, { status: res.status });
    }
    const { id } = (await res.json()) as { id: string };
    return { id };
  }
}
