'use client';

import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong shadow-sm',
  secondary: 'border border-ink-200 bg-white text-ink-900 hover:border-ink-300 hover:bg-ink-50 shadow-sm',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  danger: 'border border-ink-200 bg-white text-red-700 hover:border-red-200 hover:bg-red-50 shadow-sm',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-md px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-lg px-4 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks clicks while an action runs */
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors select-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  );
}
