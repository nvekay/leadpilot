import type { LeadStatus } from '@leadpilot/shared';
import { ArrowRight, Inbox as InboxIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoRefresh } from '@/components/auto-refresh';
import { ScoreBadge, StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { CATEGORY, displayName, isWorking, timeAgo } from '@/lib/format';

export const metadata: Metadata = { title: 'Inbox' };

const SOURCE = { demo: 'Sample email', form: 'Website form', email: 'Email' } as const;

const VIEWS = {
  all: { label: 'All', statuses: [] as LeadStatus[] },
  approval: { label: 'Needs approval', statuses: ['awaiting_approval'] as LeadStatus[] },
  working: { label: 'In progress', statuses: ['received', 'analyzed', 'synced', 'approved'] as LeadStatus[] },
  replied: { label: 'Replied', statuses: ['replied'] as LeadStatus[] },
  closed: { label: 'Not leads & rejected', statuses: ['ignored', 'rejected'] as LeadStatus[] },
  failed: { label: 'Failed', statuses: ['failed'] as LeadStatus[] },
};
type View = keyof typeof VIEWS;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: raw } = await searchParams;
  const view: View = raw && raw in VIEWS ? (raw as View) : 'all';
  const [leads, counts, settings] = await Promise.all([api.leads(VIEWS[view].statuses), api.counts(), api.settings()]);
  const count = (v: View) =>
    v === 'all'
      ? Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
      : VIEWS[v].statuses.reduce((a, s) => a + (counts[s] ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <AutoRefresh active={leads.some((l) => isWorking(l.status))} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="mt-1 text-sm text-ink-500">
            Every email and form lead, read and scored by AI. Drafts wait for a person to approve them.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-200 px-3 text-sm font-medium shadow-sm hover:bg-ink-50"
        >
          Send a test lead <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-ink-200" aria-label="Filter leads">
        {(Object.keys(VIEWS) as View[]).map((v) => {
          const n = count(v);
          const active = v === view;
          return (
            <Link
              key={v}
              href={v === 'all' ? '/inbox' : `/inbox?view=${v}`}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
                active
                  ? 'border-ink-900 font-medium text-ink-900'
                  : 'border-transparent text-ink-500 hover:text-ink-900'
              }`}
            >
              {VIEWS[v].label}
              <span className={`text-xs tabular-nums ${active ? 'text-ink-600' : 'text-ink-400'}`}>{n}</span>
            </Link>
          );
        })}
      </nav>

      {leads.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-ink-300 px-6 py-14 text-center">
          <InboxIcon className="mx-auto size-6 text-ink-400" aria-hidden />
          <p className="mt-3 font-medium">Nothing here yet</p>
          <p className="mt-1 text-sm text-ink-500">Send a sample email and watch it go through the pipeline.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
            Send a test lead
          </Link>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-ink-100">
          {leads.map((l) => {
            const a = l.analysis;
            const company = a?.company.name;
            return (
              <li key={l.id}>
                <Link
                  href={`/leads/${l.id}`}
                  className="-mx-3 grid grid-cols-[auto_1fr_auto] items-start gap-x-4 gap-y-1 rounded-lg px-3 py-3.5 hover:bg-ink-50"
                >
                  <div className="pt-0.5">
                    <ScoreBadge score={l.score} hot={settings.icp.hotScore} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span className="font-medium">{displayName(l)}</span>
                      {company && <span className="text-ink-500"> · {company}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-ink-600">
                      {a?.summary ?? l.subject ?? l.body.slice(0, 120)}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                      {a && <span>{CATEGORY[a.category]}</span>}
                      {a?.suspiciousInstructions && (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700">
                          Prompt injection attempt
                        </span>
                      )}
                      <span>{SOURCE[l.source]}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={l.status} />
                    <span className="text-xs text-ink-400">{timeAgo(l.receivedAt)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
