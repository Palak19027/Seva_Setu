import { CheckCircle2, Clock, HandHeart, Inbox, PackageOpen } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { ACTIVE_STATUSES } from '@/lib/constants';
import { formatCount } from '@/lib/format';
import type { Donation } from '@/lib/types';

export function DonorOverviewStats({ donations, pendingRequests }: { donations: Donation[]; pendingRequests: number }) {
  const active = donations.filter((d) => ACTIVE_STATUSES.includes(d.status)).length;
  const completed = donations.filter((d) => d.status === 'COMPLETED').length;
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={<HandHeart className="h-5 w-5" />} label="Total donations" value={formatCount(donations.length)} />
      <StatCard icon={<PackageOpen className="h-5 w-5" />} label="Active donations" value={formatCount(active)} tone="accent" />
      <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Completed donations" value={formatCount(completed)} tone="success" />
      <StatCard
        icon={pendingRequests > 0 ? <Clock className="h-5 w-5" /> : <Inbox className="h-5 w-5" />}
        label="Pending requests"
        value={formatCount(pendingRequests)}
        tone="warning"
        hint={pendingRequests > 0 ? 'Waiting for your decision' : 'No requests waiting'}
      />
    </div>
  );
}
