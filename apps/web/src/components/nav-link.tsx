'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({
  href,
  match = [],
  children,
}: {
  href: string;
  /** Other path prefixes that count as this section (e.g. /leads for the inbox) */
  match?: string[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const active = [href, ...match].some((p) => path === p || path.startsWith(`${p}/`));
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
        active ? 'bg-ink-100 font-medium text-ink-900' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
      }`}
    >
      {children}
    </Link>
  );
}
