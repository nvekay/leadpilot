'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import type { WorkspaceSettings } from '@/lib/types';

export interface ActionState {
  error?: string;
  ok?: string;
}

// The public demo has no accounts; actions are recorded as taken in the web app
const BY = 'web';

const fail = (e: unknown): ActionState => ({
  error:
    e instanceof ApiError && e.status === 409
      ? 'Someone already handled this lead.'
      : 'Something went wrong, try again.',
});

export async function approveLead(id: string, text: string): Promise<ActionState> {
  try {
    await api.approve(id, BY, text);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/leads/${id}`);
  return { ok: 'Approved. Sending the reply…' };
}

export async function rejectLead(id: string): Promise<ActionState> {
  try {
    await api.reject(id, BY);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/leads/${id}`);
  return { ok: 'Rejected.' };
}

export async function retryLead(id: string): Promise<ActionState> {
  try {
    await api.retry(id, BY);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/leads/${id}`);
  return { ok: 'Retrying…' };
}

/** Public demo: sends a sample email into the pipeline and opens it */
export async function sendSample(sampleId: string) {
  const { id } = await api.sendDemo(sampleId);
  redirect(`/leads/${id}`);
}

const formSchema = z.object({
  submissionId: z.uuid(),
  name: z.string().trim().min(1, 'Enter your name').max(200),
  email: z.email('Enter a valid email'),
  company: z.string().trim().max(200).optional(),
  message: z.string().trim().min(20, 'Tell us a bit more (20+ characters)').max(5000),
});

/** Public demo: the agency's "Get a quote" form */
export async function submitQuoteForm(_prev: ActionState, data: FormData): Promise<ActionState> {
  const parsed = formSchema.safeParse({
    submissionId: data.get('submissionId') || randomUUID(),
    name: data.get('name'),
    email: data.get('email'),
    company: data.get('company') || undefined,
    message: data.get('message'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };
  let id: string;
  try {
    ({ id } = await api.submitForm(parsed.data));
  } catch {
    return { error: 'Could not send the form, try again.' };
  }
  redirect(`/leads/${id}`);
}

/** A text field from a form; files and missing fields become an empty string */
const text = (data: FormData, key: string) => {
  const v = data.get(key);
  return typeof v === 'string' ? v : '';
};

export async function saveSettings(_prev: ActionState, data: FormData): Promise<ActionState> {
  const list = (key: string) =>
    text(data, key)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const settings: WorkspaceSettings = {
    icp: {
      minBudgetUsd: Number(data.get('minBudgetUsd')),
      minEmployees: Number(data.get('minEmployees')),
      hotScore: Number(data.get('hotScore')),
      targetCountries: list('targetCountries').map((c) => c.toUpperCase()),
      services: list('services'),
    },
    calendarUrl: text(data, 'calendarUrl'),
    replySignature: text(data, 'replySignature'),
  };
  try {
    await api.saveSettings(settings);
  } catch (e) {
    return { error: e instanceof ApiError && e.status === 400 ? `Check the values: ${e.message}` : 'Could not save.' };
  }
  revalidatePath('/', 'layout');
  return { ok: 'Saved. New leads are scored with these rules.' };
}
