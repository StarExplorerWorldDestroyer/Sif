import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import { isRemote, uploadPhoto } from '@/lib/photos';
import { useAuth } from '@/store/auth';
import type { Haircut, HaircutUpdate, Photo, Stylist } from '@/types';

/** Lightweight unique id for storage file names. */
function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** The fields a user fills in when adding/editing a haircut. */
export type HaircutFormInput = {
  cutType: string;
  location: string;
  stylistName: string;
  /** Linked stylist account id, if the stylist was picked from search. */
  stylistId: string | null;
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
  /** Cuts a stylist submitted to you, awaiting your acceptance. */
  pending: Haircut[];
  loading: boolean;
  refetch: () => Promise<void>;
  addHaircut: (input: HaircutFormInput) => Promise<void>;
  /** Stylist: submit a cut to a connected client's account (lands as pending). */
  createForClient: (clientId: string, input: HaircutFormInput) => Promise<void>;
  acceptPending: (id: string) => Promise<void>;
  rejectPending: (id: string) => Promise<void>;
  updateHaircut: (id: string, input: HaircutFormInput) => Promise<void>;
  deleteHaircut: (id: string) => Promise<void>;
  toggleLike: (id: string) => void;
  toggleBookmark: (id: string) => void;
  getById: (id: string) => Haircut | undefined;
  // Follow-up timeline (grow-out updates) for a haircut.
  fetchUpdates: (haircutId: string) => Promise<HaircutUpdate[]>;
  /** All grow-out updates across your cuts, newest first (for the journal). */
  fetchAllUpdates: () => Promise<HaircutUpdate[]>;
  addUpdate: (
    haircutId: string,
    update: { uri: string; note: string; takenOn: string },
  ) => Promise<void>;
  deleteUpdate: (id: string) => Promise<void>;
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
    stylistId: row.stylist_id ?? null,
    status: row.status ?? 'active',
    createdBy: row.created_by ?? row.user_id,
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
    stylist_id: input.stylistId,
  };
}

function rowToUpdate(row: any): HaircutUpdate {
  return {
    id: row.id,
    haircutId: row.haircut_id,
    uri: row.uri,
    note: row.note ?? '',
    takenOn: row.taken_on,
    createdAt: row.created_at,
  };
}

export function HaircutsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [haircuts, setHaircuts] = useState<Haircut[]>([]);
  const [pending, setPending] = useState<Haircut[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setHaircuts([]);
      setPending([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('haircuts')
      .select('*, photos(*)')
      .order('date', { ascending: false });
    if (!error && data) {
      // Only your own, accepted cuts belong in the main list. Pending cuts
      // (submitted by a stylist) and cuts you created for clients are excluded.
      const mine = data.filter((r: any) => r.user_id === user.id && (r.status ?? 'active') === 'active');
      setHaircuts(mine.map(rowToHaircut));
      // Pending cuts addressed to you (submitted by a stylist for your account).
      const incoming = data.filter((r: any) => r.user_id === user.id && r.status === 'pending');
      setPending(incoming.map(rowToHaircut));
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

  async function createForClient(clientId: string, input: HaircutFormInput) {
    if (!user) return;
    // user_id = the client; created_by defaults to the stylist (auth.uid());
    // status 'pending' so it lands in the client's inbox for acceptance.
    const { data, error } = await supabase
      .from('haircuts')
      .insert({ ...inputToRow(input), user_id: clientId, status: 'pending' })
      .select()
      .single();
    if (error || !data) throw error ?? new Error('Failed to submit cut');

    const photoRows = await preparePhotoRows(data.id, input.photos);
    if (photoRows.length > 0) {
      await supabase.from('photos').insert(photoRows);
    }
  }

  async function acceptPending(id: string) {
    setPending((prev) => prev.filter((h) => h.id !== id));
    await supabase.from('haircuts').update({ status: 'active' }).eq('id', id);
    await refetch();
  }

  async function rejectPending(id: string) {
    setPending((prev) => prev.filter((h) => h.id !== id));
    await supabase.from('haircuts').delete().eq('id', id);
  }

  async function fetchUpdates(haircutId: string): Promise<HaircutUpdate[]> {
    const { data } = await supabase
      .from('haircut_updates')
      .select('*')
      .eq('haircut_id', haircutId)
      .order('taken_on', { ascending: true });
    return (data ?? []).map(rowToUpdate);
  }

  const fetchAllUpdates = useCallback(async (): Promise<HaircutUpdate[]> => {
    if (!user || haircuts.length === 0) return [];
    const ids = haircuts.map((h) => h.id);
    const { data } = await supabase
      .from('haircut_updates')
      .select('*')
      .in('haircut_id', ids)
      .order('taken_on', { ascending: false });
    return (data ?? []).map(rowToUpdate);
  }, [user, haircuts]);

  async function addUpdate(
    haircutId: string,
    update: { uri: string; note: string; takenOn: string },
  ) {
    if (!user) return;
    const uri = isRemote(update.uri)
      ? update.uri
      : await uploadPhoto(user.id, haircutId, `update-${newId()}`, update.uri);
    await supabase.from('haircut_updates').insert({
      haircut_id: haircutId,
      uri,
      note: update.note.trim(),
      taken_on: update.takenOn,
    });
  }

  async function deleteUpdate(id: string) {
    await supabase.from('haircut_updates').delete().eq('id', id);
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
        pending,
        loading,
        refetch,
        addHaircut,
        createForClient,
        acceptPending,
        rejectPending,
        updateHaircut,
        deleteHaircut,
        toggleLike,
        toggleBookmark,
        getById,
        fetchUpdates,
        fetchAllUpdates,
        addUpdate,
        deleteUpdate,
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
