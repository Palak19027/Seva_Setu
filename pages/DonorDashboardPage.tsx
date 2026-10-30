import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Inbox, LayoutDashboard, Package, Plus, Trophy } from 'lucide-react';
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell';
import { DonationFormModal } from '@/components/donor/DonationFormModal';
import { DonorDonationsSection } from '@/components/donor/DonorDonationsSection';
import { DonorRequestsSection } from '@/components/donor/DonorRequestsSection';
import { DonorOverviewStats } from '@/components/donor/DonorOverviewStats';
import { DonorRewardsSection } from '@/components/donor/DonorRewardsSection';
import { ImpactLeaderboard } from '@/components/donor/ImpactLeaderboard';
import { ActivityList } from '@/components/donations/ActivityList';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { useAuth } from '@/contexts/auth-context';
import {
  fetchMyDonations,
  fetchRecentHistory,
  fetchRequestsForDonations,
  type HistoryWithDonation,
} from '@/lib/api/donations';
import { errorMessage } from '@/lib/format';
import type { Donation, DonationRequest } from '@/lib/types';

type Section = 'overview' | 'donations' | 'requests' | 'rewards' | 'history';

interface DonorData {
  donations: Donation[];
  requests: DonationRequest[];
  history: HistoryWithDonation[];
}

export default function DonorDashboardPage() {
  const { profile } = useAuth();
  const donorId = profile?.id ?? '';
  const [data, setData] = useState<DonorData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('overview');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Donation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const donations = await fetchMyDonations(donorId);
      const [requests, history] = await Promise.all([
        fetchRequestsForDonations(donations.map((d) => d.id)),
        fetchRecentHistory(100),
      ]);
      setData({ donations, requests, history });
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Your dashboard could not be loaded.'));
    }
  }, [donorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const derived = useMemo(() => {
    const donations = data?.donations ?? [];
    const requests = data?.requests ?? [];
    const pending = requests.filter((r) => r.status === 'PENDING');
    const donationsById = Object.fromEntries(donations.map((d) => [d.id, d]));
    const requestCounts = requests.reduce<Record<string, number>>((acc, r) => {
      if (r.status === 'PENDING') acc[r.donation_id] = (acc[r.donation_id] ?? 0) + 1;
      return acc;
    }, {});
    return { donations, requests, pending, donationsById, requestCounts };
  }, [data]);

  const navItems: DashboardNavItem[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'donations', label: 'My donations', icon: Package, badge: derived.donations.length },
    { key: 'requests', label: 'Requests', icon: Inbox, badge: derived.pending.length },
    { key: 'rewards', label: 'Rewards', icon: Trophy },
    { key: 'history', label: 'History', icon: History },
  ];

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (donation: Donation) => {
    setEditing(donation);
    setFormOpen(true);
  };
  const handleChanged = (message: string) => {
    setNotice(message);
    void load();
  };

  const meta: Record<Section, { title: string; subtitle: string }> = {
    overview: { title: `Welcome back, ${profile?.full_name.split(' ')[0] ?? 'friend'}`, subtitle: 'Here is how your giving is going.' },
    donations: { title: 'My donations', subtitle: 'Track each donation from posting to completion.' },
    requests: { title: 'Requests from NGOs', subtitle: 'Accept or decline organizations interested in your donations.' },
    rewards: { title: 'Rewards and recognition', subtitle: 'Your points, badges, certificates, and the impact you have made.' },
    history: { title: 'Donation history', subtitle: 'Every status change across your donations.' },
  };

  return (
    <DashboardShell
      title={meta[section].title}
      subtitle={meta[section].subtitle}
      navItems={navItems}
      activeKey={section}
      onSelect={(key) => {
        setSection(key as Section);
        setNotice(null);
      }}
      action={
        <Button onClick={openNew} icon={<Plus className="h-4 w-4" />}>Post a donation</Button>
      }
    >
      <div className="space-y-6">
        {notice && <Alert tone="success">{notice}</Alert>}
        {loadError && (
          <Alert tone="error">
            {loadError} <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>Try again</Button>
          </Alert>
        )}

        {!data && !loadError && <LoadingState label="Loading your dashboard..." />}

        {data && section === 'overview' && (
          <>
            <DonorOverviewStats donations={derived.donations} pendingRequests={derived.pending.length} />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card lg:col-span-2">
                <h2 className="text-base font-bold text-neutral-800">Recent activity</h2>
                <p className="mb-6 mt-1 text-sm text-neutral-500">The latest status changes on your donations.</p>
                <ActivityList entries={data.history.slice(0, 6)} />
              </div>
              <div className="rounded-2xl border border-primary-100 bg-secondary-50 p-6 shadow-card">
                <h2 className="text-base font-bold text-primary-800">Give something useful today</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  Clothes, books, groceries or a shelf of toys can change someone&apos;s week. Post an item and verified organizations
                  will be able to request it.
                </p>
                <Button className="mt-5" onClick={openNew} icon={<Plus className="h-4 w-4" />}>Post a donation</Button>
              </div>
            </div>
          </>
        )}

        {data && section === 'donations' && (
          <DonorDonationsSection
            donations={derived.donations}
            requestCounts={derived.requestCounts}
            onEdit={openEdit}
            onPostNew={openNew}
            onChanged={handleChanged}
          />
        )}

        {data && section === 'requests' && (
          <DonorRequestsSection requests={derived.requests} donationsById={derived.donationsById} onChanged={handleChanged} />
        )}

        {section === 'rewards' && (
          <div className="space-y-8">
            <DonorRewardsSection />
            <ImpactLeaderboard />
          </div>
        )}

        {data && section === 'history' && (
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
            <ActivityList entries={data.history} />
          </div>
        )}
      </div>

      <DonationFormModal
        open={formOpen}
        donation={editing}
        donorId={donorId}
        onClose={() => setFormOpen(false)}
        onSaved={(message) => {
          setFormOpen(false);
          setSection('donations');
          handleChanged(message);
        }}
      />
    </DashboardShell>
  );
}
