import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { primaryPhotoUri } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useHaircuts } from '@/store/haircuts';
import type { Post, PostVisibility } from '@/types';

type PostsContextValue = {
  posts: Post[];
  loading: boolean;
  createPost: (
    haircutId: string,
    caption: string,
    snapshot: { photoUrl: string; cutType: string },
    visibility?: PostVisibility,
  ) => Promise<void>;
  updatePost: (id: string, caption: string, visibility?: PostVisibility) => Promise<void>;
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
    photoUrl: row.photo_url ?? '',
    cutType: row.cut_type ?? '',
    visibility: (row.visibility as PostVisibility) ?? 'public',
  };
}

export function PostsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { haircuts } = useHaircuts();
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
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setPosts(data.map(rowToPost));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  // Self-heal: older posts created before the photo/cut-type snapshot existed
  // have empty values. Backfill them from the owner's haircut data so they
  // render on the public feed and profile pages.
  useEffect(() => {
    const stale = posts.filter((p) => !p.photoUrl || !p.cutType);
    if (stale.length === 0 || haircuts.length === 0) return;
    (async () => {
      let changed = false;
      for (const post of stale) {
        const haircut = haircuts.find((h) => h.id === post.haircutId);
        if (!haircut) continue;
        await supabase
          .from('posts')
          .update({ photo_url: primaryPhotoUri(haircut), cut_type: haircut.cutType })
          .eq('id', post.id);
        changed = true;
      }
      if (changed) refetch();
    })();
  }, [posts, haircuts, refetch]);

  async function createPost(
    haircutId: string,
    caption: string,
    snapshot: { photoUrl: string; cutType: string },
    visibility: PostVisibility = 'public',
  ) {
    await supabase.from('posts').insert({
      haircut_id: haircutId,
      caption: caption.trim(),
      photo_url: snapshot.photoUrl,
      cut_type: snapshot.cutType,
      visibility,
    });
    await refetch();
  }

  async function updatePost(id: string, caption: string, visibility?: PostVisibility) {
    const patch: Record<string, unknown> = { caption: caption.trim() };
    if (visibility !== undefined) patch.visibility = visibility;
    await supabase.from('posts').update(patch).eq('id', id);
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
