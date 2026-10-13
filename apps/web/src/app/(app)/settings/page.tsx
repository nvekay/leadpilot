import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const settings = await api.settings();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-ink-500">
        Scoring is plain rules, not AI: the model only extracts facts, and these settings decide how many points they
        are worth. Changes apply to new leads.
      </p>
      <SettingsForm settings={settings} />
    </div>
  );
}
