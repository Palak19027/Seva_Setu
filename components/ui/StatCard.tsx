import type { ReactNode } from 'react';

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'primary',
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'primary' | 'accent' | 'success' | 'warning';
}) {
  const tones = {
    primary: 'bg-secondary-100 text-primary-700',
    accent: 'bg-accent-50 text-accent-600',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
  };
  return (
    <div className="group rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105 ${tones[tone]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
