import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/ui/field';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { primaryPhotoUri } from '@/lib/photos';
import { useHaircuts } from '@/store/haircuts';
import { usePosts } from '@/store/posts';

export default function NewPostScreen() {
  const router = useRouter();
  const { haircuts } = useHaircuts();
  const { createPost } = usePosts();

  const [selected, setSelected] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);

  const canPost = !!selected && !saving;

  async function handlePost() {
    if (!canPost) return;
    setSaving(true);
    const haircut = haircuts.find((h) => h.id === selected);
    await createPost(selected!, caption, {
      photoUrl: haircut ? primaryPhotoUri(haircut) : '',
      cutType: haircut?.cutType ?? '',
    });
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

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field
          label="Caption"
          placeholder="Say something about this cut…"
          value={caption}
          onChangeText={setCaption}
          multiline
        />

        <Txt variant="label" style={styles.pickLabel}>
          Pick a haircut to post
        </Txt>

        {haircuts.length === 0 ? (
          <Txt variant="label">Save a haircut first, then you can post it here.</Txt>
        ) : (
          <View style={styles.grid}>
            {haircuts.map((h) => {
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
  pickLabel: { marginBottom: Spacing.md },
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
