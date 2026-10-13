import type { LeadStatus } from '@leadpilot/shared';
import { STATUS } from '@/lib/format';
import { Spinner } from './ui/spinner';

export function StatusBadge({ status }: { status: LeadStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.tone}`}>
      {s.working && <Spinner className="size-3" />}
      {s.label}
    </span>
  );
}

/** 0–100, colored by heat: hot leads stand out in the list */
export function ScoreBadge({ score, hot = 70 }: { score: number | null; hot?: number }) {
  if (score === null) return <span className="text-xs text-ink-400">—</span>;
  const tone =
    score >= hot
      ? 'bg-orange-500 text-white'
      : score >= 40
        ? 'bg-orange-100 text-orange-900'
        : 'bg-ink-100 text-ink-600';
  return (
    <span
      className={`inline-flex min-w-9 justify-center rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${tone}`}
    >
      {score}
    </span>
  );
}
