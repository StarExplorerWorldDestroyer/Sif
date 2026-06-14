import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import { isRemote, uploadPhoto } from '@/lib/photos';
import { useAuth } from '@/store/auth';
import type { Haircut, Photo, Stylist } from '@/types';

/** The fields a user fills in when adding/editing a haircut. */
export type HaircutFormInput = {
  cutType: string;
  location: string;
  stylistName: string;
  date: string;
  price: number;
  tip: number;
  notes: string;
  photos: Photo[];
  lengthTop: string;
  lengthSides: string;
  lengthBack: string;
  techniques: string[];
  tools: string[];
};

type HaircutsContextValue = {
  haircuts: Haircut[];
  loading: boolean;
  refetch: () => Promise<void>;
  addHaircut: (input: HaircutFormInput) => Promise<void>;
  updateHaircut: (id: string, input: HaircutFormInput) => Promise<void>;
  deleteHaircut: (id: string) => Promise<void>;
  toggleLike: (id: string) => void;
  toggleBookmark: (id: string) => void;
  getById: (id: string) => Haircut | undefined;
};

const HaircutsContext = createContext<HaircutsContextValue | null>(null);

function defaultStylist(name: string): Stylist {
  return {
    name: name.trim() || 'Unknown stylist',
    handle: '',
    avatarUrl: 'https://i.pravatar.cc/150?img=68',
    rating: 0,
    totalCuts: 0,
    specialties: [],
    bio: '',
    verified: false,
  };
}

/** Map a database row (+ embedded photos) into the app's Haircut shape. */
function rowToHaircut(row: any): Haircut {
  const stylist = row.stylist && Object.keys(row.stylist).length > 0
    ? { ...defaultStylist(row.stylist.name ?? ''), ...row.stylist }
    : defaultStylist('');
  const photos: Photo[] = (row.photos ?? [])
    .slice()
    .sort((a: any, b: any) => a.position - b.position)
    .map((p: any) => ({ id: p.id, uri: p.uri, angle: p.angle, note: p.note }));
  return {
    id: row.id,
    date: row.date,
    cutType: row.cut_type,
    location: row.location,
    photos,
    price: Number(row.price),
    tip: Number(row.tip),
    likes: row.likes,
    comments: row.comments,
    liked: row.liked,
    bookmarked: row.bookmarked,
    lengthTop: row.length_top,
    lengthSides: row.length_sides,
    lengthBack: row.length_back,
    techniques: row.techniques ?? [],
    tools: row.tools ?? [],
    publicNotes: row.public_notes,
    privateNotes: row.private_notes,
    stylistNotes: row.stylist_notes,
    stylist,
  };
}

/** Convert form input into the column values for the haircuts table. */
function inputToRow(input: HaircutFormInput) {
  return {
    date: input.date,
    cut_type: input.cutType.trim() || 'Haircut',
    location: input.location.trim(),
    price: input.price,
    tip: input.tip,
    length_top: input.lengthTop.trim(),
    length_sides: input.lengthSides.trim(),
    length_back: input.lengthBack.trim(),
    techniques: input.techniques,
    tools: input.tools,
    public_notes: input.notes.trim(),
    stylist: defaultStylist(input.stylistName),
  };
}

export function HaircutsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [haircuts, setHaircuts] = useState<Haircut[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setHaircuts([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('haircuts')
      .select('*, photos(*)')
      .order('date', { ascending: false });
    if (!error && data) {
      setHaircuts(data.map(rowToHaircut));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  /** Upload any local photos and return photo rows ready for insertion. */
  async function preparePhotoRows(haircutId: string, photos: Photo[]) {
    const rows = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const uri = isRemote(photo.uri)
        ? photo.uri
        : await uploadPhoto(user!.id, haircutId, photo.id, photo.uri);
      rows.push({ haircut_id: haircutId, uri, angle: photo.angle, note: photo.note, position: i });
    }
    return rows;
  }

  async function addHaircut(input: HaircutFormInput) {
    if (!user) return;
    const { data, error } = await supabase
      .from('haircuts')
      .insert(inputToRow(input))
      .select()
      .single();
    if (error || !data) throw error ?? new Error('Failed to save haircut');

    const photoRows = await preparePhotoRows(data.id, input.photos);
    if (photoRows.length > 0) {
      await supabase.from('photos').insert(photoRows);
    }
    await refetch();
  }

  async function updateHaircut(id: string, input: HaircutFormInput) {
    if (!user) return;
    const { error } = await supabase.from('haircuts').update(inputToRow(input)).eq('id', id);
    if (error) throw error;

    // Replace the photo set: upload new ones, then swap rows.
    const photoRows = await preparePhotoRows(id, input.photos);
    await supabase.from('photos').delete().eq('haircut_id', id);
    if (photoRows.length > 0) {
      await supabase.from('photos').insert(photoRows);
    }
    await refetch();
  }

  async function deleteHaircut(id: string) {
    setHaircuts((prev) => prev.filter((h) => h.id !== id));
    await supabase.from('haircuts').delete().eq('id', id);
  }

  function toggleLike(id: string) {
    const current = haircuts.find((h) => h.id === id);
    if (!current) return;
    const liked = !current.liked;
    const likes = current.likes + (current.liked ? -1 : 1);
    setHaircuts((prev) => prev.map((h) => (h.id === id ? { ...h, liked, likes } : h)));
    supabase.from('haircuts').update({ liked, likes }).eq('id', id).then(() => {});
  }

  function toggleBookmark(id: string) {
    const current = haircuts.find((h) => h.id === id);
    if (!current) return;
    const bookmarked = !current.bookmarked;
    setHaircuts((prev) => prev.map((h) => (h.id === id ? { ...h, bookmarked } : h)));
    supabase.from('haircuts').update({ bookmarked }).eq('id', id).then(() => {});
  }

  function getById(id: string) {
    return haircuts.find((h) => h.id === id);
  }

  return (
    <HaircutsContext.Provider
      value={{
        haircuts,
        loading,
        refetch,
        addHaircut,
        updateHaircut,
        deleteHaircut,
        toggleLike,
        toggleBookmark,
        getById,
      }}>
      {children}
    </HaircutsContext.Provider>
  );
}

export function useHaircuts() {
  const ctx = useContext(HaircutsContext);
  if (!ctx) {
    throw new Error('useHaircuts must be used inside a HaircutsProvider');
  }
  return ctx;
}
