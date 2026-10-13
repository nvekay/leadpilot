export const inputClass =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-ink-400 hover:border-ink-300 focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:opacity-60';

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-500">{hint}</span>}
    </label>
  );
}
