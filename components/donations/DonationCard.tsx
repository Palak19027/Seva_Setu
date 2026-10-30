import { Clock, MapPin, Package, Image as ImageIcon, UserRound } from 'lucide-react';
import { CATEGORY_ICONS } from '@/components/donations/category-icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CATEGORIES, CONDITIONS, ROLE_LABELS } from '@/lib/constants';
import { donationImageUrl } from '@/lib/api/storage';
import { formatDate, isPast } from '@/lib/format';
import type { PublicDonation } from '@/lib/types';

export function isDonationOpen(donation: PublicDonation): boolean {
  if (!['AVAILABLE', 'REQUESTED', 'REACTIVATED'].includes(donation.status)) return false;
  if (isPast(donation.available_until)) return false;
  if (donation.category === 'food' && isPast(donation.safe_pickup_deadline)) return false;
  return true;
}

function availabilityLabel(donation: PublicDonation, requestedByMe: boolean): { text: string; tone: 'success' | 'warning' | 'neutral' | 'info' } {
  if (requestedByMe) return { text: 'You requested this', tone: 'info' };
  if (donation.status === 'REQUESTED') return { text: 'Requested by an NGO', tone: 'warning' };
  if (!isDonationOpen(donation)) return { text: 'Closed', tone: 'neutral' };
  return { text: 'Available', tone: 'success' };
}

const LABEL_TONE = { success: 'success', warning: 'warning', neutral: 'neutral', info: 'info' } as const;

export function DonationCard({
  donation,
  requestedByMe,
  canRequest,
  onRequest,
}: {
  donation: PublicDonation;
  requestedByMe: boolean;
  canRequest: boolean;
  onRequest: (donation: PublicDonation) => void;
}) {
  const CategoryIcon = CATEGORY_ICONS[donation.category];
  const categoryLabel = CATEGORIES.find((c) => c.value === donation.category)?.label ?? donation.category;
  const conditionLabel = CONDITIONS.find((c) => c.value === donation.item_condition)?.label ?? donation.item_condition;
  const availability = availabilityLabel(donation, requestedByMe);
  const open = isDonationOpen(donation);
  const cover = donation.image_paths[0];

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[16/10] overflow-hidden bg-secondary-100">
        {cover ? (
          <img src={donationImageUrl(cover)} alt={donation.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary-300">
            <ImageIcon className="h-10 w-10" aria-hidden />
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-primary-700 shadow-sm">
          <CategoryIcon className="h-3.5 w-3.5" aria-hidden />
          {categoryLabel}
        </span>
        <span className="absolute right-3 top-3">
          <Badge tone={LABEL_TONE[availability.tone]}>{availability.text}</Badge>
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-neutral-800">{donation.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-neutral-500">{donation.description || 'No description provided.'}</p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-neutral-600">
            <Package className="h-4 w-4 text-primary-600" aria-hidden />
            <span className="truncate">{donation.quantity} {donation.unit}</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-600">
            <MapPin className="h-4 w-4 text-primary-600" aria-hidden />
            <span className="truncate">{donation.city}</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-600">
            <UserRound className="h-4 w-4 text-primary-600" aria-hidden />
            <span className="truncate">{donation.donor_name}</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-600">
            <Clock className="h-4 w-4 text-primary-600" aria-hidden />
            <span className="truncate">Until {formatDate(donation.available_until)}</span>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="primary">{conditionLabel}</Badge>
          <Badge tone="neutral">{ROLE_LABELS[donation.donor_type]}</Badge>
          {donation.food_veg_type && <Badge tone="success">{donation.food_veg_type === 'vegetarian' ? 'Vegetarian' : 'Non-vegetarian'}</Badge>}
        </div>

        {donation.category === 'food' && donation.safe_pickup_deadline && (
          <p className="mt-3 text-xs font-medium text-warning-700">Safe pickup by {formatDate(donation.safe_pickup_deadline)}</p>
        )}

        {canRequest && (
          <div className="mt-5 pt-1">
            <Button fullWidth disabled={!open || requestedByMe} onClick={() => onRequest(donation)} variant={requestedByMe ? 'secondary' : 'primary'}>
              {requestedByMe ? 'Request sent' : open ? 'Request donation' : 'Unavailable'}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
