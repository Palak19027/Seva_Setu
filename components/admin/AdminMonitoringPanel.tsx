import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCheck, HandHeart, RefreshCw, Repeat, Timer, Trophy, Users, Utensils } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { DonationStatusBadge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatCard } from '@/components/ui/StatCard';
import { AdminPlatformSettings } from '@/components/admin/AdminPlatformSettings';
import { fetchMonitoringSummary } from '@/lib/api/impact';
import { errorMessage, formatCount, formatDateTime } from '@/lib/format';
import type { MonitoringSummary } from '@/lib/types';

export function AdminMonitoringPanel() {
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setSummary(await fetchMonitoringSummary());
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Monitoring figures could not be loaded.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!summary && !error) return <LoadingState label="Loading monitoring figures..." />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">Live figures from the database, refreshed on demand.</p>
        <Button variant="outline" size="sm" loading={refreshing} icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<Utensils className="h-5 w-5" />} label="Total food donations" value={summary.total_food_donations} />
            <StatCard icon={<HandHeart className="h-5 w-5" />} label="Active reservations" value={summary.active_reservations} />
            <StatCard icon={<Timer className="h-5 w-5" />} label="Expired reservations" value={summary.expired_reservations} tone="accent" />
            <StatCard icon={<Repeat className="h-5 w-5" />} label="Automatically reactivated" value={summary.reactivated_donations} />
            <StatCard icon={<CheckCheck className="h-5 w-5" />} label="Successful pickups" value={summary.successful_pickups} />
            <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Nearing expiry" value={summary.nearing_expiry} tone="accent" />
            <StatCard icon={<Utensils className="h-5 w-5" />} label="Total meals saved" value={summary.meals_saved} />
            <StatCard icon={<Users className="h-5 w-5" />} label="NGOs participating" value={summary.participating_ngos} />
          </div>
          <p className="-mt-4 text-sm text-neutral-600">
            {formatCount(summary.participating_ngos)} of {formatCount(summary.verified_ngos)} verified NGOs have taken at least one donation.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
              <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-800">
                <Trophy className="h-5 w-5 text-accent-600" aria-hidden /> Top hotel and restaurant donors
              </h3>
              {summary.top_hotel_donors.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-600">No completed donations yet.</p>
              ) : (
                <ol className="mt-4 divide-y divide-neutral-100">
                  {summary.top_hotel_donors.map((donor, index) => (
                    <li key={`${donor.name}-${index}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-800">{index + 1}. {donor.name}</p>
                        <p className="text-xs text-neutral-500">{donor.city} · {formatCount(donor.completed)} completed</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-700">{formatCount(donor.meals)} meals</p>
                        <p className="text-xs text-neutral-500">{formatCount(donor.points)} points</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
              <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-800">
                <AlertTriangle className="h-5 w-5 text-warning-600" aria-hidden /> Food nearing its safe deadline
              </h3>
              {summary.expiring_soon.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-600">Nothing is close to its deadline.</p>
              ) : (
                <ul className="mt-4 divide-y divide-neutral-100">
                  {summary.expiring_soon.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-800">{item.title}</p>
                        <p className="text-xs text-neutral-500">{item.donor_name} · Deadline {formatDateTime(item.deadline)}</p>
                      </div>
                      <DonationStatusBadge status={item.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <AdminPlatformSettings />
        </>
      )}
    </div>
  );
}
