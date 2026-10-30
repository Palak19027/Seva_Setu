import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PackageSearch, Search, SlidersHorizontal } from 'lucide-react';
import { DonationCard, isDonationOpen } from '@/components/donations/DonationCard';
import { RequestDonationModal } from '@/components/donations/RequestDonationModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import { fetchMyRequests, fetchPublicDonations } from '@/lib/api/donations';
import { CATEGORIES } from '@/lib/constants';
import { errorMessage } from '@/lib/format';
import { inputClass } from '@/lib/site';
import type { PublicDonation } from '@/lib/types';

interface Filters {
  search: string;
  category: string;
  city: string;
  donorType: string;
  availability: 'open' | 'all';
}

const DEFAULT_FILTERS: Filters = { search: '', category: '', city: '', donorType: '', availability: 'open' };

export function DonationBrowser({
  orgId,
  canRequest,
  initialCategory = '',
  requestNotice,
}: {
  orgId?: string;
  canRequest: boolean;
  initialCategory?: string;
  requestNotice?: ReactNode;
}) {
  const [donations, setDonations] = useState<PublicDonation[]>([]);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS, category: initialCategory });
  const [requesting, setRequesting] = useState<PublicDonation | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [publicList, mine] = await Promise.all([
        fetchPublicDonations(),
        orgId ? fetchMyRequests(orgId) : Promise.resolve([]),
      ]);
      setDonations(publicList);
      setRequestedIds(new Set(mine.filter((r) => r.status === 'PENDING' || r.status === 'ACCEPTED').map((r) => r.donation_id)));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Donations could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const cities = useMemo(() => [...new Set(donations.map((d) => d.city).filter(Boolean))].sort(), [donations]);

  const visible = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return donations
      .filter((d) => {
        if (filters.availability === 'open' && !isDonationOpen(d)) return false;
        if (filters.category && d.category !== filters.category) return false;
        if (filters.city && d.city !== filters.city) return false;
        if (filters.donorType && d.donor_type !== filters.donorType) return false;
        if (query && !`${d.title} ${d.description} ${d.donor_name} ${d.category}`.toLowerCase().includes(query)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [donations, filters]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((previous) => ({ ...previous, [key]: value }));
  const hasFilters = JSON.stringify(filters) !== JSON.stringify({ ...DEFAULT_FILTERS, category: initialCategory });

  return (
    <div className="space-y-6">
      {requestNotice}
      {success && <Alert tone="success">{success}</Alert>}

      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-card sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              type="search"
              aria-label="Search donations"
              placeholder="Search by name or category"
              className={`${inputClass} pl-10`}
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>
          <select aria-label="Filter by category" className={inputClass} value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select aria-label="Filter by city" className={inputClass} value={filters.city} onChange={(e) => setFilter('city', e.target.value)}>
            <option value="">All cities</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <select aria-label="Filter by donor type" className={inputClass} value={filters.donorType} onChange={(e) => setFilter('donorType', e.target.value)}>
            <option value="">All donor types</option>
            <option value="individual">Individual</option>
            <option value="business">Business</option>
          </select>
          <select aria-label="Filter by availability" className={inputClass} value={filters.availability} onChange={(e) => setFilter('availability', e.target.value as Filters['availability'])}>
            <option value="open">Available only</option>
            <option value="all">All statuses</option>
          </select>
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />Filters applied</span>
            <button type="button" className="font-semibold text-primary-700 hover:underline" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>Clear all</button>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingState label="Loading donations..." />
      ) : error ? (
        <Alert tone="error">
          {error}{' '}
          <Button variant="outline" size="sm" onClick={() => void load()} className="ml-2">Try again</Button>
        </Alert>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-6 w-6" aria-hidden />}
          title={donations.length === 0 ? 'No donations posted yet' : 'No donations match your filters'}
          description={donations.length === 0 ? 'New donations appear here as soon as donors post them.' : 'Try a different category, city or search term.'}
          action={hasFilters ? <Button variant="outline" size="sm" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>Clear filters</Button> : undefined}
        />
      ) : (
        <>
          <p className="text-sm text-neutral-500">Showing {visible.length} of {donations.length} donations</p>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((donation) => (
              <DonationCard
                key={donation.id}
                donation={donation}
                canRequest={canRequest}
                requestedByMe={requestedIds.has(donation.id)}
                onRequest={setRequesting}
              />
            ))}
          </div>
        </>
      )}

      <RequestDonationModal
        donation={requesting}
        onClose={() => setRequesting(null)}
        onRequested={(donation) => {
          setRequesting(null);
          setSuccess(`Your request for "${donation.title}" was sent. The donor will review it shortly.`);
          void load();
        }}
      />
    </div>
  );
}
