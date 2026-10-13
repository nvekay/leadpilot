import { CodeXml, Inbox, ListChecks, Settings, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { NavLink } from '@/components/nav-link';
import { api } from '@/lib/api';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [counts, queue] = await Promise.all([api.counts(), api.queue()]);
  const waiting = counts.awaiting_approval ?? 0;
  const failed = counts.failed ?? 0;

  const nav = (
    <>
      <NavLink href="/inbox" match={['/leads']}>
        <Inbox className="size-4" aria-hidden /> Inbox
        {waiting > 0 && (
          <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-900">{waiting}</span>
        )}
      </NavLink>
      <NavLink href="/queue">
        <ListChecks className="size-4" aria-hidden /> Queue
        {(failed > 0 || queue.counts.failed > 0) && (
          <span className="ml-auto rounded-full bg-red-100 px-1.5 text-xs font-medium text-red-800">
            {Math.max(failed, queue.counts.failed)}
          </span>
        )}
      </NavLink>
      <NavLink href="/settings">
        <Settings className="size-4" aria-hidden /> Settings
      </NavLink>
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-ink-200 bg-ink-50/60 px-3 py-4 md:flex">
        <Link href="/" className="px-2.5">
          <Logo />
        </Link>
        <nav className="mt-6 flex flex-col gap-0.5">{nav}</nav>
        <div className="mt-auto flex flex-col gap-0.5 border-t border-ink-200 pt-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:text-ink-900"
          >
            <Sparkles className="size-4" aria-hidden /> Send a test lead
          </Link>
          <a
            href="https://github.com/nvekay/leadpilot"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:text-ink-900"
          >
            <CodeXml className="size-4" aria-hidden /> Source code
          </a>
        </div>
      </aside>

      <header className="flex items-center gap-1 overflow-x-auto border-b border-ink-200 px-4 py-2 md:hidden">
        <Link href="/" className="mr-2">
          <Logo compact />
        </Link>
        {nav}
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
