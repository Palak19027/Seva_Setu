import { useEffect, useState } from 'react';
import { Gift, HeartHandshake, Building2, Users } from 'lucide-react';
import { fetchPublicImpactStats, type PublicImpactStats } from '@/lib/api/donations';
import { errorMessage, formatCount } from '@/lib/format';

const EMPTY: PublicImpactStats = { total_donations: 0, registered_donors: 0, partner_ngos: 0, people_helped: 0 };

export function ImpactStats() {
  const [stats, setStats] = useState<PublicImpactStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublicImpactStats()
      .then((data) => active && setStats({ ...EMPTY, ...data }))
      .catch((err: unknown) => active && setError(errorMessage(err, 'Impact figures are unavailable right now.')));
    return () => {
      active = false;
    };
  }, []);

  const items = [
    { label: 'Total Donations', value: stats?.total_donations, icon: Gift },
    { label: 'Registered Donors', value: stats?.registered_donors, icon: Users },
    { label: 'Partner NGOs', value: stats?.partner_ngos, icon: Building2 },
    { label: 'People Helped', value: stats?.people_helped, icon: HeartHandshake },
  ];

  return (
    <section className="bg-primary-600 py-16 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-2xl bg-white/10 p-6 text-center ring-1 ring-white/15 transition duration-300 hover:-translate-y-1 hover:bg-white/15">
              <item.icon className="mx-auto h-7 w-7 text-accent-300" aria-hidden />
              <p className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {error ? '-' : stats ? formatCount(item.value ?? 0) : '...'}
              </p>
              <p className="mt-1.5 text-sm font-medium text-primary-100">{item.label}</p>
            </div>
          ))}
        </div>
        {error && <p className="mt-6 text-center text-sm text-primary-100">{error}</p>}
      </div>
    </section>
  );
}
