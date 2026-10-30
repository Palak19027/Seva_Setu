import { useCallback, useEffect, useState } from 'react';
import { BellRing, Clock, MapPin } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { CATEGORIES, OPEN_STATUSES } from '@/lib/constants';
import { fetchNearbyAlerts, reserveDonation } from '@/lib/api/donations';
import { errorMessage, formatDateTime } from '@/lib/format';
import type { NearbyAlert } from '@/lib/types';

interface NgoNearbyAlertsProps {
  orgId: string;
  verified: boolean;
  onAccepted: () => void;
}

export function NgoNearbyAlerts({ orgId, verified, onAccepted }: NgoNearbyAlertsProps) {
  const [alerts, setAlerts] = useState<NearbyAlert[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAlerts(await fetchNearbyAlerts(orgId));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Nearby donations could not be loaded.'));
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (alerts ?? []).filter((alert) => alert.donations && OPEN_STATUSES.includes(alert.donations.status));

  const accept = async (alert: NearbyAlert) => {
    if (!alert.donations) return;
    setBusyId(alert.donation_id);
    setActionError(null);
    setNotice(null);
    try {
      await reserveDonation(alert.donation_id);
      setNotice(`"${alert.donations.title}" is reserved for your organization. Find it under Accepted.`);
      onAccepted();
    } catch (err) {
      setActionError(errorMessage(err, 'This donation could not be reserved. It may already have been taken.'));
    } finally {
      setBusyId(null);
      await load();
    }
  };

  return (
    <div className="space-y-5">
      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {!verified && <Alert tone="warning">Only verified organizations can accept donations.</Alert>}

      {loadError && (
        <Alert tone="error">
          {loadError}{' '}
          <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>Try again</Button>
        </Alert>
      )}

      {!alerts && !loadError && <LoadingState label="Loading nearby donations..." />}

      {alerts && open.length === 0 && (
        <EmptyState
          icon={<BellRing className="h-6 w-6" aria-hidden />}
          title="No nearby donations right now"
          description="When a hotel or restaurant posts food within your radius, it will appear here with an Accept button."
        />
      )}

      {open.map((alert) => {
        const donation = alert.donations;
        if (!donation) return null;
        const category = CATEGORIES.find((item) => item.value === donation.category)?.label ?? donation.category;
        const busy = busyId === alert.donation_id;
        return (
          <article key={alert.id} className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card transition hover:shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-700">
                  <span>{category}</span>
                  <span className="text-neutral-300">·</span>
                  <span className="text-neutral-500">Within {alert.radius_km} km</span>
                </div>
                <h3 className="text-lg font-bold text-neutral-800">{donation.title}</h3>
                <p className="text-sm text-neutral-600">From {donation.donor_name}</p>
                {donation.description && <p className="text-sm leading-relaxed text-neutral-600">{donation.description}</p>}
                <dl className="grid gap-3 pt-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">Quantity</dt>
                    <dd className="font-semibold text-neutral-800">{donation.quantity} {donation.unit}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">Distance</dt>
                    <dd className="font-semibold text-neutral-800">{alert.distance_km.toFixed(1)} km away</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-neutral-500">
                      <MapPin className="h-3.5 w-3.5" aria-hidden /> Pickup location
                    </dt>
                    <dd className="text-neutral-800">{donation.pickup_address}, {donation.city}</dd>
                  </div>
                  {donation.food_prepared_at && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-neutral-500">Prepared</dt>
                      <dd className="text-neutral-800">{formatDateTime(donation.food_prepared_at)}</dd>
                    </div>
                  )}
                  {donation.safe_pickup_deadline && (
                    <div>
                      <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-neutral-500">
                        <Clock className="h-3.5 w-3.5" aria-hidden /> Safe pickup deadline
                      </dt>
                      <dd className="font-semibold text-accent-700">{formatDateTime(donation.safe_pickup_deadline)}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <Button
                loading={busy}
                disabled={!verified || (busyId !== null && !busy)}
                onClick={() => void accept(alert)}
              >
                Accept donation
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
