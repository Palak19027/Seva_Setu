export type AccountRole = 'individual' | 'business' | 'organization' | 'admin';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'not_required';

export type DonationCategory =
  | 'food'
  | 'clothes'
  | 'books'
  | 'toys'
  | 'stationery'
  | 'groceries'
  | 'footwear'
  | 'household'
  | 'others';

export type DonationStatus =
  | 'AVAILABLE'
  | 'REQUESTED'
  | 'RESERVED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'RESERVATION_EXPIRED'
  | 'REACTIVATED'
  | 'CANCELLED'
  | 'EXPIRED';

export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export type BadgeKey = 'first_donation' | 'verified_social_impact_partner' | 'hundred_meals';

export type DonorLevel = 'Bronze' | 'Silver' | 'Gold';

export interface NearbyAlert {
  id: string;
  donation_id: string;
  distance_km: number;
  radius_km: number;
  created_at: string;
  donations: Donation | null;
}

export interface DonorFeedbackItem {
  org_name: string;
  donation_title: string;
  food_quality: number | null;
  timely_pickup: number | null;
  overall_experience: number | null;
  written_appreciation: string;
  created_at: string;
}

export interface DonorProfileData {
  donor_id: string;
  name: string;
  role: AccountRole;
  city: string;
  address: string;
  total_donations: number;
  completed_donations: number;
  meals_contributed: number;
  points: number;
  level: DonorLevel;
  average_rating: number | null;
  social_impact_score: number;
  badges: { key: BadgeKey; awarded_at: string }[];
  certificates: { milestone: number; issued_at: string }[];
  feedback: DonorFeedbackItem[];
}

export interface TopContributor {
  donor_id: string;
  donor_name: string;
  city: string;
  points: number;
  level: DonorLevel;
  completed_donations: number;
  meals_contributed: number;
}

export interface MonthlyImpact {
  month_start: string;
  donations_posted: number;
  completed: number;
  meals: number;
}

export interface MonitoringSummary {
  total_food_donations: number;
  active_reservations: number;
  expired_reservations: number;
  reactivated_donations: number;
  successful_pickups: number;
  nearing_expiry: number;
  meals_saved: number;
  verified_ngos: number;
  participating_ngos: number;
  top_hotel_donors: { name: string; city: string; completed: number; meals: number; points: number }[];
  expiring_soon: { id: string; title: string; donor_name: string; status: DonationStatus; deadline: string }[];
}

export interface PlatformSettings {
  notification_radius_km: number;
  reservation_minutes: number;
}

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair';

export type FoodVegType = 'vegetarian' | 'non_vegetarian';

export interface Profile {
  id: string;
  role: AccountRole;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  org_type: string;
  registration_number: string;
  contact_person: string;
  address: string;
  city: string;
  verification_status: VerificationStatus;
  verification_document_path: string | null;
  latitude: number | null;
  longitude: number | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Donation {
  id: string;
  donor_id: string;
  donor_name: string;
  donor_type: AccountRole;
  title: string;
  category: DonationCategory;
  description: string;
  quantity: number;
  unit: string;
  item_condition: ItemCondition;
  image_paths: string[];
  pickup_address: string;
  city: string;
  available_until: string;
  contact_info: string;
  food_prepared_at: string | null;
  food_veg_type: FoodVegType | null;
  food_storage_conditions: string | null;
  food_allergen_info: string | null;
  safe_pickup_deadline: string | null;
  status: DonationStatus;
  accepted_request_id: string | null;
  pickup_scheduled_for: string | null;
  latitude: number | null;
  longitude: number | null;
  reservation_expires_at: string | null;
  reactivation_count: number;
  created_at: string;
  updated_at: string;
}

export type PublicDonation = Omit<
  Donation,
  | 'donor_id'
  | 'pickup_address'
  | 'contact_info'
  | 'food_storage_conditions'
  | 'food_allergen_info'
  | 'accepted_request_id'
  | 'pickup_scheduled_for'
  | 'updated_at'
>;

export interface DonationRequest {
  id: string;
  donation_id: string;
  org_id: string;
  org_name: string;
  org_type: string;
  message: string;
  status: RequestStatus;
  created_at: string;
}

export interface DonationHistoryEntry {
  id: string;
  donation_id: string;
  from_status: DonationStatus | null;
  to_status: DonationStatus;
  note: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  donation_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  donation_id: string;
  reporter_id: string;
  reason: 'spam' | 'wrong_information' | 'unsafe' | 'other';
  details: string;
  status: 'OPEN' | 'RESOLVED';
  created_at: string;
}
