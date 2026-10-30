import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Field } from '@/components/ui/Field';
import { schedulePickup } from '@/lib/api/donations';
import { errorMessage, formatDateTime } from '@/lib/format';
import { inputClass } from '@/lib/site';
import type { Donation } from '@/lib/types';

export function SchedulePickupModal({
  donation,
  onClose,
  onScheduled,
}: {
  donation: Donation | null;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [when, setWhen] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    setWhen('');
    setError(null);
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!donation) return;
    const date = new Date(when);
    if (!when || Number.isNaN(date.getTime())) {
      setError('Choose a pickup date and time.');
      return;
    }
    if (date.getTime() <= Date.now()) {
      setError('The pickup time must be in the future.');
      return;
    }
    if (donation.safe_pickup_deadline && date.getTime() > new Date(donation.safe_pickup_deadline).getTime()) {
      setError(`Food must be collected before ${formatDateTime(donation.safe_pickup_deadline)}.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await schedulePickup(donation.id, date.toISOString());
      setSubmitting(false);
      setWhen('');
      onScheduled();
    } catch (err) {
      setSubmitting(false);
      setError(errorMessage(err, 'The pickup could not be scheduled. Please try again.'));
    }
  };

  return (
    <Modal
      open={!!donation}
      title="Schedule pickup"
      onClose={close}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="schedule-pickup-form" loading={submitting}>Confirm schedule</Button>
        </>
      }
    >
      {donation && (
        <form id="schedule-pickup-form" onSubmit={submit} className="space-y-5">
          <div className="rounded-xl bg-secondary-50 p-4 text-sm">
            <p className="font-bold text-neutral-800">{donation.title}</p>
            <p className="mt-1 text-neutral-600">{donation.pickup_address}, {donation.city}</p>
            <p className="mt-1 text-neutral-600">Contact: {donation.contact_info}</p>
            {donation.safe_pickup_deadline && (
              <p className="mt-2 font-semibold text-warning-700">Safe pickup deadline: {formatDateTime(donation.safe_pickup_deadline)}</p>
            )}
          </div>
          <Field label="Pickup date and time" htmlFor="pickup-when" required>
            <input id="pickup-when" type="datetime-local" className={inputClass} value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
        </form>
      )}
    </Modal>
  );
}
