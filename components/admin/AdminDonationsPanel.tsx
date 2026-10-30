import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DonationStatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { CATEGORIES, DONATION_STATUS_META } from '@/lib/constants';
import { donationImageUrl } from '@/lib/api/storage';
import { formatDate, formatDateTime } from '@/lib/format';
import { inputClass } from '@/lib/site';
import type { Donation, DonationCategory, DonationStatus } from '@/lib/types';

type SortKey = 'newest' | 'oldest' | 'deadline' | 'quantity';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'deadline', label: 'Available until (soonest)' },
  { key: 'quantity', label: 'Quantity (largest)' },
];

export function AdminDonationsPanel({ donations }: { donations: Donation[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<DonationStatus | 'all'>('all');
  const [category, setCategory] = useState<DonationCategory | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [selected, setSelected] = useState<Donation | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = donations
      .filter((d) => status === 'all' || d.status === status)
      .filter((d) => category === 'all' || d.category === category)
      .filter((d) => !q || [d.title, d.donor_name, d.city].some((v) => v.toLowerCase().includes(q)));
    const compare: Record<SortKey, (a: Donation, b: Donation) => number> = {
      newest: (a, b) => b.created_at.localeCompare(a.created_at),
      oldest: (a, b) => a.created_at.localeCompare(b.created_at),
      deadline: (a, b) => a.available_until.localeCompare(b.available_until),
      quantity: (a, b) => b.quantity - a.quantity,
    };
    return [...list].sort(compare[sort]);
  }, [donations, query, status, category, sort]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Search by title, donor or city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search donations"
          />
        </div>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as DonationStatus | 'all')} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {(Object.keys(DONATION_STATUS_META) as DonationStatus[]).map((s) => (
            <option key={s} value={s}>{DONATION_STATUS_META[s].label}</option>
          ))}
        </select>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as DonationCategory | 'all')} aria-label="Filter by category">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort donations">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-neutral-500">Showing {visible.length} of {donations.length} donations</p>

      {visible.length === 0 ? (
        <EmptyState icon={<Search className="h-6 w-6" aria-hidden />} title="No donations match" description="Try a different search or filter." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white shadow-card">
          <table className="min-w-full divide-y divide-neutral-100 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3">Donation</th>
                <th className="px-5 py-3">Donor</th>
                <th className="px-5 py-3">Quantity</th>
                <th className="px-5 py-3">Available until</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visible.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-secondary-50/50">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-neutral-800">{d.title}</p>
                    <p className="text-xs text-neutral-500">{d.city} · {formatDate(d.created_at)}</p>
                  </td>
                  <td className="px-5 py-3 text-neutral-700">{d.donor_name}</td>
                  <td className="px-5 py-3 text-neutral-700">{d.quantity} {d.unit}</td>
                  <td className="px-5 py-3 text-neutral-600">{formatDate(d.available_until)}</td>
                  <td className="px-5 py-3"><DonationStatusBadge status={d.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(d)}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary-700 transition-colors hover:bg-secondary-100"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!selected} title={selected?.title ?? 'Donation'} onClose={() => setSelected(null)} size="lg">
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <DonationStatusBadge status={selected.status} />
              <span className="text-neutral-500">Posted {formatDateTime(selected.created_at)}</span>
            </div>
            <p className="leading-relaxed text-neutral-700">{selected.description}</p>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Donor" value={`${selected.donor_name} (${selected.donor_type})`} />
              <Detail label="Quantity" value={`${selected.quantity} ${selected.unit}`} />
              <Detail label="Condition" value={selected.item_condition} />
              <Detail label="Available until" value={formatDateTime(selected.available_until)} />
              <Detail label="Pickup address" value={`${selected.pickup_address}, ${selected.city}`} />
              <Detail label="Contact" value={selected.contact_info} />
              {selected.safe_pickup_deadline && <Detail label="Safe pickup deadline" value={formatDateTime(selected.safe_pickup_deadline)} />}
              {selected.pickup_scheduled_for && <Detail label="Pickup scheduled" value={formatDateTime(selected.pickup_scheduled_for)} />}
            </dl>
            {selected.image_paths.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Photos</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {selected.image_paths.map((path) => (
                    <img
                      key={path}
                      src={donationImageUrl(path)}
                      alt={`Photo of ${selected.title}`}
                      loading="lazy"
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-1 text-neutral-800">{value}</dd>
    </div>
  );
}
