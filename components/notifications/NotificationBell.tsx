import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { NotificationRow } from '@/components/notifications/NotificationRow';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/hooks/useNotifications';
import { navigate } from '@/lib/navigation';
import type { AppNotification } from '@/lib/types';

export function NotificationBell() {
  const { profile } = useAuth();
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications(profile?.id);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const openItem = (item: AppNotification) => {
    if (!item.is_read) void markRead(item.id);
    setOpen(false);
    navigate('/notifications');
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-xl p-2.5 text-neutral-600 transition hover:bg-neutral-100 hover:text-primary-700"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-neutral-900 ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lift animate-fade-in">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-bold text-neutral-900">Notifications</p>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 transition hover:text-primary-900 disabled:cursor-not-allowed disabled:text-neutral-400"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">Loading...</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">You are all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-neutral-100 overflow-y-auto">
              {items.slice(0, 6).map((item) => (
                <NotificationRow key={item.id} item={item} onOpen={openItem} compact />
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/notifications');
            }}
            className="w-full border-t border-neutral-100 px-4 py-3 text-sm font-semibold text-primary-700 transition hover:bg-secondary-50"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
