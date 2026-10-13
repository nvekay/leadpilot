'use client';

import { useActionState } from 'react';
import { type ActionState, saveSettings } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import type { WorkspaceSettings } from '@/lib/types';

export function SettingsForm({ settings }: { settings: WorkspaceSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, {});
  const { icp } = settings;

  return (
    <form action={action} className="mt-6 space-y-8">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Ideal customer</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Minimum budget, USD" hint="+25 at or above, −10 below">
            <input
              name="minBudgetUsd"
              type="number"
              min={0}
              step={500}
              defaultValue={icp.minBudgetUsd}
              className={inputClass}
            />
          </Field>
          <Field label="Minimum company size" hint="+10 at or above">
            <input name="minEmployees" type="number" min={0} defaultValue={icp.minEmployees} className={inputClass} />
          </Field>
          <Field label="Hot lead from score" hint="Highlighted in the inbox">
            <input name="hotScore" type="number" min={0} max={100} defaultValue={icp.hotScore} className={inputClass} />
          </Field>
        </div>
        <Field label="Target countries" hint="ISO codes, comma separated: +10 inside, −5 outside">
          <input name="targetCountries" defaultValue={icp.targetCountries.join(', ')} className={inputClass} />
        </Field>
        <Field label="Services you sell" hint="Comma separated: +20 when the lead asks for one of them">
          <input name="services" defaultValue={icp.services.join(', ')} className={inputClass} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Replies</legend>
        <Field label="Booking link" hint="Every draft invites the lead to book a call here">
          <input name="calendarUrl" type="url" defaultValue={settings.calendarUrl} className={inputClass} />
        </Field>
        <Field label="Signature">
          <textarea name="replySignature" rows={3} defaultValue={settings.replySignature} className={inputClass} />
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={pending}>
          Save settings
        </Button>
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state.ok && <p className="text-sm text-accent">{state.ok}</p>}
      </div>
    </form>
  );
}
