import {
  AlertTriangle,
  Check,
  Database,
  Mail,
  MessageSquare,
  PenLine,
  RotateCcw,
  Send,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { LeadEvent } from '@/lib/types';

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  received: { icon: Mail, tone: 'bg-ink-100 text-ink-600' },
  analyzed: { icon: Sparkles, tone: 'bg-violet-100 text-violet-700' },
  crm_synced: { icon: Database, tone: 'bg-orange-100 text-orange-700' },
  draft_ready: { icon: PenLine, tone: 'bg-violet-100 text-violet-700' },
  approval_requested: { icon: MessageSquare, tone: 'bg-ink-100 text-ink-600' },
  approval_request_failed: { icon: AlertTriangle, tone: 'bg-amber-100 text-amber-800' },
  approved: { icon: Check, tone: 'bg-accent-soft text-accent' },
  rejected: { icon: X, tone: 'bg-ink-100 text-ink-600' },
  reply_sent: { icon: Send, tone: 'bg-accent-soft text-accent' },
  step_failed: { icon: AlertTriangle, tone: 'bg-red-100 text-red-700' },
  retried: { icon: RotateCcw, tone: 'bg-ink-100 text-ink-600' },
};

const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : JSON.stringify(v));

function describe(e: LeadEvent): { title: string; detail?: React.ReactNode } {
  const d = e.data ?? {};
  switch (e.type) {
    case 'received':
      return { title: `Received from ${d.source === 'demo' ? 'a sample email' : str(d.source)}` };
    case 'analyzed':
      return { title: `Read by AI: ${str(d.category).replace('_', ' ')}, score ${str(d.score)}` };
    case 'crm_synced': {
      const links = (['contact', 'company', 'deal'] as const)
        .map((k) => [k, d[k]] as const)
        .filter((x): x is readonly [(typeof x)[0], string] => typeof x[1] === 'string' && x[1].startsWith('http'));
      return {
        title: d.contactCreated
          ? 'Created contact and deal in HubSpot'
          : 'Matched an existing HubSpot contact, created a deal',
        detail: links.length ? (
          <span className="flex flex-wrap gap-x-3">
            {links.map(([k, url]) => (
              <a key={k} href={url} target="_blank" rel="noreferrer" className="text-accent capitalize hover:underline">
                {k} ↗
              </a>
            ))}
          </span>
        ) : undefined,
      };
    }
    case 'draft_ready': {
      const warnings = Array.isArray(d.warnings) ? d.warnings.length : 0;
      return { title: warnings ? `Reply drafted, ${warnings} warning${warnings > 1 ? 's' : ''}` : 'Reply drafted' };
    }
    case 'approval_requested':
      return { title: 'Posted to Slack for approval' };
    case 'approval_request_failed':
      return { title: 'Could not post to Slack (approve here instead)', detail: str(d.error) };
    case 'approved':
      return { title: `Approved${d.edited ? ' with edits' : ''} by ${str(d.by)}` };
    case 'rejected':
      return { title: `Rejected by ${str(d.by)}` };
    case 'reply_sent':
      return { title: 'Reply sent' };
    case 'step_failed':
      return { title: `Step "${str(d.step)}" failed after 5 attempts`, detail: str(d.error) };
    case 'retried':
      return { title: `Retried "${str(d.step)}" by ${str(d.by)}` };
    default:
      return { title: e.type };
  }
}

export function Timeline({ events }: { events: LeadEvent[] }) {
  return (
    <ol className="relative space-y-4">
      {events.map((e, i) => {
        const { icon: Icon, tone } = ICONS[e.type] ?? ICONS.received!;
        const { title, detail } = describe(e);
        const meta = [
          new Date(e.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
          e.durationMs !== null && e.durationMs > 0
            ? e.durationMs < 1000
              ? `${e.durationMs} ms`
              : `${(e.durationMs / 1000).toFixed(1)} s`
            : null,
          e.costUsd !== null && Number(e.costUsd) > 0 ? `$${Number(e.costUsd).toFixed(4)}` : null,
          typeof e.data?.model === 'string' && e.data.model !== 'fake' ? e.data.model : null,
        ].filter(Boolean);
        return (
          <li key={e.id} className="relative flex gap-3">
            {i < events.length - 1 && (
              <span className="absolute top-8 bottom-[-1rem] left-[13px] w-px bg-ink-200" aria-hidden />
            )}
            <span className={`relative grid size-7 shrink-0 place-items-center rounded-full ${tone}`}>
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5 text-sm">
              <p className="font-medium">{title}</p>
              <p className="text-xs text-ink-500">{meta.join(' · ')}</p>
              {detail && <div className="mt-1 text-xs break-words text-ink-600">{detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
