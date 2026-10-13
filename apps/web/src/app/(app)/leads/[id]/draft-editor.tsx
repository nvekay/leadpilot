'use client';

import { AlertTriangle, Check, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { type ActionState, approveLead, rejectLead } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/field';

/** The reply draft: a person edits it if needed, then approves (sends) or rejects */
export function DraftEditor({
  leadId,
  to,
  subject,
  draft,
  warnings,
}: {
  leadId: string;
  to: string;
  subject: string;
  draft: string;
  warnings: string[];
}) {
  const [text, setText] = useState(draft);
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const [action, setAction] = useState<'approve' | 'reject'>();
  const edited = text.trim() !== draft.trim();

  const run = (kind: 'approve' | 'reject') => {
    setAction(kind);
    start(async () => setState(kind === 'approve' ? await approveLead(leadId, text) : await rejectLead(leadId)));
  };

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50/40 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 px-4 py-3">
        <h2 className="text-sm font-semibold">Reply draft · waiting for your approval</h2>
        {edited && <span className="text-xs text-ink-500">Edited</span>}
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm break-words text-ink-600">
          <span className="text-ink-400">To</span> {to} <span className="mx-1 text-ink-300">·</span>
          <span className="text-ink-400">Subject</span> {subject}
        </p>
        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {w}
              </li>
            ))}
          </ul>
        )}
        <textarea
          aria-label="Reply text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.min(18, Math.max(8, text.split('\n').length + 2))}
          className={`${inputClass} leading-relaxed`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            loading={pending && action === 'approve'}
            disabled={pending || !text.trim()}
            onClick={() => run('approve')}
          >
            <Check className="size-4" aria-hidden /> {edited ? 'Approve edited reply' : 'Approve and send'}
          </Button>
          <Button
            variant="danger"
            loading={pending && action === 'reject'}
            disabled={pending}
            onClick={() => run('reject')}
          >
            <X className="size-4" aria-hidden /> Reject
          </Button>
          {state.error && <p className="text-sm text-red-700">{state.error}</p>}
          {state.ok && <p className="text-sm text-accent">{state.ok}</p>}
        </div>
        <p className="text-xs text-ink-500">
          Demo: replies go to a test inbox (delivered@resend.dev), never to the address above.
        </p>
      </div>
    </section>
  );
}
