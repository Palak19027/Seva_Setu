import type {
  AccountRole,
  BadgeKey,
  DonationCategory,
  DonationStatus,
  DonorLevel,
  ItemCondition,
  RequestStatus,
  VerificationStatus,
} from '@/lib/types';

export const CATEGORIES: { value: DonationCategory; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'clothes', label: 'Clothes' },
  { value: 'books', label: 'Books' },
  { value: 'toys', label: 'Toys' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'household', label: 'Household Essentials' },
  { value: 'others', label: 'Others' },
];

export const CONDITIONS: { value: ItemCondition; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

export const ORGANIZATION_TYPES = [
  'NGO',
  'Ashram',
  'Orphanage',
  'Old-age home',
  'Charitable trust',
  'Shelter home',
  'Other',
];

export const BUSINESS_TYPES = ['Hotel', 'Restaurant', 'Caterer', 'Retail store', 'Company', 'Other'];

export const DONATION_STATUS_META: Record<DonationStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary' }> = {
  AVAILABLE: { label: 'Available', tone: 'primary' },
  REQUESTED: { label: 'Requested', tone: 'info' },
  RESERVED: { label: 'Reserved', tone: 'info' },
  PICKUP_SCHEDULED: { label: 'Pickup scheduled', tone: 'warning' },
  PICKED_UP: { label: 'Picked up', tone: 'warning' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  RESERVATION_EXPIRED: { label: 'Reservation expired', tone: 'danger' },
  REACTIVATED: { label: 'Available again', tone: 'primary' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'danger' },
};

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary' }> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  ACCEPTED: { label: 'Accepted', tone: 'success' },
  REJECTED: { label: 'Declined', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'danger' },
};

export const RADIUS_OPTIONS_KM = [5, 10, 15] as const;

export const BADGE_META: Record<BadgeKey, { label: string; description: string }> = {
  first_donation: { label: 'First Donation', description: 'Completed your first donation.' },
  verified_social_impact_partner: { label: 'Verified Social Impact Partner', description: 'A business that has completed donations through SevaSetu.' },
  hundred_meals: { label: '100 Meals Club', description: 'Helped deliver at least 100 meals.' },
};

export const LEVEL_META: Record<DonorLevel, { label: string; threshold: number; tone: 'warning' | 'neutral' | 'accent' }> = {
  Bronze: { label: 'Bronze', threshold: 0, tone: 'neutral' },
  Silver: { label: 'Silver', threshold: 100, tone: 'neutral' },
  Gold: { label: 'Gold', threshold: 300, tone: 'warning' },
};

export const VERIFICATION_META: Record<VerificationStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary' }> = {
  pending: { label: 'Awaiting review', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Declined', tone: 'danger' },
  not_required: { label: 'Not required', tone: 'neutral' },
};

export const ROLE_LABELS: Record<AccountRole, string> = {
  individual: 'Individual donor',
  business: 'Business donor',
  organization: 'Receiving organization',
  admin: 'Administrator',
};

export const DONOR_ROLES: AccountRole[] = ['individual', 'business'];

export const OPEN_STATUSES: DonationStatus[] = ['AVAILABLE', 'REQUESTED', 'REACTIVATED'];

export const ACTIVE_STATUSES: DonationStatus[] = [
  'AVAILABLE',
  'REQUESTED',
  'RESERVED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'DELIVERED',
  'REACTIVATED',
];

export const RESERVED_STATUSES: DonationStatus[] = ['RESERVED', 'PICKUP_SCHEDULED'];
