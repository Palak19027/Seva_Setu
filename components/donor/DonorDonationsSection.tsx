import { useState } from 'react';
import { Pencil, PlusCircle, Trash2, Users } from 'lucide-react';
import { CATEGORY_ICONS } from '@/components/donations/category-icons';
import { DonationProgress } from '@/components/donations/DonationProgress';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { DonationStatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { cancelDonation, completeDonation, deleteDonation, releaseDonation } from '@/lib/api/donations';
import { CATEGORIES } from '@/lib/constants';
import { errorMessage, formatDate } from '@/lib/format';
import type { Donation } from '@/lib/types';

type Action = 'delete' | 'cancel' | 'release' | 'complete';

const ACTION_COPY: Record<Action, { title: string; message: string; label: string; tone: 'primary' | 'danger'; run: (id: string) => Promise<void> }> = {
  delete: {
    title: 'Delete this donation?',
    message: 'The donation will be removed from the platform. This cannot be undone.',
    label: 'Delete donation',
    tone: 'danger',
    run: deleteDonation,
  },
  cancel: {
    title: 'Cancel this donation?',
    message: 'NGOs with a pending request will be told that the donation was cancelled.',
    label: 'Cancel donation',
    tone: 'danger',
    run: cancelDonation,
  },
  release: {
    title: 'Make this donation available again?',
    message: 'The reserving NGO will be removed and the donation will be listed again for nearby NGOs. Food past its safe pickup deadline is closed instead.',
    label: 'Release donation',
    tone: 'primary',
    run: releaseDonation,
  },
  complete: {
    title: 'Mark as completed?',
    message: 'Confirm that the donation was delivered as planned. This closes the donation.',
    label: 'Mark completed',
    tone: 'primary',
    run: completeDonation,
  },
};

export function DonorDonationsSection({
  donations,
  requestCounts,
  onEdit,
  onPostNew,
  onChanged,
}: {
  donations: Donation[];
  requestCounts: Record<string, number>;
  onEdit: (donation: Donation) => void;
  onPostNew: () => void;
  onChanged: (message: string) => void;
}) {
  const [pending, setPending] = useState<{ action: Action; donation: Donation } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await ACTION_COPY[pending.action].run(pending.donation.id);
      const doneMessage = {
        delete: 'Donation deleted.',
        cancel: 'Donation cancelled.',
        release: 'Donation is listed again for nearby NGOs.',
        complete: 'Donation marked as completed. Thank you for giving.',
      }[pending.action];
      setPending(null);
      onChanged(doneMessage);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (donations.length === 0) {
    return (
      <EmptyState
        icon={<PlusCircle className="h-6 w-6" aria-hidden />}
        title="You have not posted any donations yet"
        description="Post your first donation and verified NGOs will be able to request it."
        action={<Button onClick={onPostNew} icon={<PlusCircle className="h-4 w-4" />}>Post a donation</Button>}
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {donations.map((donation) => {
          const Icon = CATEGORY_ICONS[donation.category];
          const categoryLabel = CATEGORIES.find((c) => c.value === donation.category)?.label ?? donation.category;
          const requests = requestCounts[donation.id] ?? 0;
          return (
            <article key={donation.id} className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-card transition duration-300 hover:shadow-lift">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary-100 text-primary-600">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-neutral-800">{donation.title}</h3>
                    <p className="mt-0.5 text-sm text-neutral-500">
                      {categoryLabel} · {donation.quantity} {donation.unit} · {donation.city} · Until {formatDate(donation.available_until)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DonationStatusBadge status={donation.status} />
                  {requests > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {requests} request{requests === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <DonationProgress status={donation.status} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                {donation.status === 'AVAILABLE' && (
                  <>
                    <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEdit(donation)}>Edit</Button>
                    <Button size="sm" variant="outline" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setPending({ action: 'delete', donation })}>Delete</Button>
                  </>
                )}
                {['REQUESTED', 'REACTIVATED', 'RESERVED'].includes(donation.status) && (
                  <Button size="sm" variant="outline" onClick={() => setPending({ action: 'cancel', donation })}>Cancel donation</Button>
                )}
                {(donation.status === 'RESERVED' || donation.status === 'PICKUP_SCHEDULED') && (
                  <Button size="sm" variant="outline" onClick={() => setPending({ action: 'release', donation })}>Release to other NGOs</Button>
                )}
                {donation.status === 'DELIVERED' && (
                  <Button size="sm" onClick={() => setPending({ action: 'complete', donation })}>Mark completed</Button>
                )}
                {['CANCELLED', 'EXPIRED', 'RESERVATION_EXPIRED'].includes(donation.status) && (
                  <Button size="sm" variant="outline" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setPending({ action: 'delete', donation })}>Delete</Button>
                )}
                {(donation.status === 'PICKED_UP' || donation.status === 'COMPLETED') && (
                  <p className="text-xs text-neutral-500">
                    {donation.status === 'PICKED_UP' ? 'The receiving organization has collected this donation.' : 'This donation is complete.'}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {pending && (
        <ConfirmDialog
          open
          title={ACTION_COPY[pending.action].title}
          message={ACTION_COPY[pending.action].message}
          confirmLabel={ACTION_COPY[pending.action].label}
          tone={ACTION_COPY[pending.action].tone}
          loading={busy}
          error={error}
          onConfirm={() => void confirm()}
          onCancel={() => {
            setPending(null);
            setError(null);
          }}
        />
      )}
    </>
  );
}
