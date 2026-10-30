import { supabase } from '@/lib/supabase';
import type {
  DonorProfileData,
  MonitoringSummary,
  MonthlyImpact,
  PlatformSettings,
  TopContributor,
} from '@/lib/types';

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function fetchDonorProfile(donorId?: string): Promise<DonorProfileData> {
  return unwrap(
    await supabase.rpc('donor_profile', donorId ? { p_donor_id: donorId } : {})
  ) as DonorProfileData;
}

export async function fetchMonthlyImpact(): Promise<MonthlyImpact[]> {
  return unwrap(await supabase.rpc('donor_monthly_report')) as MonthlyImpact[];
}

export async function fetchTopContributors(limit = 10): Promise<TopContributor[]> {
  return unwrap(await supabase.rpc('top_contributors', { p_limit: limit })) as TopContributor[];
}

export async function fetchMonitoringSummary(): Promise<MonitoringSummary> {
  return unwrap(await supabase.rpc('admin_monitoring_summary')) as MonitoringSummary;
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const rows = unwrap(await supabase.from('platform_settings').select('key, value')) as { key: string; value: number }[];
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const radius = map.get('notification_radius_km');
  const minutes = map.get('reservation_minutes');
  if (radius === undefined || minutes === undefined) throw new Error('Platform settings are missing. Please run the setup migration.');
  return { notification_radius_km: radius, reservation_minutes: minutes };
}

export async function updatePlatformSetting(key: keyof PlatformSettings, value: number): Promise<void> {
  unwrap(await supabase.rpc('admin_update_setting', { p_key: key, p_value: value }));
}
