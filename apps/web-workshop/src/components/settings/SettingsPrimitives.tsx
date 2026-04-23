'use client';

import { cn } from '@mecanix/ui-web';
import { AlertTriangle, Check, Loader2, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export function SettingsPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SettingsSection({
  title,
  description,
  children,
  footer,
  sensitivity,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Visual cue — hints how serious this setting is without changing the form's behaviour.
   * cosmetic (default): neutral; operational: subtle blue; financial: amber; security: red.
   */
  sensitivity?: 'cosmetic' | 'operational' | 'financial' | 'security';
}) {
  const accent = {
    cosmetic: 'border-gray-200',
    operational: 'border-gray-200',
    financial: 'border-amber-200',
    security: 'border-red-200',
  }[sensitivity ?? 'cosmetic'];

  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border bg-white shadow-sm',
        accent,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-gray-500">{description}</p>
          )}
        </div>
        {sensitivity === 'financial' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            Financial
          </span>
        )}
        {sensitivity === 'security' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-red-700">
            <ShieldAlert className="h-3 w-3" />
            Security
          </span>
        )}
      </div>
      <div className="px-6 py-6">
        <div className="space-y-6">{children}</div>
      </div>
      {footer && (
        <div className="flex items-center justify-between gap-4 border-t border-gray-100 bg-gray-50/50 px-6 py-3">
          {footer}
        </div>
      )}
    </section>
  );
}

export function SettingsField({
  label,
  description,
  htmlFor,
  children,
  required,
  hint,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  hint?: ReactNode;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[220px_1fr] md:gap-8">
      <div>
        <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-900">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{description}</p>
        )}
      </div>
      <div className="min-w-0 space-y-1.5">
        {children}
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    </div>
  );
}

export function SettingsFooter({
  saved,
  error,
  saving,
  savedAt,
  children,
}: {
  saved?: boolean;
  error?: string;
  saving?: boolean;
  savedAt?: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        {error ? (
          <p className="truncate text-xs text-red-600">{error}</p>
        ) : saving ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </p>
        ) : saved ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
            <Check className="h-3 w-3" />
            Saved {savedAt ? `· ${savedAt}` : ''}
          </p>
        ) : (
          <span />
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">{children}</div>
    </>
  );
}

export function DangerZone({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-red-200 bg-red-50/40">
      <div className="border-b border-red-200 px-6 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-red-900">
          <ShieldAlert className="h-4 w-4" />
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-red-700">{description}</p>
        )}
      </div>
      <div className="space-y-4 bg-white/70 px-6 py-5">{children}</div>
    </section>
  );
}

export function ComingSoon({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50">
      <div className="max-w-md px-6 text-center">
        <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <Loader2 className="h-4 w-4" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{description}</p>
        )}
      </div>
    </div>
  );
}
