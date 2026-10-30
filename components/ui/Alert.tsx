import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

type Tone = 'success' | 'error' | 'info' | 'warning';

const tones: Record<Tone, { box: string; icon: typeof Info }> = {
  success: { box: 'border-success-100 bg-success-50 text-success-700', icon: CheckCircle2 },
  error: { box: 'border-error-100 bg-error-50 text-error-700', icon: XCircle },
  info: { box: 'border-primary-100 bg-primary-50 text-primary-800', icon: Info },
  warning: { box: 'border-warning-100 bg-warning-50 text-warning-700', icon: AlertTriangle },
};

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-up ${box}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
