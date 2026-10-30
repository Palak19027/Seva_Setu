import { useState } from 'react';
import { Building2, Check, Inbox, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { RequestStatusBadge } from '@/components/ui/Badge';
import { respondToRequest } from '@/lib/api/donations';
import { errorMessage, timeAgo } from '@/lib/format';
import type { Donation, DonationRequest } from '@/lib/types';

export function DonorRequestsSection({
  requests,
  donationsById,
  onChanged,
}: {
  requests: DonationRequest[];
  donationsById: Record<string, Donation>;
  onChanged: (message: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = async (request: DonationRequest, accept: boolean) => {
    setBusyId(request.id);
    setError(null);
    try {
      await respondToRequest(request.id, accept);
      onChanged(accept ? `You accepted ${request.org_name}. Next, they will schedule the pickup.` : `You declined ${request.org_name}'s request.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6" aria-hidden />}
        title="No requests yet"
        description="When a verified NGO asks for one of your donations, the request appears here for you to accept or decline."
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {requests.map((request) => {
        const donation = donationsById[request.donation_id];
        const pending = request.status === 'PENDING';
        const canDecide = pending && donation && (donation.status === 'REQUESTED' || donation.status === 'AVAILABLE' || donation.status === 'REACTIVATED');
        return (
          <article key={request.id} className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-100 text-primary-600">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-neutral-800">{request.org_name || 'Receiving organization'}</p>
                  <p className="text-sm text-neutral-500">
                    {request.org_type} · requested {timeAgo(request.created_at)}
                  </p>
                  <p className="mt-2 text-sm text-neutral-700">For: <span className="font-semibold">{donation?.title ?? 'Donation'}</span></p>
                </div>
              </div>
              <RequestStatusBadge status={request.status} />
            </div>

            {request.message && (
              <blockquote className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-600">
                &ldquo;{request.message}&rdquo;
              </blockquote>
            )}

            {canDecide && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" loading={busyId === request.id} icon={<Check className="h-4 w-4" />} onClick={() => void respond(request, true)}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" disabled={busyId !== null} icon={<X className="h-4 w-4" />} onClick={() => void respond(request, false)}>
                  Decline
                </Button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
