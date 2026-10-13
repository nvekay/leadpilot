/**
 * Plain checks on a drafted reply before a person sees it. The model reads untrusted email text, so its output is
 * checked for things an injected instruction would try: leaking addresses, adding links, dropping the booking link.
 */
export function checkDraft(text: string, opts: { calendarUrl: string; senderEmail: string }): string[] {
  const warnings: string[] = [];
  if (!text.includes(opts.calendarUrl)) warnings.push('The booking link is missing');

  const emails = text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? [];
  const others = emails.filter((e) => e.toLowerCase() !== opts.senderEmail.toLowerCase());
  if (others.length) warnings.push(`Mentions other email addresses: ${[...new Set(others)].join(', ')}`);

  const urls = text.match(/https?:\/\/[^\s)>\]]+/g) ?? [];
  const foreign = urls.filter((u) => !u.startsWith(opts.calendarUrl));
  if (foreign.length) warnings.push(`Contains links other than the booking link: ${[...new Set(foreign)].join(', ')}`);

  if (/system prompt|ignore (all |previous )?instructions/i.test(text))
    warnings.push('Talks about instructions or a system prompt');
  return warnings;
}
