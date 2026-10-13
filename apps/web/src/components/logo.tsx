export function Logo({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect width="24" height="24" rx="6" className="fill-accent" />
        <path d="M6 15.5 12 6l6 9.5h-4l-2-3.2-2 3.2z" fill="#fff" />
        <circle cx="12" cy="18" r="1.4" fill="#fff" />
      </svg>
      <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>LeadPilot</span>
    </span>
  );
}
