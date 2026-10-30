import type { ReactNode } from 'react';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-neutral-700">
        {label}
        {required && <span className="ml-0.5 text-error-600">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-error-600" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}
