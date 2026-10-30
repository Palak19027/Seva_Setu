import { supabase } from '@/lib/supabase';
import type { AppNotification, Organization, Profile, Report } from '@/lib/types';

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function fetchAllProfiles(): Promise<Profile[]> {
  return unwrap(await supabase.from('profiles').select('*').order('created_at', { ascending: false })) as Profile[];
}

export async function fetchAllOrganizations(): Promise<Organization[]> {
  return unwrap(
    await supabase.from('organizations').select('*').order('created_at', { ascending: false })
  ) as Organization[];
}

export async function setAccountActive(profileId: string, active: boolean): Promise<void> {
  unwrap(await supabase.rpc('admin_set_account_active', { p_profile_id: profileId, p_active: active }));
}

export async function reviewOrganization(orgId: string, decision: 'verified' | 'rejected', reason: string): Promise<void> {
  unwrap(
    await supabase.rpc('admin_review_organization', {
      p_org_id: orgId,
      p_decision: decision,
      p_reason: reason,
    })
  );
}

export async function submitVerificationDocument(path: string): Promise<void> {
  unwrap(await supabase.rpc('submit_verification_document', { p_path: path }));
}

export async function updateOwnProfile(
  profileId: string,
  values: { full_name: string; phone: string; address: string; city: string }
): Promise<void> {
  unwrap(await supabase.from('profiles').update(values).eq('id', profileId).select('id').single());
}

export async function fetchAllReports(): Promise<Report[]> {
  return unwrap(await supabase.from('reports').select('*').order('created_at', { ascending: false })) as Report[];
}

export async function fileReport(donationId: string, reason: Report['reason'], details: string): Promise<void> {
  unwrap(
    await supabase
      .from('reports')
      .insert({ donation_id: donationId, reason, details })
      .select('id')
      .single()
  );
}

export async function resolveReport(reportId: string): Promise<void> {
  unwrap(await supabase.from('reports').update({ status: 'RESOLVED' }).eq('id', reportId).select('id').single());
}

export async function fetchNotifications(limit: number): Promise<AppNotification[]> {
  return unwrap(
    await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit)
  ) as AppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  unwrap(await supabase.from('notifications').update({ is_read: true }).eq('id', id).select('id').single());
}

export async function markAllNotificationsRead(recipientId: string): Promise<void> {
  unwrap(
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false)
      .select('id')
  );
}

export async function deleteNotification(id: string): Promise<void> {
  unwrap(await supabase.from('notifications').delete().eq('id', id).select('id').single());
}
