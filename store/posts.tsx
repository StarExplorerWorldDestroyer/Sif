import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import type { Post } from '@/types';

type PostsContextValue = {
  posts: Post[];
  loading: boolean;
  createPost: (haircutId: string, caption: string) => Promise<void>;
  updatePost: (id: string, caption: string) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  getById: (id: string) => Post | undefined;
};

const PostsContext = createContext<PostsContextValue | null>(null);

function rowToPost(row: any): Post {
  return {
    id: row.id,
    haircutId: row.haircut_id,
    caption: row.caption ?? '',
    createdAt: row.created_at,
  };
}

export function PostsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setPosts([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPosts(data.map(rowToPost));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  async function createPost(haircutId: string, caption: string) {
    await supabase.from('posts').insert({ haircut_id: haircutId, caption: caption.trim() });
    await refetch();
  }

  async function updatePost(id: string, caption: string) {
    await supabase.from('posts').update({ caption: caption.trim() }).eq('id', id);
    await refetch();
  }

  async function deletePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    await supabase.from('posts').delete().eq('id', id);
  }

  function getById(id: string) {
    return posts.find((p) => p.id === id);
  }

  return (
    <PostsContext.Provider value={{ posts, loading, createPost, updatePost, deletePost, getById }}>
      {children}
    </PostsContext.Provider>
  );
}

export function usePosts() {
  const ctx = useContext(PostsContext);
  if (!ctx) throw new Error('usePosts must be used inside a PostsProvider');
  return ctx;
}
