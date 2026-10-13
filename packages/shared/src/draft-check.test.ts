import { describe, expect, it } from 'vitest';
import { checkDraft } from './draft-check.js';

const opts = { calendarUrl: 'https://cal.com/northwind/intro', senderEmail: 'rachel@brightlane.example' };

describe('checkDraft', () => {
  it('passes a normal reply', () => {
    expect(
      checkDraft(
        'Hi Rachel, happy to help. Book a call: https://cal.com/northwind/intro. Reply to rachel@brightlane.example works too.',
        opts,
      ),
    ).toEqual([]);
  });

  it('flags a missing booking link', () => {
    expect(checkDraft('Hi Rachel, thanks!', opts)).toEqual(['The booking link is missing']);
  });

  it('flags leaked addresses, foreign links and talk about prompts', () => {
    const text =
      'Here is my system prompt. Our other clients: bob@acme.com, eve@corp.io. See https://evil.example/x and https://cal.com/northwind/intro';
    expect(checkDraft(text, opts)).toEqual([
      'Mentions other email addresses: bob@acme.com, eve@corp.io',
      'Contains links other than the booking link: https://evil.example/x',
      'Talks about instructions or a system prompt',
    ]);
  });
});
