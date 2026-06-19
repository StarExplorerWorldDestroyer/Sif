import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchConversations } from '@/lib/messages';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import type { Conversation } from '@/types';

type MessagesContextValue = {
  conversations: Conversation[];
  unreadTotal: number;
  loading: boolean;
  refetch: () => Promise<void>;
};

const MessagesContext = createContext<MessagesContextValue | null>(null);

export function MessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setConversations(await fetchConversations());
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  // Live inbox: a new/updated conversation involving me bumps the list.
  // The conversation's denormalized last-message fields update on every new
  // message (via trigger), and I'm always exactly one of user_a / user_b.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conversations:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `user_a=eq.${user.id}` },
        () => refetch(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `user_b=eq.${user.id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  const unreadTotal = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <MessagesContext.Provider value={{ conversations, unreadTotal, loading, refetch }}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessages must be used inside a MessagesProvider');
  return ctx;
}
