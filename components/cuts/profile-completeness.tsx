import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import { useHaircuts } from '@/store/haircuts';
import { useProfile } from '@/store/profile';

/**
 * A dismissible "finish setting up" checklist shown at the top of the Cuts tab
 * until the user completes the key steps (photo, bio, first cut, public). Helps
 * new accounts feel guided instead of dropped into an empty app.
 */
export function ProfileCompleteness() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { haircuts } = useHaircuts();

  // Start dismissed so the card never flashes before we've read storage.
  const [dismissed, setDismissed] = useState(true);
  const storageKey = user ? `sif:profile-card-dismissed:${user.id}` : null;

  useEffect(() => {
    if (!storageKey) return;
    AsyncStorage.getItem(storageKey).then((v) => setDismissed(v === '1'));
  }, [storageKey]);

  const items = useMemo(
    () => [
      { id: 'photo', label: 'Add a profile photo', done: !!profile?.avatarUrl, go: () => router.push('/profile/edit') },
      { id: 'bio', label: 'Write a short bio', done: !!profile?.bio, go: () => router.push('/profile/edit') },
      { id: 'cut', label: 'Add your first cut', done: haircuts.length > 0, go: () => router.push('/add') },
      { id: 'public', label: 'Make your profile public', done: profile?.privacy === 'public', go: () => router.push('/settings') },
    ],
    [profile?.avatarUrl, profile?.bio, profile?.privacy, haircuts.length, router],
  );

  const doneCount = items.filter((i) => i.done).length;

  function dismiss() {
    setDismissed(true);
    if (storageKey) AsyncStorage.setItem(storageKey, '1');
  }

  if (!profile || dismissed || doneCount === items.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">Finish setting up</Txt>
          <Txt variant="caption" color={Palette.textMuted}>
            {doneCount} of {items.length} done
          </Txt>
        </View>
        <Pressable onPress={dismiss} hitSlop={8} style={styles.close}>
          <IconSymbol name="xmark" size={16} color={Palette.textMuted} />
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(doneCount / items.length) * 100}%` }]} />
      </View>

      <View style={styles.list}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.item}
            onPress={item.done ? undefined : item.go}
            disabled={item.done}>
            <View style={[styles.tick, item.done && styles.tickOn]}>
              {item.done ? <IconSymbol name="checkmark" size={13} color={Palette.black} /> : null}
            </View>
            <Txt
              variant="label"
              color={item.done ? Palette.textDim : Palette.text}
              style={item.done ? styles.doneText : undefined}>
              {item.label}
            </Txt>
            {!item.done ? (
              <IconSymbol name="chevron.right" size={15} color={Palette.textDim} style={styles.chevron} />
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  close: { padding: Spacing.xs },
  progressTrack: { height: 6, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: Radius.pill, backgroundColor: Palette.accent },
  list: { gap: Spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  tick: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Palette.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: Palette.success, borderColor: Palette.success },
  doneText: { textDecorationLine: 'line-through' },
  chevron: { marginLeft: 'auto' },
});
