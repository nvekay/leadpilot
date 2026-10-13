'use client';

import { Send } from 'lucide-react';
import { useState, useTransition } from 'react';
import { sendSample } from '@/app/actions';
import { Spinner } from '@/components/ui/spinner';
import type { DemoSample } from '@/lib/types';

/** One card per sample email; sending opens the lead so the visitor can watch the pipeline */
export function SampleCards({ samples }: { samples: DemoSample[] }) {
  const [pendingId, setPendingId] = useState<string>();
  const [error, setError] = useState<string>();
  const [, start] = useTransition();

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
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
                  setError(undefined);
                  start(async () => {
                    // On success the action redirects to the lead; it only returns when the lead was refused
                    const result = await sendSample(s.id);
                    setError(result.error);
                    setPendingId(undefined);
                  });
                }}
                className="group flex h-full w-full flex-col rounded-xl border border-ink-200 bg-white p-4 text-left shadow-sm transition hover:border-accent hover:shadow-md disabled:opacity-60"
              >
                <span className="text-xs font-medium text-accent">{s.label}</span>
                <span className="mt-2 text-sm font-medium">{s.subject}</span>
                <span className="text-xs break-all text-ink-500">
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
    </div>
  );
}
