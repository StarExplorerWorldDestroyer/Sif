import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import type { ConnectionStatus, UserSearchResult } from '@/types';

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
};

type SocialContextValue = {
  loading: boolean;
  following: Set<string>;
  followingCount: number;
  connectionCount: number;
  incomingCount: number;
  isFollowing: (userId: string) => boolean;
  connectionStatus: (userId: string) => ConnectionStatus;
  follow: (userId: string) => Promise<void>;
  unfollow: (userId: string) => Promise<void>;
  requestConnection: (userId: string) => Promise<void>;
  acceptConnection: (userId: string) => Promise<void>;
  /** Decline an incoming request, cancel an outgoing one, or remove an existing connection. */
  removeConnection: (userId: string) => Promise<void>;
  incomingRequests: () => Promise<UserSearchResult[]>;
  connectionList: () => Promise<UserSearchResult[]>;
  refetch: () => Promise<void>;
};

const SocialContext = createContext<SocialContextValue | null>(null);

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

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setFollowing(new Set());
      setConnections([]);
      setLoading(false);
      return;
    }
    const [{ data: follows }, { data: conns }] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase
        .from('connections')
        .select('id, requester_id, addressee_id, status')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    ]);
    setFollowing(new Set((follows ?? []).map((f: any) => f.following_id)));
    setConnections((conns as ConnectionRow[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  const findConnection = useCallback(
    (userId: string) =>
      connections.find(
        (c) =>
          (c.requester_id === user?.id && c.addressee_id === userId) ||
          (c.requester_id === userId && c.addressee_id === user?.id),
      ),
    [connections, user?.id],
  );

  const connectionStatus = useCallback(
    (userId: string): ConnectionStatus => {
      const c = findConnection(userId);
      if (!c) return 'none';
      if (c.status === 'accepted') return 'connected';
      return c.requester_id === user?.id ? 'pending_outgoing' : 'pending_incoming';
    },
    [findConnection, user?.id],
  );

  const isFollowing = useCallback((userId: string) => following.has(userId), [following]);

  async function follow(userId: string) {
    if (!user) return;
    setFollowing((prev) => new Set(prev).add(userId));
    await supabase.from('follows').insert({ follower_id: user.id, following_id: userId });
  }

  async function unfollow(userId: string) {
    if (!user) return;
    setFollowing((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
    await supabase.from('follows').delete().match({ follower_id: user.id, following_id: userId });
  }

  async function requestConnection(userId: string) {
    if (!user) return;
    await supabase.from('connections').insert({ requester_id: user.id, addressee_id: userId });
    await refetch();
  }

  async function acceptConnection(userId: string) {
    if (!user) return;
    const c = findConnection(userId);
    if (!c) return;
    await supabase.from('connections').update({ status: 'accepted' }).eq('id', c.id);
    await refetch();
  }

  async function removeConnection(userId: string) {
    const c = findConnection(userId);
    if (!c) return;
    await supabase.from('connections').delete().eq('id', c.id);
    await refetch();
  }

  const resolveCards = useCallback(async (ids: string[]): Promise<UserSearchResult[]> => {
    if (ids.length === 0) return [];
    const { data } = await supabase.rpc('profile_cards_by_ids', { ids });
    return (data ?? []).map(cardFromRpc);
  }, []);

  const incomingRequests = useCallback(async () => {
    const ids = connections
      .filter((c) => c.status === 'pending' && c.addressee_id === user?.id)
      .map((c) => c.requester_id);
    return resolveCards(ids);
  }, [connections, user?.id, resolveCards]);

  const connectionList = useCallback(async () => {
    const ids = connections
      .filter((c) => c.status === 'accepted')
      .map((c) => (c.requester_id === user?.id ? c.addressee_id : c.requester_id));
    return resolveCards(ids);
  }, [connections, user?.id, resolveCards]);

  const value = useMemo<SocialContextValue>(
    () => ({
      loading,
      following,
      followingCount: following.size,
      connectionCount: connections.filter((c) => c.status === 'accepted').length,
      incomingCount: connections.filter(
        (c) => c.status === 'pending' && c.addressee_id === user?.id,
      ).length,
      isFollowing,
      connectionStatus,
      follow,
      unfollow,
      requestConnection,
      acceptConnection,
      removeConnection,
      incomingRequests,
      connectionList,
      refetch,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, following, connections, isFollowing, connectionStatus, incomingRequests, connectionList, refetch],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used inside a SocialProvider');
  return ctx;
}
