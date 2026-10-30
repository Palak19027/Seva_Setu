import { useCallback, useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { fetchAllReports, resolveReport } from '@/lib/api/accounts';
import { errorMessage, formatDateTime } from '@/lib/format';
import type { Donation, Report } from '@/lib/types';

const REASON_LABELS: Record<Report['reason'], string> = {
  spam: 'Spam',
  wrong_information: 'Wrong information',
  unsafe: 'Unsafe food or item',
  other: 'Other',
};

export function AdminReportsPanel({ donations, onChanged }: { donations: Donation[]; onChanged: (message: string) => void }) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    try {
      setReports(await fetchAllReports());
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Reports could not be loaded.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (report: Report) => {
    setBusyId(report.id);
    setError(null);
    try {
      await resolveReport(report.id);
      onChanged('Report marked as resolved.');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'The report could not be resolved.'));
    } finally {
      setBusyId(null);
    }
  };

  if (error && !reports) {
    return (
      <Alert tone="error">
        {error}{' '}
        <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>Try again</Button>
      </Alert>
    );
  }
  if (!reports) return <LoadingState label="Loading reports..." />;

  const titleById = new Map(donations.map((d) => [d.id, d.title]));
  const visible = reports.filter((r) => showResolved || r.status === 'OPEN');
  const openCount = reports.filter((r) => r.status === 'OPEN').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">
          {openCount} open {openCount === 1 ? 'report' : 'reports'}
        </p>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
          Show resolved
        </label>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Flag className="h-6 w-6" aria-hidden />}
          title={showResolved ? 'No reports filed' : 'No open reports'}
          description="Reports filed by members about a donation appear here."
        />
      ) : (
        <div className="space-y-4">
          {visible.map((report) => (
            <article key={report.id} className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-neutral-800">{titleById.get(report.donation_id) ?? 'Donation no longer available'}</p>
                  <p className="mt-1 text-sm text-neutral-500">{REASON_LABELS[report.reason]} · {formatDateTime(report.created_at)}</p>
                  {report.details && <p className="mt-3 text-sm leading-relaxed text-neutral-700">{report.details}</p>}
                </div>
                <Badge tone={report.status === 'OPEN' ? 'warning' : 'success'}>{report.status === 'OPEN' ? 'Open' : 'Resolved'}</Badge>
              </div>
              {report.status === 'OPEN' && (
                <div className="mt-4">
                  <Button size="sm" loading={busyId === report.id} disabled={busyId !== null && busyId !== report.id} onClick={() => void resolve(report)}>
                    Mark as resolved
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
