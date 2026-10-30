import { useEffect, useState, type FormEvent } from 'react';
import { Star } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { fetchDonationFeedback, submitNgoFeedback, type NgoFeedbackRow } from '@/lib/api/donations';
import { errorMessage, formatDateTime } from '@/lib/format';
import type { Donation } from '@/lib/types';

interface NgoFeedbackModalProps {
  donation: Donation | null;
  onClose: () => void;
  onSubmitted: () => void;
}

type RatingKey = 'foodQuality' | 'timelyPickup' | 'overallExperience';

const RATING_FIELDS: { key: RatingKey; label: string }[] = [
  { key: 'foodQuality', label: 'Food quality' },
  { key: 'timelyPickup', label: 'Timely pickup' },
  { key: 'overallExperience', label: 'Overall experience' },
];

const textareaClass =
  'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-800 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

function RatingInput({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm font-semibold text-neutral-700">{label}</span>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => {
          const active = value !== null && score <= value;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={value === score}
              aria-label={`${score} of 5`}
              onClick={() => onChange(value === score ? null : score)}
              className="rounded-md p-1 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Star className={`h-6 w-6 ${active ? 'fill-accent-400 text-accent-500' : 'text-neutral-300'}`} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NgoFeedbackModal({ donation, onClose, onSubmitted }: NgoFeedbackModalProps) {
  const donationId = donation?.id ?? null;
  const [existing, setExisting] = useState<NgoFeedbackRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [ratings, setRatings] = useState<Record<RatingKey, number | null>>({
    foodQuality: null,
    timelyPickup: null,
    overallExperience: null,
  });
  const [appreciation, setAppreciation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!donationId) return;
    setRatings({ foodQuality: null, timelyPickup: null, overallExperience: null });
    setAppreciation('');
    setError(null);
    setExisting(null);
    setLoading(true);
    fetchDonationFeedback(donationId)
      .then((row) => setExisting(row))
      .catch((err) => setError(errorMessage(err, 'Your earlier feedback could not be checked.')))
      .finally(() => setLoading(false));
  }, [donationId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!donation) return;
    const hasRating = Object.values(ratings).some((value) => value !== null);
    if (!hasRating) {
      setError('Rate at least one area before sending feedback.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitNgoFeedback({
        donationId: donation.id,
        foodQuality: ratings.foodQuality,
        timelyPickup: ratings.timelyPickup,
        overallExperience: ratings.overallExperience,
        writtenAppreciation: appreciation.trim(),
      });
      onSubmitted();
    } catch (err) {
      setError(errorMessage(err, 'Your feedback could not be sent.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={donation !== null} title={`Share feedback for ${donation?.donor_name ?? 'the donor'}`} onClose={onClose}>
      {loading && <p className="text-sm text-neutral-600">Checking for earlier feedback...</p>}

      {!loading && existing && (
        <div className="space-y-3">
          <Alert tone="success">You already sent feedback for this donation on {formatDateTime(existing.created_at)}.</Alert>
          {existing.written_appreciation && (
            <p className="rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700">{existing.written_appreciation}</p>
          )}
        </div>
      )}

      {!loading && !existing && donation && (
        <form onSubmit={submit} className="space-y-6">
          <p className="text-sm text-neutral-600">
            Rate only what you experienced. Leave an area blank if you have no view on it. At least one rating is required.
          </p>
          <div className="space-y-4">
            {RATING_FIELDS.map((field) => (
              <RatingInput
                key={field.key}
                label={field.label}
                value={ratings[field.key]}
                onChange={(value) => setRatings((previous) => ({ ...previous, [field.key]: value }))}
              />
            ))}
          </div>
          <Field label="Written appreciation" htmlFor="ngo-feedback-text" hint="Optional. Tell the donor what the food meant to your community.">
            <textarea
              id="ngo-feedback-text"
              rows={4}
              maxLength={1000}
              className={textareaClass}
              value={appreciation}
              onChange={(event) => setAppreciation(event.target.value)}
            />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={submitting}>Send feedback</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
