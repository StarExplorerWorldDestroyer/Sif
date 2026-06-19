import { AppImage as Image } from '@/components/ui/app-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StylistPicker } from '@/components/social/stylist-picker';
import { Field } from '@/components/ui/field';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchCardsByIds } from '@/lib/public';
import { hasPhoto, primaryPhotoUri } from '@/lib/photos';
import { useCenteredContent } from '@/hooks/use-responsive';
import { useHaircuts } from '@/store/haircuts';
import { usePosts } from '@/store/posts';
import { POST_VISIBILITY_OPTIONS, type PostVisibility, type UserSearchResult } from '@/types';

export default function NewPostScreen() {
  const router = useRouter();
  const { haircuts } = useHaircuts();
  const { createPost } = usePosts();
  const centered = useCenteredContent(640);

  // Posts always feature the haircut's photo, so only photo'd cuts are postable.
  const postable = haircuts.filter(hasPhoto);

  const [selected, setSelected] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [stylist, setStylist] = useState<UserSearchResult | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedHaircut = postable.find((h) => h.id === selected);
  const canPost = !!selectedHaircut && !saving;

  // Prefill the stylist tag from the chosen cut's linked stylist, if any.
  const selectedStylistId = selectedHaircut?.stylistId ?? null;
  useEffect(() => {
    if (!selectedStylistId) return;
    let active = true;
    fetchCardsByIds([selectedStylistId]).then((cards) => {
      if (active && cards[0]) setStylist(cards[0]);
    });
    return () => {
      active = false;
    };
  }, [selectedStylistId]);

  async function handlePost() {
    if (!canPost || !selectedHaircut) return;
    setSaving(true);
    await createPost(
      selectedHaircut.id,
      caption,
      {
        photoUrl: primaryPhotoUri(selectedHaircut),
        cutType: selectedHaircut.cutType,
      },
      visibility,
      stylist?.id ?? null,
    );
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Txt variant="body" color={Palette.textMuted}>
            Cancel
          </Txt>
        </Pressable>
        <Txt variant="heading">New Post</Txt>
        <Pressable onPress={handlePost} hitSlop={8} disabled={!canPost}>
          <Txt variant="body" color={canPost ? Palette.accent : Palette.textDim}>
            Share
          </Txt>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, centered]} keyboardShouldPersistTaps="handled">
        <Field
          label="Caption"
          placeholder="Say something about this cut…"
          value={caption}
          onChangeText={setCaption}
          multiline
        />

        <Txt variant="label" style={styles.pickLabel}>
          Who can see this
        </Txt>
        <View style={styles.visRow}>
          {POST_VISIBILITY_OPTIONS.map((opt) => {
            const active = visibility === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setVisibility(opt.value)}
                style={[styles.visPill, active && styles.visPillActive]}>
                <Txt variant="caption" color={active ? Palette.black : Palette.textMuted}>
                  {opt.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        <Txt variant="label" style={styles.pickLabel}>
          Tag your stylist
        </Txt>
        <StylistPicker value={stylist} onChange={setStylist} />

        <Txt variant="label" style={styles.pickLabel}>
          Pick a haircut to post
        </Txt>

        {postable.length === 0 ? (
          <Txt variant="label">
            {haircuts.length === 0
              ? 'Save a haircut first, then you can post it here.'
              : 'Add a photo to one of your haircuts — posts always show the photo.'}
          </Txt>
        ) : (
          <View style={styles.grid}>
            {postable.map((h) => {
              const isSelected = selected === h.id;
              return (
                <Pressable
                  key={h.id}
                  style={styles.cell}
                  onPress={() => setSelected(isSelected ? null : h.id)}>
                  <Image
                    source={{ uri: primaryPhotoUri(h) }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                  {isSelected ? (
                    <View style={styles.selectedOverlay}>
                      <View style={styles.check}>
                        <IconSymbol name="checkmark" size={16} color={Palette.black} />
                      </View>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  pickLabel: { marginBottom: Spacing.md, marginTop: Spacing.lg },
  visRow: { flexDirection: 'row', gap: Spacing.sm },
  visPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  visPillActive: { backgroundColor: Palette.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.333%', aspectRatio: 1, padding: 1 },
  thumb: { flex: 1, borderRadius: Radius.sm, backgroundColor: Palette.surfaceAlt },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    margin: 1,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
