import { Check, X } from 'lucide-react';
import type { DonationStatus } from '@/lib/types';
import { DONATION_STATUS_META } from '@/lib/constants';

const STEPS: { key: string; label: string; statuses: DonationStatus[] }[] = [
  { key: 'listed', label: 'Listed', statuses: ['AVAILABLE', 'REQUESTED', 'REACTIVATED'] },
  { key: 'reserved', label: 'Reserved', statuses: ['RESERVED'] },
  { key: 'scheduled', label: 'Pickup scheduled', statuses: ['PICKUP_SCHEDULED'] },
  { key: 'picked', label: 'Picked up', statuses: ['PICKED_UP'] },
  { key: 'delivered', label: 'Delivered', statuses: ['DELIVERED'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
];

const TERMINAL: DonationStatus[] = ['CANCELLED', 'EXPIRED', 'RESERVATION_EXPIRED'];

export function DonationProgress({ status }: { status: DonationStatus }) {
  const terminal = TERMINAL.includes(status);
  const current = STEPS.findIndex((step) => step.statuses.includes(status));

  if (terminal) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-600">
        <X className="h-3.5 w-3.5" aria-hidden />
        {DONATION_STATUS_META[status].label}
      </div>
    );
  }

  return (
    <div>
      <ol className="flex items-center gap-1" aria-label={`Status: ${DONATION_STATUS_META[status].label}`}>
        {STEPS.map((step, index) => {
          const done = current >= index;
          const passed = current > index;
          return (
            <li key={step.key} className="flex flex-1 items-center gap-1">
              <span
                title={step.label}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition ${
                  done ? 'bg-primary-600 text-white' : 'bg-neutral-200 text-neutral-500'
                }`}
              >
                {passed ? <Check className="h-3 w-3" aria-hidden /> : index + 1}
              </span>
              {index < STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded ${passed ? 'bg-primary-600' : 'bg-neutral-200'}`} />}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs font-medium text-neutral-600">
        Current step: {DONATION_STATUS_META[status].label}
      </p>
    </div>
  );
}
