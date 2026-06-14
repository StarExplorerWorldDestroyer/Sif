import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { MOCK_HAIRCUTS } from '@/data/haircuts';
import type { Haircut, Photo, Stylist } from '@/types';

const STORAGE_KEY = 'haircuts.v1';

/** The fields a user fills in when adding/editing a haircut. */
export type HaircutFormInput = {
  cutType: string;
  location: string;
  stylistName: string;
  date: string;
  price: number;
  tip: number;
  notes: string;
  /** Photos with permanent URIs, angle tags, and notes. */
  photos: Photo[];
};

type HaircutsContextValue = {
  haircuts: Haircut[];
  loading: boolean;
  addHaircut: (input: HaircutFormInput) => void;
  updateHaircut: (id: string, input: HaircutFormInput) => void;
  deleteHaircut: (id: string) => void;
  toggleLike: (id: string) => void;
  toggleBookmark: (id: string) => void;
  getById: (id: string) => Haircut | undefined;
};

const HaircutsContext = createContext<HaircutsContextValue | null>(null);

function makeStylist(name: string): Stylist {
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

/**
 * Make sure every loaded haircut matches the current shape. Older saved data
 * used a single `photoUrl` string — convert it to a `photos` array.
 */
function normalize(raw: any): Haircut {
  const photos: Photo[] = Array.isArray(raw.photos)
    ? raw.photos
    : raw.photoUrl
      ? [{ id: `${raw.id}-0`, uri: raw.photoUrl, angle: 'front', note: '' }]
      : [];
  return { ...raw, photos };
}

export function HaircutsProvider({ children }: { children: ReactNode }) {
  const [haircuts, setHaircuts] = useState<Haircut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setHaircuts((JSON.parse(stored) as any[]).map(normalize));
        } else {
          setHaircuts(MOCK_HAIRCUTS);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_HAIRCUTS));
        }
      } catch {
        setHaircuts(MOCK_HAIRCUTS);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loading) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(haircuts)).catch(() => {});
    }
  }, [haircuts, loading]);

  function addHaircut(input: HaircutFormInput) {
    const newHaircut: Haircut = {
      id: Date.now().toString(),
      date: input.date,
      cutType: input.cutType.trim() || 'Haircut',
      location: input.location.trim(),
      photos: input.photos,
      price: input.price,
      tip: input.tip,
      likes: 0,
      comments: 0,
      liked: false,
      bookmarked: false,
      lengthTop: '',
      lengthSides: '',
      lengthBack: '',
      techniques: [],
      tools: [],
      publicNotes: input.notes.trim(),
      privateNotes: '',
      stylistNotes: '',
      stylist: makeStylist(input.stylistName),
    };
    setHaircuts((prev) => [newHaircut, ...prev]);
  }

  function updateHaircut(id: string, input: HaircutFormInput) {
    setHaircuts((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              date: input.date,
              cutType: input.cutType.trim() || 'Haircut',
              location: input.location.trim(),
              photos: input.photos,
              price: input.price,
              tip: input.tip,
              publicNotes: input.notes.trim(),
              // Keep the rest of the stylist details, just update the name.
              stylist: { ...h.stylist, name: input.stylistName.trim() || h.stylist.name },
            }
          : h,
      ),
    );
  }

  function deleteHaircut(id: string) {
    setHaircuts((prev) => prev.filter((h) => h.id !== id));
  }

  function toggleLike(id: string) {
    setHaircuts((prev) =>
      prev.map((h) =>
        h.id === id
          ? { ...h, liked: !h.liked, likes: h.likes + (h.liked ? -1 : 1) }
          : h,
      ),
    );
  }

  function toggleBookmark(id: string) {
    setHaircuts((prev) =>
      prev.map((h) => (h.id === id ? { ...h, bookmarked: !h.bookmarked } : h)),
    );
  }

  function getById(id: string) {
    return haircuts.find((h) => h.id === id);
  }

  return (
    <HaircutsContext.Provider
      value={{
        haircuts,
        loading,
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

/** Hook to read and modify haircuts from any screen. */
export function useHaircuts() {
  const ctx = useContext(HaircutsContext);
  if (!ctx) {
    throw new Error('useHaircuts must be used inside a HaircutsProvider');
  }
  return ctx;
}
