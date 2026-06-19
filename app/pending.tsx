import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useMoney } from '@/hooks/use-money';
import { primaryPhotoUri } from '@/lib/photos';
import { useHaircuts } from '@/store/haircuts';

export default function PendingScreen() {
  const centered = useCenteredContent(640);
  const { pending, acceptPending, rejectPending } = useHaircuts();
  const money = useMoney();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="From your stylist" />

      <ScrollView contentContainerStyle={[styles.content, centered]} showsVerticalScrollIndicator={false}>
        {pending.length === 0 ? (
          <View style={styles.empty}>
            <IconSymbol name="scissors" size={40} color={Palette.textDim} />
            <Txt variant="label" style={styles.muted}>
              No cuts waiting for review.
            </Txt>
          </View>
        ) : (
          pending.map((h) => {
            const uri = primaryPhotoUri(h);
            return (
              <View key={h.id} style={styles.card}>
                {uri ? (
                  <Image source={{ uri }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={[styles.photo, styles.photoPlaceholder]}>
                    <IconSymbol name="scissors" size={28} color={Palette.textMuted} />
                  </View>
                )}
                <View style={styles.body}>
                  <Txt variant="heading">{h.cutType}</Txt>
                  <Txt variant="caption" color={Palette.textMuted}>
                    {h.stylist.name} · {h.date}
                  </Txt>
                  {h.location ? <Txt variant="label">{h.location}</Txt> : null}
                  {h.price > 0 ? (
                    <Txt variant="label">{money(h.price + h.tip)}</Txt>
                  ) : null}
                  {h.publicNotes ? (
                    <Txt variant="label" style={styles.notes}>
                      {h.publicNotes}
                    </Txt>
                  ) : null}

                  <View style={styles.actions}>
                    <Pressable style={[styles.btn, styles.accept]} onPress={() => acceptPending(h.id)}>
                      <Txt variant="label" color={Palette.black} style={{ fontWeight: '600' }}>
                        Add to my cuts
                      </Txt>
                    </Pressable>
                    <Pressable style={[styles.btn, styles.reject]} onPress={() => rejectPending(h.id)}>
                      <Txt variant="label" color={Palette.textMuted}>
                        Reject
                      </Txt>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl * 2 },
  muted: { color: Palette.textMuted },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  photo: { width: '100%', aspectRatio: 1.2, backgroundColor: Palette.surfaceAlt },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.lg, gap: Spacing.xs },
  notes: { marginTop: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill, alignItems: 'center' },
  accept: { backgroundColor: Palette.accent },
  reject: { borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
});
