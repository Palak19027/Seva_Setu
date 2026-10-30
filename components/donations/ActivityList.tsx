import { History } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { DONATION_STATUS_META } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import type { HistoryWithDonation } from '@/lib/api/donations';

export function ActivityList({ entries, showTitle = true }: { entries: HistoryWithDonation[]; showTitle?: boolean }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-6 w-6" aria-hidden />}
        title="No activity yet"
        description="Every status change on a donation is recorded here as it happens."
      />
    );
  }
  return (
    <ol className="relative space-y-5 border-l-2 border-secondary-200 pl-6">
      {entries.map((entry) => {
        const meta = DONATION_STATUS_META[entry.to_status];
        return (
          <li key={entry.id} className="relative">
            <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-primary-600 ring-2 ring-secondary-200" aria-hidden />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-bold text-neutral-800">{meta.label}</p>
              <span className="text-xs text-neutral-400">{formatDateTime(entry.created_at)}</span>
            </div>
            {showTitle && entry.donations?.title && <p className="text-sm text-neutral-700">{entry.donations.title}</p>}
            {entry.note && <p className="mt-0.5 text-sm text-neutral-500">{entry.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
