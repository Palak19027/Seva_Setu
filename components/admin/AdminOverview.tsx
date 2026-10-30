import { useMemo, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Building2, HandHeart, Users } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { ACTIVE_STATUSES, CATEGORIES, DONATION_STATUS_META } from '@/lib/constants';
import type { HistoryWithDonation } from '@/lib/api/donations';
import type { Donation, Organization, Profile } from '@/lib/types';

const PALETTE = ['#176B45', '#F4A340', '#2E8B67', '#7BC4A0', '#24312A', '#B8D8C4', '#E0884A', '#5C7A6B', '#9CA3A0'];
const DAYS = 14;

function dayKey(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

export function AdminOverview({
  profiles,
  organizations,
  donations,
  history,
}: {
  profiles: Profile[];
  organizations: Organization[];
  donations: Donation[];
  history: HistoryWithDonation[];
}) {
  const stats = useMemo(() => {
    const donors = profiles.filter((p) => p.role === 'individual' || p.role === 'business').length;
    const pendingOrgs = organizations.filter((o) => o.verification_status === 'pending').length;
    const active = donations.filter((d) => ACTIVE_STATUSES.includes(d.status)).length;
    const completed = donations.filter((d) => d.status === 'COMPLETED').length;
    return { donors, pendingOrgs, active, completed };
  }, [profiles, organizations, donations]);

  const categoryData = useMemo(
    () => CATEGORIES.map((c) => ({ name: c.label, count: donations.filter((d) => d.category === c.value).length })),
    [donations]
  );

  const statusData = useMemo(
    () =>
      (Object.keys(DONATION_STATUS_META) as Donation['status'][])
        .map((status) => ({ name: DONATION_STATUS_META[status].label, value: donations.filter((d) => d.status === status).length }))
        .filter((row) => row.value > 0),
    [donations]
  );

  const dailyData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of history) {
      const key = dayKey(new Date(entry.created_at));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const rows: { day: string; updates: number }[] = [];
    for (let i = DAYS - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      rows.push({
        day: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        updates: counts.get(dayKey(date)) ?? 0,
      });
    }
    return rows;
  }, [history]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Registered donors" value={stats.donors} />
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Organizations awaiting review" value={stats.pendingOrgs} tone="accent" />
        <StatCard icon={<HandHeart className="h-5 w-5" />} label="Active donations" value={stats.active} />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Completed donations" value={stats.completed} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Donations by category">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4B5563' }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#4B5563' }} />
              <Tooltip />
              <Bar dataKey="count" name="Donations" fill="#176B45" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Donation status">
          {statusData.length === 0 ? (
            <p className="py-16 text-center text-sm text-neutral-500">No donations yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {statusData.map((row, index) => (
                    <Cell key={row.name} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Activity in the last ${DAYS} days`} className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#4B5563' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#4B5563' }} />
              <Tooltip />
              <Line type="monotone" dataKey="updates" name="Status updates" stroke="#F4A340" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card ${className}`}>
      <h2 className="mb-4 text-base font-bold text-neutral-800">{title}</h2>
      {children}
    </section>
  );
}
