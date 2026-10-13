'use client';

import { RotateCcw } from 'lucide-react';
import { useState, useTransition } from 'react';
import { type ActionState, retryLead } from '@/app/actions';
import { Button } from '@/components/ui/button';

export function RetryButton({ leadId }: { leadId: string }) {
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <Button size="sm" loading={pending} onClick={() => start(async () => setState(await retryLead(leadId)))}>
        <RotateCcw className="size-3.5" aria-hidden /> Retry from this step
      </Button>
      {state.error && <span className="text-sm text-red-700">{state.error}</span>}
    </div>
  );
}
