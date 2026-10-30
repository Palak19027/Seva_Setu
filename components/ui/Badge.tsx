import type { ReactNode } from 'react';
import { DONATION_STATUS_META, REQUEST_STATUS_META, VERIFICATION_META } from '@/lib/constants';
import type { DonationStatus, RequestStatus, VerificationStatus } from '@/lib/types';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  info: 'bg-primary-50 text-primary-700 ring-primary-100',
  primary: 'bg-secondary-100 text-primary-700 ring-primary-100',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warning: 'bg-warning-50 text-warning-700 ring-warning-100',
  danger: 'bg-error-50 text-error-700 ring-error-100',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function DonationStatusBadge({ status }: { status: DonationStatus }) {
  const meta = DONATION_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const meta = REQUEST_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const meta = VERIFICATION_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
