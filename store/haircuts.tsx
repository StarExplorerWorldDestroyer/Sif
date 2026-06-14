import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { MOCK_HAIRCUTS } from '@/data/haircuts';
import type { Haircut, Stylist } from '@/types';

const STORAGE_KEY = 'haircuts.v1';

/** The fields a user fills in when adding a haircut. Everything else gets sensible defaults. */
export type NewHaircutInput = {
  cutType: string;
  location: string;
  stylistName: string;
  date: string;
  price: number;
  tip: number;
  notes: string;
  /** Local file URI of a chosen/captured photo. Falls back to a placeholder if absent. */
  photoUri?: string;
};

type HaircutsContextValue = {
  haircuts: Haircut[];
  loading: boolean;
  addHaircut: (input: NewHaircutInput) => void;
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

export function HaircutsProvider({ children }: { children: ReactNode }) {
  const [haircuts, setHaircuts] = useState<Haircut[]>([]);
  const [loading, setLoading] = useState(true);

  // Load saved haircuts once on startup, seeding with mock data the first time.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setHaircuts(JSON.parse(stored));
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

  // Persist whenever the list changes (after the initial load).
  useEffect(() => {
    if (!loading) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(haircuts)).catch(() => {});
    }
  }, [haircuts, loading]);

  function addHaircut(input: NewHaircutInput) {
    const newHaircut: Haircut = {
      id: Date.now().toString(),
      date: input.date,
      cutType: input.cutType.trim() || 'Haircut',
      location: input.location.trim(),
      photoUrl: input.photoUri || `https://picsum.photos/seed/${Date.now()}/400/400`,
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
    // Newest first.
    setHaircuts((prev) => [newHaircut, ...prev]);
  }

  function getById(id: string) {
    return haircuts.find((h) => h.id === id);
  }

  return (
    <HaircutsContext.Provider value={{ haircuts, loading, addHaircut, getById }}>
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
