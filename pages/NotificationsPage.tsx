import { useMemo, useState } from 'react';
import { BellOff, CheckCheck, RefreshCw } from 'lucide-react';
import { NotificationRow } from '@/components/notifications/NotificationRow';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/hooks/useNotifications';
import { navigate } from '@/lib/navigation';
import { dashboardPathFor } from '@/lib/routes';
import type { AppNotification } from '@/lib/types';

type Filter = 'all' | 'unread';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
];

export default function NotificationsPage() {
  const { profile } = useAuth();
  const { items, loading, error, unreadCount, reload, markRead, markAllRead, remove } = useNotifications(profile?.id);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'unread' ? items.filter((item) => !item.is_read) : items),
    [items, filter]
  );

  const open = (item: AppNotification) => {
    if (!item.is_read) void markRead(item.id);
    if (item.donation_id && profile) navigate(dashboardPathFor(profile.role));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-800">Notifications</h1>
          <p className="mt-2 text-neutral-500">
            {unreadCount > 0 ? `You have ${unreadCount} unread ${unreadCount === 1 ? 'update' : 'updates'}.` : 'You are all caught up.'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void markAllRead()}
          disabled={unreadCount === 0}
          icon={<CheckCheck className="h-4 w-4" />}
        >
          Mark all as read
        </Button>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 border-b border-neutral-200">
        <div className="flex gap-6" role="tablist">
          {FILTERS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors ${
                filter === tab.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {tab.label}
              {tab.key === 'unread' && unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-accent-100 px-2 py-0.5 text-xs text-accent-700">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {error && (
          <div className="mb-4">
            <Alert tone="error">
              {error}{' '}
              <Button size="sm" variant="outline" className="ml-2" onClick={() => void reload()} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                Try again
              </Button>
            </Alert>
          </div>
        )}

        {loading && items.length === 0 ? (
          <LoadingState label="Loading notifications..." />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<BellOff className="h-6 w-6" aria-hidden />}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description="Updates about your donations and requests will appear here."
          />
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-card">
            {visible.map((item) => (
              <li key={item.id}>
                <NotificationRow item={item} onOpen={open} onDelete={(target) => void remove(target.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
