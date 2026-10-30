import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Building2, Flag, Gauge, LayoutDashboard, Package, Users } from 'lucide-react';
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell';
import { AdminMonitoringPanel } from '@/components/admin/AdminMonitoringPanel';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { AdminUsersPanel } from '@/components/admin/AdminUsersPanel';
import { AdminOrganizationsPanel } from '@/components/admin/AdminOrganizationsPanel';
import { AdminDonationsPanel } from '@/components/admin/AdminDonationsPanel';
import { AdminReportsPanel } from '@/components/admin/AdminReportsPanel';
import { ActivityList } from '@/components/donations/ActivityList';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import NotificationsPage from '@/pages/NotificationsPage';
import { fetchAllOrganizations, fetchAllProfiles } from '@/lib/api/accounts';
import { fetchAllDonations, fetchRecentHistory, type HistoryWithDonation } from '@/lib/api/donations';
import { errorMessage } from '@/lib/format';
import type { Donation, Organization, Profile } from '@/lib/types';

type Tab = 'overview' | 'monitoring' | 'users' | 'organizations' | 'donations' | 'reports' | 'activity' | 'notifications';

interface AdminData {
  profiles: Profile[];
  organizations: Organization[];
  donations: Donation[];
  history: HistoryWithDonation[];
}

const TITLES: Record<Tab, { title: string; subtitle: string }> = {
  overview: { title: 'Platform overview', subtitle: 'Key numbers and trends across SevaSetu.' },
  monitoring: { title: 'Food rescue monitoring', subtitle: 'Reservations, expiries, pickups and meals saved, plus platform settings.' },
  users: { title: 'Users', subtitle: 'Find any donor, NGO or admin and manage their access.' },
  organizations: { title: 'Organizations', subtitle: 'Review verification documents before NGOs can request donations.' },
  donations: { title: 'Donations', subtitle: 'Search, filter and inspect every donation on the platform.' },
  reports: { title: 'Reports', subtitle: 'Concerns raised about donations.' },
  activity: { title: 'Activity log', subtitle: 'Every status change across the platform, newest first.' },
  notifications: { title: 'Your notifications', subtitle: 'Updates sent to your admin account.' },
};

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<AdminData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [profiles, organizations, donations, history] = await Promise.all([
        fetchAllProfiles(),
        fetchAllOrganizations(),
        fetchAllDonations(),
        fetchRecentHistory(200),
      ]);
      setData({ profiles, organizations, donations, history });
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Platform data could not be loaded.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingOrgs = useMemo(
    () => data?.organizations.filter((o) => o.verification_status === 'pending').length ?? 0,
    [data]
  );

  const navItems: DashboardNavItem[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'monitoring', label: 'Monitoring', icon: Gauge },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'organizations', label: 'Organizations', icon: Building2, badge: pendingOrgs },
    { key: 'donations', label: 'Donations', icon: Package },
    { key: 'reports', label: 'Reports', icon: Flag },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const handleChanged = (message: string) => {
    setNotice(message);
    void load();
  };

  return (
    <DashboardShell
      title={TITLES[tab].title}
      subtitle={TITLES[tab].subtitle}
      navItems={navItems}
      activeKey={tab}
      onSelect={(key) => {
        setTab(key as Tab);
        setNotice(null);
      }}
    >
      <div className="space-y-6">
        {notice && <Alert tone="success">{notice}</Alert>}
        {loadError && (
          <Alert tone="error">
            {loadError}{' '}
            <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>Try again</Button>
          </Alert>
        )}

        {tab === 'notifications' ? (
          <NotificationsPage />
        ) : !data ? (
          !loadError && <LoadingState label="Loading platform data..." />
        ) : tab === 'overview' ? (
          <AdminOverview profiles={data.profiles} organizations={data.organizations} donations={data.donations} history={data.history} />
        ) : tab === 'monitoring' ? (
          <AdminMonitoringPanel />
        ) : tab === 'users' ? (
          <AdminUsersPanel profiles={data.profiles} onChanged={handleChanged} />
        ) : tab === 'organizations' ? (
          <AdminOrganizationsPanel organizations={data.organizations} onChanged={handleChanged} />
        ) : tab === 'donations' ? (
          <AdminDonationsPanel donations={data.donations} />
        ) : tab === 'reports' ? (
          <AdminReportsPanel donations={data.donations} onChanged={handleChanged} />
        ) : (
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
            <ActivityList entries={data.history} />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
