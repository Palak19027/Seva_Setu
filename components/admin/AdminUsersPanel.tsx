import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/auth-context';
import { setAccountActive } from '@/lib/api/accounts';
import { errorMessage, formatDate } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/constants';
import { inputClass } from '@/lib/site';
import type { AccountRole, Profile } from '@/lib/types';

type RoleFilter = 'all' | AccountRole;
type StatusFilter = 'all' | 'active' | 'inactive';

export function AdminUsersPanel({ profiles, onChanged }: { profiles: Profile[]; onChanged: (message: string) => void }) {
  const { profile: me } = useAuth();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [target, setTarget] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles
      .filter((p) => roleFilter === 'all' || p.role === roleFilter)
      .filter((p) => statusFilter === 'all' || (statusFilter === 'active' ? p.is_active : !p.is_active))
      .filter((p) => !q || [p.full_name, p.email, p.city].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [profiles, query, roleFilter, statusFilter]);

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await setAccountActive(target.id, !target.is_active);
      const message = target.is_active ? `${target.full_name} was deactivated.` : `${target.full_name} was reactivated.`;
      setTarget(null);
      onChanged(message);
    } catch (err) {
      setError(errorMessage(err, 'The account could not be updated.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Search by name, email or city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
          />
        </div>
        <select className={inputClass} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)} aria-label="Filter by role">
          <option value="all">All roles</option>
          {(Object.keys(ROLE_LABELS) as AccountRole[]).map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
        <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label="Filter by status">
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </select>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {visible.length === 0 ? (
        <EmptyState icon={<Search className="h-6 w-6" aria-hidden />} title="No users match" description="Try a different search or filter." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white shadow-card">
          <table className="min-w-full divide-y divide-neutral-100 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">City</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visible.map((p) => {
                const self = p.id === me?.id;
                const protectedRole = p.role === 'admin';
                return (
                  <tr key={p.id} className="transition-colors hover:bg-secondary-50/50">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-neutral-800">{p.full_name}</p>
                      <p className="text-xs text-neutral-500">{p.email}</p>
                    </td>
                    <td className="px-5 py-3 text-neutral-700">{ROLE_LABELS[p.role]}</td>
                    <td className="px-5 py-3 text-neutral-700">{p.city || '-'}</td>
                    <td className="px-5 py-3 text-neutral-600">{formatDate(p.created_at)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={p.is_active ? 'success' : 'danger'}>{p.is_active ? 'Active' : 'Deactivated'}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant={p.is_active ? 'danger' : 'outline'}
                        disabled={self || protectedRole}
                        title={self ? 'You cannot change your own account' : protectedRole ? 'Admin accounts cannot be deactivated here' : undefined}
                        onClick={() => setTarget(p)}
                      >
                        {p.is_active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!target}
        title={target?.is_active ? 'Deactivate account?' : 'Reactivate account?'}
        message={
          target?.is_active
            ? `${target.full_name} will be signed out and cannot use SevaSetu until reactivated.`
            : `${target?.full_name ?? 'This user'} will be able to sign in again.`
        }
        confirmLabel={target?.is_active ? 'Deactivate' : 'Reactivate'}
        tone={target?.is_active ? 'danger' : 'primary'}
        loading={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
