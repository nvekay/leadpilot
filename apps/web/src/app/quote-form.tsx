'use client';

import { useActionState, useState } from 'react';
import { type ActionState, submitQuoteForm } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';

/** The fictional agency's contact form; a double submit is one lead thanks to the submission id */
export function QuoteForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitQuoteForm, {});
  const [submissionId] = useState(() => crypto.randomUUID());

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="submissionId" value={submissionId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" required maxLength={200} autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Work email" hint="Not emailed: demo replies go to a test inbox">
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
      </div>
      <Field label="Company (optional)">
        <input name="company" maxLength={200} autoComplete="organization" className={inputClass} />
      </Field>
      <Field label="What do you need built?" hint="Mention a budget, timeline or country and watch the score change">
        <textarea
          name="message"
          required
          minLength={20}
          rows={5}
          className={inputClass}
          placeholder="We're a 40-person logistics company in Chicago. We need a customer portal to track shipments. Budget around $25k, launch in March."
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={pending}>
          Get a quote
        </Button>
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}
