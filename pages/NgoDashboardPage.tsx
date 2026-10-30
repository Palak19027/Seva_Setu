import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Briefcase, CalendarClock, CheckCheck, Compass, HandHeart, Star, Truck } from 'lucide-react';
import { NgoFeedbackModal } from '@/components/ngo/NgoFeedbackModal';
import { NgoLocationForm } from '@/components/ngo/NgoLocationForm';
import { NgoNearbyAlerts } from '@/components/ngo/NgoNearbyAlerts';
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell';
import { DonationBrowser } from '@/components/donations/DonationBrowser';
import { DonationProgress } from '@/components/donations/DonationProgress';
import { DonationStatusBadge, RequestStatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatCard } from '@/components/ui/StatCard';
import { SchedulePickupModal } from '@/components/ngo/SchedulePickupModal';
import { VerificationPanel } from '@/components/ngo/VerificationPanel';
import { useAuth } from '@/contexts/auth-context';
import {
  cancelRequest,
  confirmDelivery,
  confirmPickup,
  fetchMyRequests,
  type DonationRequestWithDonation,
} from '@/lib/api/donations';
import { errorMessage, formatDateTime, timeAgo } from '@/lib/format';
import type { Donation } from '@/lib/types';

type Section = 'browse' | 'alerts' | 'requests' | 'accepted';

const ACCEPTED_STATUSES: Donation['status'][] = ['RESERVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'DELIVERED', 'COMPLETED'];

const META: Record<Section, { title: string; subtitle: string }> = {
  browse: { title: 'Browse donations', subtitle: 'Find donations that match what your organization needs.' },
  alerts: { title: 'Nearby donations', subtitle: 'Hotels and restaurants close to you that need a pickup partner.' },
  requests: { title: 'My requests', subtitle: 'Track the donations you have asked for.' },
  accepted: { title: 'Accepted donations', subtitle: 'Schedule pickups and confirm each step of delivery.' },
};

export default function NgoDashboardPage() {
  const { organization, profile } = useAuth();
  const orgId = organization?.id ?? '';
  const verified = organization?.verification_status === 'verified';
  const [section, setSection] = useState<Section>('browse');
  const [requests, setRequests] = useState<DonationRequestWithDonation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<Donation | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<Donation | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      setRequests(await fetchMyRequests(orgId));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Your requests could not be loaded.'));
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const derived = useMemo(() => {
    const list = requests ?? [];
    const pending = list.filter((r) => r.status === 'PENDING');
    const accepted = list.filter((r) => r.status === 'ACCEPTED' && r.donations && ACCEPTED_STATUSES.includes(r.donations.status));
    const completed = accepted.filter((r) => r.donations?.status === 'DELIVERED' || r.donations?.status === 'COMPLETED').length;
    return { list, pending, accepted, completed };
  }, [requests]);

  const navItems: DashboardNavItem[] = [
    { key: 'browse', label: 'Browse', icon: Compass },
    { key: 'alerts', label: 'Nearby', icon: BellRing },
    { key: 'requests', label: 'My requests', icon: HandHeart, badge: derived.pending.length },
    { key: 'accepted', label: 'Accepted', icon: Truck, badge: derived.accepted.length },
  ];

  const runAction = async (id: string, task: () => Promise<void>, message: string) => {
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      await task();
      setNotice(message);
      await load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleSelect = (key: string) => {
    setSection(key as Section);
    setNotice(null);
    setActionError(null);
  };

  return (
    <DashboardShell
      title={META[section].title}
      subtitle={META[section].subtitle}
      navItems={navItems}
      activeKey={section}
      onSelect={handleSelect}
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-100 text-primary-600">
                <Briefcase className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-bold text-neutral-800">{organization?.name ?? profile?.full_name}</p>
                <p className="text-sm text-neutral-500">{organization?.org_type} · {organization?.city}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection('browse')} disabled={!verified}>
              {verified ? 'Find donations' : 'Verification required'}
            </Button>
          </div>
        </div>

        {!verified && organization && <VerificationPanel />}

        {notice && <Alert tone="success">{notice}</Alert>}
        {actionError && <Alert tone="error">{actionError}</Alert>}

        {section === 'browse' && (
          <DonationBrowser orgId={orgId} canRequest={verified} initialCategory={undefined} requestNotice={undefined} />
        )}

        {section === 'alerts' && (
          <>
            <NgoLocationForm
              latitude={organization?.latitude ?? null}
              longitude={organization?.longitude ?? null}
              onSaved={() => setNotice('Your location is saved. Alerts are measured from this point.')}
            />
            <NgoNearbyAlerts orgId={orgId} verified={verified} onAccepted={() => void load()} />
          </>
        )}

        {section !== 'browse' && loadError && (
          <Alert tone="error">
            {loadError}{' '}
            <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>Try again</Button>
          </Alert>
        )}

        {section !== 'browse' && !requests && !loadError && <LoadingState label="Loading your requests..." />}

        {section === 'requests' && requests && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={<HandHeart className="h-5 w-5" />} label="Total requests" value={derived.list.length} />
              <StatCard icon={<CalendarClock className="h-5 w-5" />} label="Awaiting donor" value={derived.pending.length} tone="accent" />
              <StatCard icon={<CheckCheck className="h-5 w-5" />} label="Pickups completed" value={derived.completed} />
            </div>
            {derived.list.length === 0 ? (
              <EmptyState
                icon={<HandHeart className="h-6 w-6" aria-hidden />}
                title="No requests yet"
                description="Browse donations and request the ones your organization can use."
                action={<Button onClick={() => setSection('browse')} disabled={!verified}>Browse donations</Button>}
              />
            ) : (
              <div className="space-y-4">
                {derived.list.map((request) => (
                  <article key={request.id} className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-neutral-800">{request.donations?.title ?? 'Donation no longer available'}</p>
                        <p className="mt-1 text-sm text-neutral-500">Requested {timeAgo(request.created_at)}</p>
                        {request.message && <p className="mt-2 text-sm italic text-neutral-600">&ldquo;{request.message}&rdquo;</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <RequestStatusBadge status={request.status} />
                        {request.donations && <DonationStatusBadge status={request.donations.status} />}
                      </div>
                    </div>
                    {request.status === 'PENDING' && (
                      <div className="mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busyId === request.id}
                          disabled={busyId !== null && busyId !== request.id}
                          onClick={() => void runAction(request.id, () => cancelRequest(request.id), 'Your request was withdrawn.')}
                        >
                          Withdraw request
                        </Button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {section === 'accepted' && requests && (
          derived.accepted.length === 0 ? (
            <EmptyState
              icon={<Truck className="h-6 w-6" aria-hidden />}
              title="Nothing to collect yet"
              description="Once a donor accepts your request, the donation appears here so you can schedule the pickup."
            />
          ) : (
            <div className="space-y-4">
              {derived.accepted.map((request) => {
                const donation = request.donations;
                if (!donation) return null;
                const busy = busyId === donation.id;
                return (
                  <article key={request.id} className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-neutral-800">{donation.title}</p>
                        <p className="mt-1 text-sm text-neutral-600">{donation.pickup_address}, {donation.city}</p>
                        <p className="mt-1 text-sm text-neutral-600">Contact: {donation.contact_info}</p>
                        {donation.pickup_scheduled_for && (
                          <p className="mt-2 text-sm font-semibold text-primary-700">Pickup: {formatDateTime(donation.pickup_scheduled_for)}</p>
                        )}
                        {donation.safe_pickup_deadline && (
                          <p className="mt-1 text-sm text-warning-700">Safe pickup deadline: {formatDateTime(donation.safe_pickup_deadline)}</p>
                        )}
                        {donation.reservation_expires_at && donation.status !== 'DELIVERED' && donation.status !== 'COMPLETED' && (
                          <p className="mt-1 text-sm text-neutral-600">Reservation ends: {formatDateTime(donation.reservation_expires_at)}</p>
                        )}
                      </div>
                      <DonationStatusBadge status={donation.status} />
                    </div>
                    <div className="mt-4">
                      <DonationProgress status={donation.status} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {donation.status === 'RESERVED' && (
                        <Button size="sm" icon={<CalendarClock className="h-4 w-4" />} onClick={() => setScheduling(donation)}>
                          Schedule pickup
                        </Button>
                      )}
                      {donation.status === 'PICKUP_SCHEDULED' && (
                        <>
                          <Button size="sm" loading={busy} disabled={busyId !== null && !busy} onClick={() => void runAction(donation.id, () => confirmPickup(donation.id), 'Pickup confirmed. Thank you for collecting.')}>
                            Confirm pickup
                          </Button>
                          <Button size="sm" variant="outline" icon={<CalendarClock className="h-4 w-4" />} onClick={() => setScheduling(donation)}>
                            Reschedule
                          </Button>
                        </>
                      )}
                      {donation.status === 'PICKED_UP' && (
                        <Button size="sm" loading={busy} disabled={busyId !== null && !busy} onClick={() => void runAction(donation.id, () => confirmDelivery(donation.id), 'Delivery confirmed. The donor has been notified.')}>
                          Confirm delivery
                        </Button>
                      )}
                      {donation.status === 'DELIVERED' && (
                        <p className="text-sm font-semibold text-success-700">Delivered. Waiting for the donor to mark it complete.</p>
                      )}
                      {donation.status === 'COMPLETED' && (
                        <p className="text-sm font-semibold text-success-700">Completed. Thank you for receiving this donation.</p>
                      )}
                      {(donation.status === 'DELIVERED' || donation.status === 'COMPLETED') && (
                        <Button size="sm" variant="outline" icon={<Star className="h-4 w-4" />} onClick={() => setFeedbackFor(donation)}>
                          Share feedback
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )
        )}
      </div>

      <NgoFeedbackModal
        donation={feedbackFor}
        onClose={() => setFeedbackFor(null)}
        onSubmitted={() => {
          setFeedbackFor(null);
          setNotice('Thank you. Your feedback has been shared with the donor.');
        }}
      />

      <SchedulePickupModal
        donation={scheduling}
        onClose={() => setScheduling(null)}
        onScheduled={() => {
          setScheduling(null);
          setNotice('Pickup scheduled. The donor has been notified.');
          void load();
        }}
      />
    </DashboardShell>
  );
}
