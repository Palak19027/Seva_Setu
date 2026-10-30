import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/accounts';
import { errorMessage } from '@/lib/format';
import type { AppNotification } from '@/lib/types';

const LIMIT = 50;

export function useNotifications(userId: string | undefined) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await fetchNotifications(LIMIT));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load notifications.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    void reload();
    const channel = supabase
      .channel(`notifications-${userId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        (payload) => {
          setItems((previous) => [payload.new as AppNotification, ...previous].slice(0, LIMIT));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  const unreadCount = useMemo(() => items.filter((item) => !item.is_read).length, [items]);

  const markRead = useCallback(async (id: string) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    try {
      await markNotificationRead(id);
    } catch (err) {
      setError(errorMessage(err));
      void reload();
    }
  }, [reload]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setItems((previous) => previous.map((item) => ({ ...item, is_read: true })));
    try {
      await markAllNotificationsRead(userId);
    } catch (err) {
      setError(errorMessage(err));
      void reload();
    }
  }, [userId, reload]);

  const remove = useCallback(async (id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
    try {
      await deleteNotification(id);
    } catch (err) {
      setError(errorMessage(err));
      void reload();
    }
  }, [reload]);

  return { items, loading, error, unreadCount, reload, markRead, markAllRead, remove };
}
