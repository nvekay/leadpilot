import type { LeadCategory, LeadStatus } from '@leadpilot/shared';

export const STATUS: Record<LeadStatus, { label: string; tone: string; working?: boolean }> = {
  received: { label: 'Reading', tone: 'bg-ink-100 text-ink-700', working: true },
  analyzed: { label: 'Syncing to CRM', tone: 'bg-ink-100 text-ink-700', working: true },
  synced: { label: 'Drafting reply', tone: 'bg-ink-100 text-ink-700', working: true },
  awaiting_approval: { label: 'Needs approval', tone: 'bg-amber-100 text-amber-900' },
  approved: { label: 'Sending', tone: 'bg-accent-soft text-accent-strong', working: true },
  replied: { label: 'Replied', tone: 'bg-accent-soft text-accent-strong' },
  rejected: { label: 'Rejected', tone: 'bg-ink-100 text-ink-500' },
  ignored: { label: 'Not a lead', tone: 'bg-ink-100 text-ink-500' },
  failed: { label: 'Failed', tone: 'bg-red-100 text-red-800' },
};

export const CATEGORY: Record<LeadCategory, string> = {
  sales_lead: 'Sales lead',
  support: 'Support',
  partnership: 'Partnership',
  job_application: 'Job application',
  spam: 'Spam',
  other: 'Other',
};

/** Statuses the pipeline is still working on; pages refresh while a lead is in one */
export const isWorking = (s: LeadStatus) => Boolean(STATUS[s].working);

export const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** "3 min ago", "yesterday", or a date for anything older than a week */
export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const abs = Math.abs(s);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const displayName = (l: { fromName: string | null; fromEmail: string }) => l.fromName ?? l.fromEmail;
