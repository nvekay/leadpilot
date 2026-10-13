import 'server-only';
import type { LeadStatus } from '@leadpilot/shared';
import { env } from './env';
import type { DemoSample, Lead, LeadEvent, QueueOverview, WorkspaceSettings } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { API_URL, API_INTERNAL_KEY } = env();
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'x-api-key': API_INTERNAL_KEY, 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, detail.message ?? `API ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Calls the LeadPilot API from the web server; the internal key never reaches the browser */
export const api = {
  leads: (status?: LeadStatus[]) => call<Lead[]>(`/leads${status?.length ? `?status=${status.join(',')}` : ''}`),
  counts: () => call<Partial<Record<LeadStatus, number>>>('/leads/counts'),
  lead: (id: string) => call<{ lead: Lead; events: LeadEvent[] }>(`/leads/${id}`),
  approve: (id: string, by: string, text?: string) =>
    call<Lead>(`/leads/${id}/approve`, { method: 'POST', body: { by, text } }),
  reject: (id: string, by: string, reason?: string) =>
    call<Lead>(`/leads/${id}/reject`, { method: 'POST', body: { by, reason } }),
  retry: (id: string, by: string) => call<Lead>(`/leads/${id}/retry`, { method: 'POST', body: { by } }),
  queue: () => call<QueueOverview>('/queue'),
  settings: () => call<WorkspaceSettings>('/settings'),
  saveSettings: (s: WorkspaceSettings) => call<WorkspaceSettings>('/settings', { method: 'PUT', body: s }),
  demoSamples: () => call<DemoSample[]>('/intake/demo'),
  sendDemo: (sampleId: string) => call<{ id: string }>('/intake/demo', { method: 'POST', body: { sampleId } }),
  submitForm: (form: { submissionId: string; name: string; email: string; company?: string; message: string }) =>
    call<{ id: string; duplicate: boolean }>('/intake/form', { method: 'POST', body: form }),
};
