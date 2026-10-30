import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Field } from '@/components/ui/Field';
import { requestDonation } from '@/lib/api/donations';
import { errorMessage, formatDate } from '@/lib/format';
import { inputClass } from '@/lib/site';
import type { PublicDonation } from '@/lib/types';

export function RequestDonationModal({
  donation,
  onClose,
  onRequested,
}: {
  donation: PublicDonation | null;
  onClose: () => void;
  onRequested: (donation: PublicDonation) => void;
}) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const close = () => {
    if (submitting) return;
    setMessage('');
    setError(null);
    setMessageError(null);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!donation) return;
    if (message.trim().length > 500) {
      setMessageError('Keep your message under 500 characters.');
      return;
    }
    setError(null);
    setMessageError(null);
    setSubmitting(true);
    try {
      await requestDonation(donation.id, message.trim());
      setSubmitting(false);
      setMessage('');
      onRequested(donation);
    } catch (err) {
      setSubmitting(false);
      setError(errorMessage(err, 'We could not send your request. Please try again.'));
    }
  };

  return (
    <Modal
      open={!!donation}
      title="Request this donation"
      onClose={close}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="request-donation-form" loading={submitting}>Send request</Button>
        </>
      }
    >
      {donation && (
        <form id="request-donation-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl bg-secondary-50 p-4 text-sm">
            <p className="font-bold text-neutral-800">{donation.title}</p>
            <p className="mt-1 text-neutral-600">
              {donation.quantity} {donation.unit} from {donation.donor_name}, {donation.city}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Available until {formatDate(donation.available_until)}</p>
          </div>
          <Field label="Message to the donor" htmlFor="request-message" hint="Optional. Introduce your organization and when you can collect." error={messageError ?? undefined}>
            <textarea id="request-message" rows={4} className={inputClass} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
        </form>
      )}
    </Modal>
  );
}
