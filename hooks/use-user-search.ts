import { useEffect, useState } from 'react';

import { searchUsers } from '@/lib/public';
import type { UserSearchResult } from '@/types';

/** Minimum characters before we hit the search endpoint. */
const MIN_CHARS = 2;
/** How long to wait after the last keystroke before searching. */
const DEBOUNCE_MS = 250;

type Options = {
  /** A user id to drop from results (e.g. yourself, for messaging). */
  excludeId?: string | null;
};

/**
 * Debounced people search shared by Explore, New message, and Share.
 * Owns the query/results/loading state and the 250ms debounce so each screen
 * only has to render the box and the rows.
 */
export function useUserSearch({ excludeId }: Options = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const trimmed = query.trim();
  const active = trimmed.length >= MIN_CHARS;

  useEffect(() => {
    if (trimmed.length < MIN_CHARS) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const found = await searchUsers(trimmed);
      setResults(excludeId ? found.filter((u) => u.id !== excludeId) : found);
      setSearching(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [trimmed, excludeId]);

  return {
    query,
    setQuery,
    results,
    searching,
    /** True once the query is long enough to be searching. */
    active,
    clear: () => setQuery(''),
  };
}
