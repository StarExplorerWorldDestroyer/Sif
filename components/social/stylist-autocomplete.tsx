import { AppImage as Image } from '@/components/ui/app-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { searchUsers } from '@/lib/public';
import type { UserSearchResult } from '@/types';

/**
 * A combobox for the haircut "Stylist" field: free-type a name, and matching
 * stylist accounts surface as you type. Picking one links that account
 * (`onPick`) while still filling the text name; editing the text again clears
 * the link. Works for stylists who aren't on Sif too (just type the name).
 */
export function StylistAutocomplete({
  label,
  name,
  linked,
  onChangeName,
  onPick,
}: {
  label: string;
  name: string;
  /** Whether a real account is currently linked (controls the checkmark). */
  linked: boolean;
  onChangeName: (text: string) => void;
  onPick: (stylist: UserSearchResult | null) => void;
}) {
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = name.trim();
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
  }, [name, open]);

  return (
    <View style={styles.wrap}>
      <Txt variant="label" style={styles.label}>
        {label}
      </Txt>
      <View style={styles.inputRow}>
        <TextInput
          value={name}
          onChangeText={(t) => {
            onChangeName(t);
            onPick(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="e.g. Marcus Reyes — or search @username"
          placeholderTextColor={Palette.textDim}
          autoCapitalize="words"
          autoCorrect={false}
          style={styles.input}
        />
        {linked ? (
          <IconSymbol name="checkmark.seal.fill" size={18} color={Palette.accent} />
        ) : null}
      </View>

      {open && name.trim().length >= 2 ? (
        <View style={styles.dropdown}>
          {searching ? (
            <ActivityIndicator color={Palette.accent} style={{ paddingVertical: Spacing.sm }} />
          ) : results.length === 0 ? (
            <Txt variant="caption" style={styles.empty}>
              No stylist accounts match — you can still type the name.
            </Txt>
          ) : (
            results.map((u) => (
              <Pressable
                key={u.id}
                style={styles.row}
                onPress={() => {
                  onChangeName(u.displayName || u.username || 'Stylist');
                  onPick(u);
                  setOpen(false);
                  setResults([]);
                }}>
                {u.avatarUrl ? (
                  <Image source={{ uri: u.avatarUrl }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <IconSymbol name="person.fill" size={14} color={Palette.textMuted} />
                  </View>
                )}
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
                <IconSymbol name="plus" size={16} color={Palette.accent} />
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg },
  label: { marginBottom: Spacing.xs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
  },
  input: { flex: 1, color: Palette.text, fontSize: FontSize.md, paddingVertical: Spacing.md },
  dropdown: {
    marginTop: Spacing.xs,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
  },
  empty: { paddingVertical: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
});
