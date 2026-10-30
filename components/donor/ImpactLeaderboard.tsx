import { useEffect, useState } from 'react';
import { Medal } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { LoadingState } from '@/components/ui/LoadingState';
import { fetchMonthlyImpact, fetchTopContributors } from '@/lib/api/impact';
import { errorMessage, formatCount, formatDate } from '@/lib/format';
import { LEVEL_META } from '@/lib/constants';
import type { MonthlyImpact, TopContributor } from '@/lib/types';

interface ImpactData {
  contributors: TopContributor[];
  monthly: MonthlyImpact[];
}

export function ImpactLeaderboard() {
  const [data, setData] = useState<ImpactData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchTopContributors(10), fetchMonthlyImpact()])
      .then(([contributors, monthly]) => {
        if (active) setData({ contributors, monthly });
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, 'Impact figures could not be loaded.'));
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return <LoadingState label="Loading impact figures..." />;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
        <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-800">
          <Medal className="h-5 w-5 text-accent-600" aria-hidden /> Top contributors
        </h3>
        {data.contributors.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No donors have completed a donation yet.</p>
        ) : (
          <ol className="mt-4 divide-y divide-neutral-100">
            {data.contributors.map((donor, index) => (
              <li key={donor.donor_id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-800">{donor.donor_name}</p>
                    <p className="text-xs text-neutral-500">
                      {donor.city} · {LEVEL_META[donor.level].label} · {formatCount(donor.completed_donations)} completed
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary-700">{formatCount(donor.meals_contributed)} meals</p>
                  <p className="text-xs text-neutral-500">{formatCount(donor.points)} points</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
        <h3 className="text-lg font-bold text-neutral-800">Monthly impact report</h3>
        {data.monthly.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">Monthly figures appear once donations are posted.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-4 font-semibold">Month</th>
                  <th className="py-2 pr-4 font-semibold">Posted</th>
                  <th className="py-2 pr-4 font-semibold">Completed</th>
                  <th className="py-2 font-semibold">Meals</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map((row) => (
                  <tr key={row.month_start} className="border-b border-neutral-100 last:border-0">
                    <td className="py-3 pr-4 font-semibold text-neutral-800">{formatDate(row.month_start)}</td>
                    <td className="py-3 pr-4 text-neutral-700">{formatCount(row.donations_posted)}</td>
                    <td className="py-3 pr-4 text-neutral-700">{formatCount(row.completed)}</td>
                    <td className="py-3 font-bold text-primary-700">{formatCount(row.meals)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
