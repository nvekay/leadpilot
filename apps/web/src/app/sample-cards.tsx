'use client';

import { Send } from 'lucide-react';
import { useState, useTransition } from 'react';
import { sendSample } from '@/app/actions';
import { Spinner } from '@/components/ui/spinner';
import type { DemoSample } from '@/lib/types';

/** One card per sample email; sending opens the lead so the visitor can watch the pipeline */
export function SampleCards({ samples }: { samples: DemoSample[] }) {
  const [pendingId, setPendingId] = useState<string>();
  const [, start] = useTransition();

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {samples.map((s) => {
        const pending = pendingId === s.id;
        return (
          <li key={s.id}>
            <button
              type="button"
              disabled={pendingId !== undefined}
              onClick={() => {
                setPendingId(s.id);
                start(() => sendSample(s.id));
              }}
              className="group flex h-full w-full flex-col rounded-xl border border-ink-200 bg-white p-4 text-left shadow-sm transition hover:border-accent hover:shadow-md disabled:opacity-60"
            >
              <span className="text-xs font-medium text-accent">{s.label}</span>
              <span className="mt-2 text-sm font-medium">{s.subject}</span>
              <span className="text-xs text-ink-500">
                {s.fromName} &lt;{s.fromEmail}&gt;
              </span>
              <span className="mt-2 line-clamp-2 text-sm text-ink-600">{s.preview}</span>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-900 group-hover:text-accent">
                {pending ? <Spinner className="size-3.5" /> : <Send className="size-3.5" aria-hidden />}
                {pending ? 'Sending…' : 'Send this email'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
