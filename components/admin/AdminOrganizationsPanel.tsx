import { useMemo, useState, type FormEvent } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { VerificationBadge } from '@/components/ui/Badge';
import { reviewOrganization } from '@/lib/api/accounts';
import { openVerificationDocument } from '@/lib/api/storage';
import { errorMessage, formatDate } from '@/lib/format';
import { inputClass } from '@/lib/site';
import type { Organization, VerificationStatus } from '@/lib/types';

type StatusFilter = 'all' | VerificationStatus;

export function AdminOrganizationsPanel({
  organizations,
  onChanged,
}: {
  organizations: Organization[];
  onChanged: (message: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [rejecting, setRejecting] = useState<Organization | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return organizations
      .filter((o) => statusFilter === 'all' || o.verification_status === statusFilter)
      .filter((o) => !q || [o.name, o.registration_number, o.city].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [organizations, query, statusFilter]);

  const decide = async (org: Organization, decision: 'verified' | 'rejected', note: string) => {
    setBusyId(org.id);
    setError(null);
    try {
      await reviewOrganization(org.id, decision, note);
      setRejecting(null);
      setReason('');
      onChanged(decision === 'verified' ? `${org.name} is now verified.` : `${org.name} was rejected.`);
    } catch (err) {
      setError(errorMessage(err, 'The decision could not be saved.'));
    } finally {
      setBusyId(null);
    }
  };

  const submitRejection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rejecting) return;
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setReasonError('Give the organization a clear reason (at least 10 characters).');
      return;
    }
    setReasonError(null);
    void decide(rejecting, 'rejected', trimmed);
  };

  const openDocument = async (org: Organization) => {
    if (!org.verification_document_path) return;
    setError(null);
    try {
      const url = await openVerificationDocument(org.verification_document_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(errorMessage(err, 'The document could not be opened.'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Search by name, registration number or city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search organizations"
          />
        </div>
        <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label="Filter by verification status">
          <option value="pending">Awaiting review</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="all">All organizations</option>
        </select>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {visible.length === 0 ? (
        <EmptyState icon={<Search className="h-6 w-6" aria-hidden />} title="No organizations here" description="Organizations appear here after they register and submit their documents." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((org) => {
            const busy = busyId === org.id;
            return (
              <article key={org.id} className="flex flex-col rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-neutral-800">{org.name}</p>
                    <p className="text-sm text-neutral-500">{org.org_type} · {org.city}</p>
                  </div>
                  <VerificationBadge status={org.verification_status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-400">Registration</dt>
                    <dd className="font-medium text-neutral-700">{org.registration_number || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-400">Contact</dt>
                    <dd className="font-medium text-neutral-700">{org.contact_person || '-'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-neutral-400">Address</dt>
                    <dd className="text-neutral-700">{org.address || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-400">Registered</dt>
                    <dd className="text-neutral-700">{formatDate(org.created_at)}</dd>
                  </div>
                  {org.reviewed_at && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-neutral-400">Last reviewed</dt>
                      <dd className="text-neutral-700">{formatDate(org.reviewed_at)}</dd>
                    </div>
                  )}
                </dl>
                {org.verification_status === 'rejected' && org.rejection_reason && (
                  <p className="mt-3 rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">Reason: {org.rejection_reason}</p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  {org.verification_document_path ? (
                    <Button size="sm" variant="secondary" icon={<ExternalLink className="h-4 w-4" />} onClick={() => void openDocument(org)}>
                      View document
                    </Button>
                  ) : (
                    <span className="self-center text-xs text-neutral-400">No document uploaded</span>
                  )}
                  {org.verification_status !== 'verified' && (
                    <Button size="sm" loading={busy} disabled={busyId !== null && !busy} onClick={() => void decide(org, 'verified', '')}>
                      Verify
                    </Button>
                  )}
                  {org.verification_status !== 'rejected' && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busyId !== null}
                      onClick={() => {
                        setReason('');
                        setReasonError(null);
                        setRejecting(org);
                      }}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={!!rejecting}
        title={`Reject ${rejecting?.name ?? 'organization'}`}
        onClose={() => {
          if (busyId === null) setRejecting(null);
        }}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={busyId !== null}>Cancel</Button>
            <Button type="submit" form="reject-org-form" variant="danger" loading={busyId === rejecting?.id}>Reject organization</Button>
          </>
        }
      >
        <form id="reject-org-form" onSubmit={submitRejection} className="space-y-4">
          <p className="text-sm text-neutral-600">The reason is shown to the organization so they can resubmit correct documents.</p>
          <Field label="Reason" htmlFor="reject-reason" required error={reasonError ?? undefined}>
            <textarea
              id="reject-reason"
              rows={4}
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="For example: the registration certificate is unreadable."
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
