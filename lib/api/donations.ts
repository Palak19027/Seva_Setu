import { supabase } from '@/lib/supabase';
import type {
  Donation,
  DonationHistoryEntry,
  DonationRequest,
  NearbyAlert,
  PublicDonation,
} from '@/lib/types';

export interface DonationInput {
  title: string;
  category: Donation['category'];
  description: string;
  quantity: number;
  unit: string;
  item_condition: Donation['item_condition'];
  image_paths: string[];
  pickup_address: string;
  city: string;
  available_until: string;
  contact_info: string;
  latitude: number | null;
  longitude: number | null;
  food_prepared_at: string | null;
  food_veg_type: Donation['food_veg_type'];
  food_storage_conditions: string | null;
  food_allergen_info: string | null;
  safe_pickup_deadline: string | null;
}

export interface DonationRequestWithDonation extends DonationRequest {
  donations: Donation | null;
}

export interface HistoryWithDonation extends DonationHistoryEntry {
  donations: { title: string } | null;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function fetchMyDonations(donorId: string): Promise<Donation[]> {
  return unwrap(
    await supabase.from('donations').select('*').eq('donor_id', donorId).order('created_at', { ascending: false })
  ) as Donation[];
}

export async function fetchDonationById(id: string): Promise<Donation | null> {
  return unwrap(await supabase.from('donations').select('*').eq('id', id).maybeSingle()) as Donation | null;
}

export async function fetchPublicDonations(): Promise<PublicDonation[]> {
  return unwrap(await supabase.rpc('list_public_donations')) as PublicDonation[];
}

export async function fetchAllDonations(): Promise<Donation[]> {
  return unwrap(
    await supabase.from('donations').select('*').order('created_at', { ascending: false })
  ) as Donation[];
}

export interface PublicImpactStats {
  total_donations: number;
  registered_donors: number;
  partner_ngos: number;
  people_helped: number;
}

export async function fetchPublicImpactStats(): Promise<PublicImpactStats> {
  return unwrap(await supabase.rpc('public_impact_stats')) as PublicImpactStats;
}

export async function createDonation(input: DonationInput): Promise<void> {
  unwrap(await supabase.from('donations').insert(input).select('id').single());
}

export async function updateDonation(id: string, input: DonationInput): Promise<void> {
  unwrap(await supabase.from('donations').update(input).eq('id', id).select('id').single());
}

export async function deleteDonation(id: string): Promise<void> {
  unwrap(await supabase.from('donations').delete().eq('id', id).select('id').single());
}

export async function fetchRequestsForDonations(donationIds: string[]): Promise<DonationRequest[]> {
  if (donationIds.length === 0) return [];
  return unwrap(
    await supabase
      .from('donation_requests')
      .select('*')
      .in('donation_id', donationIds)
      .order('created_at', { ascending: false })
  ) as DonationRequest[];
}

export async function fetchMyRequests(orgId: string): Promise<DonationRequestWithDonation[]> {
  return unwrap(
    await supabase
      .from('donation_requests')
      .select('*, donations(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
  ) as DonationRequestWithDonation[];
}

export async function fetchDonationHistory(donationId: string): Promise<DonationHistoryEntry[]> {
  return unwrap(
    await supabase
      .from('donation_history')
      .select('*')
      .eq('donation_id', donationId)
      .order('created_at', { ascending: true })
  ) as DonationHistoryEntry[];
}

export async function fetchRecentHistory(limit: number): Promise<HistoryWithDonation[]> {
  return unwrap(
    await supabase
      .from('donation_history')
      .select('*, donations(title)')
      .order('created_at', { ascending: false })
      .limit(limit)
  ) as HistoryWithDonation[];
}

export async function sweepExpiredDonations(): Promise<void> {
  unwrap(await supabase.rpc('sweep_expired_donations'));
}

export async function requestDonation(donationId: string, message: string): Promise<void> {
  unwrap(await supabase.rpc('request_donation', { p_donation_id: donationId, p_message: message }));
}

export async function cancelRequest(requestId: string): Promise<void> {
  unwrap(await supabase.rpc('cancel_request', { p_request_id: requestId }));
}

export async function respondToRequest(requestId: string, accept: boolean): Promise<void> {
  unwrap(await supabase.rpc('respond_to_request', { p_request_id: requestId, p_accept: accept }));
}

export async function schedulePickup(donationId: string, pickupAt: string): Promise<void> {
  unwrap(await supabase.rpc('schedule_pickup', { p_donation_id: donationId, p_pickup_at: pickupAt }));
}

export async function confirmPickup(donationId: string): Promise<void> {
  unwrap(await supabase.rpc('confirm_pickup', { p_donation_id: donationId }));
}

export async function confirmDelivery(donationId: string): Promise<void> {
  unwrap(await supabase.rpc('confirm_delivery', { p_donation_id: donationId }));
}

export async function completeDonation(donationId: string): Promise<void> {
  unwrap(await supabase.rpc('complete_donation', { p_donation_id: donationId }));
}

export async function releaseDonation(donationId: string): Promise<void> {
  unwrap(await supabase.rpc('release_donation', { p_donation_id: donationId }));
}

export async function cancelDonation(donationId: string): Promise<void> {
  unwrap(await supabase.rpc('cancel_donation', { p_donation_id: donationId }));
}

export async function reserveDonation(donationId: string): Promise<void> {
  unwrap(await supabase.rpc('reserve_donation', { p_donation_id: donationId }));
}

export async function setOrganizationLocation(latitude: number | null, longitude: number | null): Promise<void> {
  unwrap(await supabase.rpc('set_organization_location', { p_latitude: latitude, p_longitude: longitude }));
}

export async function fetchNearbyAlerts(orgId: string): Promise<NearbyAlert[]> {
  return unwrap(
    await supabase
      .from('ngo_notifications')
      .select('id, donation_id, distance_km, radius_km, created_at, donations(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50)
  ) as unknown as NearbyAlert[];
}

export async function submitNgoFeedback(input: {
  donationId: string;
  foodQuality: number | null;
  timelyPickup: number | null;
  overallExperience: number | null;
  writtenAppreciation: string;
}): Promise<void> {
  unwrap(
    await supabase.rpc('submit_ngo_feedback', {
      p_donation_id: input.donationId,
      p_food_quality: input.foodQuality,
      p_timely_pickup: input.timelyPickup,
      p_overall_experience: input.overallExperience,
      p_written_appreciation: input.writtenAppreciation,
    })
  );
}

export async function fetchDonationFeedback(donationId: string): Promise<NgoFeedbackRow | null> {
  return unwrap(
    await supabase
      .from('ngo_feedback')
      .select('donation_id, food_quality, timely_pickup, overall_experience, written_appreciation, created_at')
      .eq('donation_id', donationId)
      .maybeSingle()
  ) as NgoFeedbackRow | null;
}

export interface NgoFeedbackRow {
  donation_id: string;
  food_quality: number | null;
  timely_pickup: number | null;
  overall_experience: number | null;
  written_appreciation: string;
  created_at: string;
}
