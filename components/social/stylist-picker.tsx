import { AppImage as Image } from '@/components/ui/app-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { searchUsers } from '@/lib/public';
import type { UserSearchResult } from '@/types';

/**
 * Search for and pick a stylist (any Sif user marked as a stylist) to tag/credit
 * on a post. Shows the current selection as a removable chip.
 */
export function StylistPicker({
  value,
  onChange,
}: {
  value: UserSearchResult | null;
  onChange: (stylist: UserSearchResult | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const found = await searchUsers(q);
      setResults(found.filter((u) => u.isStylist));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  if (value) {
    return (
      <View style={styles.selected}>
        <Avatar uri={value.avatarUrl} />
        <View style={{ flex: 1 }}>
          <Txt variant="body" numberOfLines={1}>
            {value.displayName || value.username || 'Stylist'}
          </Txt>
          {value.username ? (
            <Txt variant="caption" color={Palette.textMuted}>
              @{value.username}
            </Txt>
          ) : null}
        </View>
        <Pressable hitSlop={8} onPress={() => onChange(null)}>
          <IconSymbol name="xmark" size={18} color={Palette.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.searchBox}>
        <IconSymbol name="scissors" size={16} color={Palette.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search stylists by name or @username"
          placeholderTextColor={Palette.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      {query.trim().length >= 2 ? (
        <View style={styles.results}>
          {searching ? (
            <ActivityIndicator color={Palette.accent} style={{ paddingVertical: Spacing.md }} />
          ) : results.length === 0 ? (
            <Txt variant="caption" style={styles.empty}>
              No stylists found. They need a stylist account to be tagged.
            </Txt>
          ) : (
            results.map((u) => (
              <Pressable
                key={u.id}
                style={styles.row}
                onPress={() => {
                  onChange(u);
                  setQuery('');
                  setResults([]);
                }}>
                <Avatar uri={u.avatarUrl} />
                <View style={{ flex: 1 }}>
                  <Txt variant="body" numberOfLines={1}>
                    {u.displayName || u.username || 'Stylist'}
                  </Txt>
                  {u.username ? (
                    <Txt variant="caption" color={Palette.textMuted}>
                      @{u.username}
                    </Txt>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

function Avatar({ uri }: { uri: string }) {
  if (uri) return <Image source={{ uri }} style={styles.avatar} contentFit="cover" />;
  return (
    <View style={[styles.avatar, styles.avatarPlaceholder]}>
      <IconSymbol name="person.fill" size={16} color={Palette.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  input: { flex: 1, color: Palette.text, fontSize: 15, paddingVertical: 2 },
  results: { marginTop: Spacing.sm },
  empty: { paddingVertical: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.md,
  },
  avatar: { width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
});
