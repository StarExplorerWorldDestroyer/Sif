import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import type { AppNotification, NotificationType, UserSearchResult } from '@/types';

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refetch: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function cardFromRpc(row: any): UserSearchResult {
  return {
    id: row.id,
    username: row.username ?? null,
    displayName: row.display_name ?? '',
    avatarUrl: row.avatar_url ?? '',
    privacy: row.privacy ?? 'public',
    isStylist: row.is_stylist ?? false,
  };
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const rows = data ?? [];
    const actorIds = Array.from(
      new Set(rows.map((r: any) => r.actor_id).filter(Boolean)),
    ) as string[];

    let cards = new Map<string, UserSearchResult>();
    if (actorIds.length > 0) {
      const { data: cardRows } = await supabase.rpc('profile_cards_by_ids', { ids: actorIds });
      cards = new Map((cardRows ?? []).map((c: any) => [c.id, cardFromRpc(c)]));
    }

    setNotifications(
      rows.map((r: any) => ({
        id: r.id,
        type: r.type as NotificationType,
        actor: r.actor_id ? cards.get(r.actor_id) ?? null : null,
        entityId: r.entity_id ?? null,
        read: r.read ?? false,
        createdAt: r.created_at,
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    // Generate any due booking reminders, then load. The insert streams back via
    // the realtime subscription below, so new reminders surface right away.
    if (user) supabase.rpc('process_booking_reminders').then(undefined, () => {});
    refetch();
  }, [refetch, user]);

  // Live updates: refetch when a new notification lands for this user.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  async function markAllRead() {
    if (!user) return;
    const hasUnread = notifications.some((n) => !n.read);
    if (!hasUnread) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, loading, refetch, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside a NotificationsProvider');
  return ctx;
}
