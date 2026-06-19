import { useCallback, useState } from 'react';

/**
 * Small helper for pull-to-refresh on scroll views and lists. Wraps a loader,
 * tracking a `refreshing` flag that's cleared when the load settles.
 *
 * Usage:
 *   const { refreshing, onRefresh } = useRefresh(load);
 *   <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.accent} />}>
 */
export function useRefresh(load: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);
  return { refreshing, onRefresh };
}
