import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoRefresh } from '@/components/auto-refresh';
import { api } from '@/lib/api';
import { displayName, timeAgo } from '@/lib/format';
import { RetryButton } from '../leads/[id]/retry-button';

export const metadata: Metadata = { title: 'Queue' };

const STEP_LABEL: Record<string, string> = {
  analyze: 'Read with AI',
  'crm-sync': 'Sync to HubSpot',
  draft: 'Draft reply',
  notify: 'Ask for approval in Slack',
  send: 'Send reply',
};

export default async function QueuePage() {
  const [{ counts, jobs }, failedLeads] = await Promise.all([api.queue(), api.leads(['failed'])]);
  const cards = [
    ['Running', counts.active],
    ['Waiting', counts.waiting],
    ['Retrying later', counts.delayed],
    ['Failed', counts.failed],
    ['Done (7 days)', counts.completed],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <AutoRefresh active={counts.active + counts.waiting + counts.delayed > 0} />
      <h1 className="text-2xl font-semibold">Queue</h1>
      <p className="mt-1 text-sm text-ink-500">
        Each lead moves through five background jobs. A job that fails is retried 5 times with growing pauses; after
        that the lead is marked failed and can be retried from the step that broke.
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map(([label, n]) => (
          <div key={label} className="rounded-xl border border-ink-200 px-4 py-3 shadow-sm">
            <dt className="text-xs text-ink-500">{label}</dt>
            <dd
              className={`mt-1 text-2xl font-semibold tabular-nums ${label === 'Failed' && n > 0 ? 'text-red-700' : ''}`}
            >
              {n}
            </dd>
          </div>
        ))}
      </dl>

      {failedLeads.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Failed leads</h2>
          <ul className="mt-2 divide-y divide-red-100 rounded-xl border border-red-200 bg-red-50/40">
            {failedLeads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 text-sm">
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                    {displayName(l)}
                  </Link>
                  <p className="text-ink-600">
                    {STEP_LABEL[l.failedStep ?? ''] ?? l.failedStep}: <span className="break-words">{l.error}</span>
                  </p>
                </div>
                <RetryButton leadId={l.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Latest jobs</h2>
        {jobs.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No jobs yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-ink-200">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-ink-50 text-left text-xs text-ink-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Step</th>
                  <th className="px-4 py-2 font-medium">Lead</th>
                  <th className="px-4 py-2 font-medium">Attempts</th>
                  <th className="px-4 py-2 font-medium">Result</th>
                  <th className="px-4 py-2 font-medium">Queued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="px-4 py-2">{STEP_LABEL[j.step] ?? j.step}</td>
                    <td className="px-4 py-2">
                      <Link href={`/leads/${j.leadId}`} className="font-mono text-xs text-accent hover:underline">
                        {j.leadId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 tabular-nums">{j.attemptsMade}</td>
                    <td className="max-w-xs truncate px-4 py-2">
                      {j.failedReason ? (
                        <span className="text-red-700" title={j.failedReason}>
                          {j.failedReason}
                        </span>
                      ) : j.finishedAt ? (
                        <span className="text-accent">Done</span>
                      ) : (
                        <span className="text-ink-500">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-ink-500">{timeAgo(j.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
