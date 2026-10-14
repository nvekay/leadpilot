import { AlertTriangle, ChevronLeft, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/auto-refresh';
import { StatusBadge } from '@/components/status-badge';
import { api, ApiError } from '@/lib/api';
import { CATEGORY, displayName, isWorking, timeAgo, usd } from '@/lib/format';
import { DraftEditor } from './draft-editor';
import { RetryButton } from './retry-button';
import { Timeline } from './timeline';

export const metadata: Metadata = { title: 'Lead' };

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  try {
    return await api.lead(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-ink-200 bg-white shadow-sm">
      <h2 className="border-b border-ink-100 px-4 py-2.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-500">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? <span className="text-ink-400">Not stated</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ lead, events }, settings] = await Promise.all([load(id), api.settings()]);
  const a = lead.analysis;
  const budget = a?.budgetUsd;
  const budgetText =
    budget && (budget.min || budget.max)
      ? budget.min && budget.max && budget.min !== budget.max
        ? `${usd(budget.min)} – ${usd(budget.max)}`
        : usd((budget.max ?? budget.min)!)
      : null;
  const cost = events.reduce((s, e) => s + Number(e.costUsd ?? 0), 0);
  const sent = events.find((e) => e.type === 'reply_sent');

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <AutoRefresh active={isWorking(lead.status)} />
      <Link href="/inbox" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
        <ChevronLeft className="size-4" aria-hidden /> Inbox
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold break-words">
            {displayName(lead)}
            {a?.company.name && <span className="font-normal text-ink-500"> · {a.company.name}</span>}
          </h1>
          <p className="mt-1 text-sm break-words text-ink-500">
            {lead.fromEmail} · {lead.subject ?? 'No subject'} · {timeAgo(lead.receivedAt)}
          </p>
        </div>
        <StatusBadge status={lead.status} />
      </header>

      {a?.suspiciousInstructions && (
        <div className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">This message tries to give instructions to the AI.</span> They were ignored:
            the model only extracts facts, the score comes from fixed rules, and nothing is sent without a person
            approving it.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {lead.status === 'failed' && (
            <section className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
                <AlertTriangle className="size-4" aria-hidden /> The &quot;{lead.failedStep}&quot; step failed
              </p>
              <p className="mt-1 text-sm break-words text-red-800">{lead.error}</p>
              <div className="mt-3">
                <RetryButton leadId={lead.id} />
              </div>
            </section>
          )}

          {lead.status === 'awaiting_approval' && lead.draftReply && (
            <DraftEditor
              key={lead.updatedAt}
              leadId={lead.id}
              to={lead.fromEmail}
              subject={lead.replySubject ?? ''}
              draft={lead.draftReply}
              warnings={lead.draftWarnings ?? []}
            />
          )}

          {(lead.status === 'approved' || lead.status === 'replied') && lead.draftReply && (
            <Card title={sent ? `Reply sent ${timeAgo(sent.createdAt)}` : 'Reply approved, sending…'}>
              <p className="mb-2 text-sm text-ink-500">{lead.replySubject}</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{lead.draftReply}</p>
            </Card>
          )}

          {lead.status === 'ignored' && a && (
            <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
              Classified as <span className="font-medium text-ink-900">{CATEGORY[a.category].toLowerCase()}</span>, so
              it was not added to the CRM and no reply was drafted.
            </div>
          )}

          <Card title="Original message">
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{lead.body}</p>
          </Card>

          <Card title="Timeline">
            <Timeline events={events} />
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Score">
            {lead.score === null ? (
              <p className="text-sm text-ink-500">Not scored yet.</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-3xl font-semibold tabular-nums ${lead.score >= settings.icp.hotScore ? 'text-orange-600' : ''}`}
                  >
                    {lead.score}
                  </span>
                  <span className="text-sm text-ink-500">
                    {lead.score >= settings.icp.hotScore ? 'Hot lead' : 'out of 100'}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {lead.scoreReasons?.map((r) => (
                    <li key={r.reason} className="flex gap-2">
                      <span
                        className={`w-9 shrink-0 text-right font-mono text-xs leading-5 tabular-nums ${
                          r.points > 0 ? 'text-accent' : r.points < 0 ? 'text-red-700' : 'text-ink-400'
                        }`}
                      >
                        {r.points > 0 ? `+${r.points}` : r.points}
                      </span>
                      <span>{r.reason}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/settings" className="mt-3 inline-block text-xs text-accent hover:underline">
                  Scoring rules
                </Link>
              </>
            )}
          </Card>

          {a && (
            <Card title="Extracted by AI">
              <p className="mb-3 text-sm">{a.summary}</p>
              <Facts
                rows={[
                  ['Type', CATEGORY[a.category]],
                  ['Budget', budgetText],
                  ['Services', a.services.length ? a.services.join(', ') : null],
                  ['Timeline', a.timeline],
                  ['Urgency', a.urgency],
                  ['Contact', [a.contact.name, a.contact.jobTitle].filter(Boolean).join(', ') || null],
                  ['Phone', a.contact.phone],
                  ['Company', a.company.name],
                  ['Website', a.company.website],
                  ['Country', a.company.country],
                  ['Employees', a.company.employees],
                  ['Language', a.language.toUpperCase()],
                ]}
              />
            </Card>
          )}

          <Card title="Cost">
            <p className="text-sm">
              <span className="font-semibold tabular-nums">${cost.toFixed(4)}</span>{' '}
              <span className="text-ink-500">in model calls for this lead</span>
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
