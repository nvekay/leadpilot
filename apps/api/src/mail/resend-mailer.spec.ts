import { ResendMailer } from './resend-mailer.js';

function capture() {
  const requests: {
    url: string;
    headers: Record<string, string>;
    body: { to: string[]; subject: string; [k: string]: unknown };
  }[] = [];
  const http = (async (url: string, init: RequestInit) => {
    requests.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
    return new Response(JSON.stringify({ id: 'email_123' }), { status: 200 });
  }) as unknown as typeof fetch;
  return { requests, http };
}

const message = {
  to: 'rachel@brightlane.example',
  subject: 'Re: Dashboard',
  text: 'Hi Rachel',
  idempotencyKey: 'reply-1',
};

describe('ResendMailer', () => {
  it('sends to the lead with an idempotency key', async () => {
    const { requests, http } = capture();
    const result = await new ResendMailer('re_test', 'Sam <sam@northwind.example>', undefined, http).send(message);
    expect(result).toEqual({ id: 'email_123' });
    expect(requests[0]!.headers['idempotency-key']).toBe('reply-1');
    expect(requests[0]!.body).toEqual({
      from: 'Sam <sam@northwind.example>',
      to: ['rachel@brightlane.example'],
      subject: 'Re: Dashboard',
      text: 'Hi Rachel',
    });
  });

  it('redirects every reply in demo mode and says who it was for', async () => {
    const { requests, http } = capture();
    await new ResendMailer('re_test', 'Sam <sam@northwind.example>', 'delivered@resend.dev', http).send(message);
    expect(requests[0]!.body.to).toEqual(['delivered@resend.dev']);
    expect(requests[0]!.body.subject).toBe('[demo, for rachel@brightlane.example] Re: Dashboard');
  });

  it('throws on an API error so the queue retries', async () => {
    const http = (async () => new Response('rate limited', { status: 429 })) as unknown as typeof fetch;
    await expect(new ResendMailer('re_test', 'x@y.example', undefined, http).send(message)).rejects.toThrow(
      'Resend failed: 429',
    );
  });
});
