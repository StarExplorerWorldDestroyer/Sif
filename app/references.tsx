import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppImage as Image } from '@/components/ui/app-image';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent, useIsDesktop } from '@/hooks/use-responsive';
import { useRefresh } from '@/hooks/use-refresh';
import { errorMessage, reportClientError, UserError } from '@/lib/errors';
import {
  addInspirationLink,
  addInspirationPhoto,
  cacheInspirationImage,
  classifyPinterestUrl,
  deleteInspiration,
  listInspirations,
  openInspirationLink,
  type Inspiration,
} from '@/lib/inspirations';
import { useAuth } from '@/store/auth';
import { useFeedback } from '@/store/feedback';

/** Display URI for a tile (saved photo or Pinterest preview). */
function tileUri(item: Inspiration): string | null {
  return item.imageUrl || item.previewUrl || null;
}

/** Deterministic height/width ratio so the board feels masonry-like. */
function tileAspect(item: Inspiration): number {
  // width / height — smaller = taller pin
  const ratios = [0.62, 0.72, 0.8, 0.9, 1.0, 1.12];
  let hash = 0;
  for (let i = 0; i < item.id.length; i++) {
    hash = (hash + item.id.charCodeAt(i) * (i + 1)) % 997;
  }
  return ratios[hash % ratios.length];
}

/** Split items into N columns, packing into the currently shortest column. */
function buildMasonryColumns(items: Inspiration[], columnCount: number): Inspiration[][] {
  const cols: Inspiration[][] = Array.from({ length: columnCount }, () => []);
  const heights = Array.from({ length: columnCount }, () => 0);
  for (const item of items) {
    let shortest = 0;
    for (let i = 1; i < columnCount; i++) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    cols[shortest].push(item);
    // Relative column height ≈ 1 / aspect (taller tiles weigh more)
    heights[shortest] += 1 / tileAspect(item);
  }
  return cols;
}

type PickedImage = { uri: string; width?: number; height?: number };

async function pickFromLibrary(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

async function pickFromCamera(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

export type ReferencesPanelProps = {
  /** When true, omit the stack header — used inside the Styles tab. */
  embedded?: boolean;
};

export function ReferencesPanel({ embedded = false }: ReferencesPanelProps = {}) {
  const { user } = useAuth();
  const { toast, confirm, prompt } = useFeedback();
  const centered = useCenteredContent(1100);
  const isDesktop = useIsDesktop();
  const { width: windowWidth } = useWindowDimensions();

  const [items, setItems] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<Inspiration | null>(null);
  const [savingLook, setSavingLook] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const addButton = (
    <Pressable
      onPress={() => setAddOpen(true)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Add reference">
      <IconSymbol name="plus" size={26} color={Palette.accent} />
    </Pressable>
  );

  const wrap = (children: ReactNode) =>
    embedded ? (
      <View style={styles.safe}>
        <View style={styles.embeddedBar}>
          <Txt variant="label" color={Palette.textMuted}>
            References
          </Txt>
          {addButton}
        </View>
        {children}
      </View>
    ) : (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="References" right={addButton} />
        {children}
      </SafeAreaView>
    );

  const reload = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const list = await listInspirations(user.id);
    setItems(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const { refreshing, onRefresh } = useRefresh(reload);

  const onAddPhoto = async (from: 'library' | 'camera') => {
    if (!user) return;
    setAddOpen(false);
    const img = from === 'camera' ? await pickFromCamera() : await pickFromLibrary();
    if (!img) return;
    setBusy(true);
    try {
      const row = await addInspirationPhoto(user.id, img.uri, {
        width: img.width,
        height: img.height,
      });
      setItems((prev) => [row, ...prev]);
      toast('Saved to your references.', { tone: 'success' });
    } catch (e) {
      reportClientError({
        scope: 'inspirations.add_photo',
        message: errorMessage(e),
      });
      toast(UserError.generic, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onPasteLink = async () => {
    if (!user) return;
    setAddOpen(false);
    const raw = await prompt({
      title: 'Paste a Pinterest link',
      message: 'Pin or board URL. Boards open in Pinterest; pins are saved as links you can reopen anytime.',
      placeholder: 'https://pinterest.com/…',
      confirmLabel: 'Save',
    });
    if (!raw?.trim()) return;

    const classified = classifyPinterestUrl(raw);
    setBusy(true);
    try {
      const row = await addInspirationLink(user.id, raw);
      setItems((prev) => [row, ...prev]);

      // For pins, optionally also keep a local photo (user downloads/screenshots).
      if (classified.kind === 'pin') {
        const alsoPhoto = await confirm({
          title: 'Save a photo too?',
          message:
            'Pinterest doesn’t let apps pull pin images. If you saved or screenshotted the look, add it now so you can enlarge and use it in Try-on.',
          confirmLabel: 'Add photo',
          cancelLabel: 'Link only',
        });
        if (alsoPhoto) {
          const img = await pickFromLibrary();
          if (img) {
            const photo = await addInspirationPhoto(user.id, img.uri, {
              width: img.width,
              height: img.height,
              sourceUrl: row.url ?? classified.url,
              title: row.title || 'Pinterest pin',
            });
            setItems((prev) => [photo, ...prev]);
          }
        }
      }

      toast(
        classified.kind === 'board' ? 'Board saved.' : 'Link saved.',
        { tone: 'success' },
      );
    } catch (e) {
      const msg = errorMessage(e);
      reportClientError({ scope: 'inspirations.add_link', message: msg });
      toast(
        /valid link/i.test(msg) ? msg : UserError.generic,
        { tone: 'error' },
      );
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (item: Inspiration) => {
    const ok = await confirm({
      title: item.kind === 'photo' ? 'Delete this photo?' : 'Remove this link?',
      message: 'This can’t be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    if (viewing?.id === item.id) setViewing(null);
    const done = await deleteInspiration(item);
    if (!done) {
      toast('Could not delete. Please try again.', { tone: 'error' });
      reload();
    }
  };

  const onOpenLink = async (item: Inspiration) => {
    const url = item.url ?? item.sourceUrl;
    if (!url) return;
    try {
      await openInspirationLink(url);
    } catch (e) {
      reportClientError({
        scope: 'inspirations.open_link',
        message: errorMessage(e),
      });
      toast('Could not open that link.', { tone: 'error' });
    }
  };

  const onSaveShare = async (item: Inspiration) => {
    const uri = tileUri(item);
    if (!uri) return;
    setSavingLook(true);
    try {
      if (Platform.OS === 'web') {
        await Linking.openURL(uri);
        toast('Opened photo — right-click or long-press to save.', { tone: 'success' });
        return;
      }
      const local = await cacheInspirationImage(uri);
      await Share.share(
        Platform.OS === 'ios'
          ? { url: local }
          : { message: local, url: local, title: item.title || 'Reference' },
      );
    } catch (e) {
      reportClientError({
        scope: 'inspirations.save_share',
        message: errorMessage(e),
      });
      toast(UserError.generic, { tone: 'error' });
    } finally {
      setSavingLook(false);
    }
  };

  const onTilePress = (item: Inspiration) => {
    if (tileUri(item)) setViewing(item);
    else void onOpenLink(item);
  };

  // 2 cols phone / tablet; 3 on wide desktop. Content is capped by centered maxWidth.
  const columnCount = isDesktop && windowWidth >= 1100 ? 3 : 2;
  const columns = useMemo(
    () => buildMasonryColumns(items, columnCount),
    [items, columnCount],
  );

  return wrap(
    <>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Save looks you love"
          subtitle="Add photos from your camera roll, or paste a Pinterest pin or board link to open later."
          primaryLabel="Add a photo"
          onPrimary={() => setAddOpen(true)}
          secondaryLabel="Paste a Pinterest link"
          onSecondary={onPasteLink}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.accent} />
          }>
          <View style={styles.masonry}>
            {columns.map((col, colIndex) => (
              <View key={`col-${colIndex}`} style={styles.masonryCol}>
                {col.map((item) => {
                  const uri = tileUri(item);
                  const isLink = item.kind === 'pin' || item.kind === 'board';
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.tile, { aspectRatio: tileAspect(item) }]}
                      onPress={() => onTilePress(item)}
                      onLongPress={() => onDelete(item)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        item.title ||
                        (item.kind === 'board'
                          ? 'Pinterest board'
                          : item.kind === 'pin'
                            ? 'Pinterest pin'
                            : 'Reference photo')
                      }>
                      {uri ? (
                        <Image source={{ uri }} style={styles.tileImg} contentFit="cover" />
                      ) : (
                        <View style={styles.tileFallback}>
                          <IconSymbol
                            name={item.kind === 'board' ? 'bookmark.fill' : 'link'}
                            size={28}
                            color={Palette.accent}
                          />
                          <Txt variant="caption" color={Palette.textMuted} numberOfLines={2} style={styles.tileFallbackText}>
                            {item.title || (item.kind === 'board' ? 'Board' : 'Pin')}
                          </Txt>
                        </View>
                      )}
                      {isLink ? (
                        <View style={styles.tileBadge}>
                          <IconSymbol name="arrow.up.right" size={12} color={Palette.text} />
                        </View>
                      ) : null}
                      {item.title ? (
                        <View style={styles.tileCaption}>
                          <Txt variant="caption" color={Palette.text} numberOfLines={2}>
                            {item.title}
                          </Txt>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={Palette.accent} />
              <Txt variant="caption" color={Palette.textMuted}>
                Saving…
              </Txt>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Add sheet */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Txt variant="heading" style={styles.sheetTitle}>
              Add to references
            </Txt>
            <SheetBtn label="Photo from library" onPress={() => onAddPhoto('library')} />
            {Platform.OS !== 'web' ? (
              <SheetBtn label="Take a photo" onPress={() => onAddPhoto('camera')} />
            ) : null}
            <SheetBtn label="Paste Pinterest link" onPress={onPasteLink} />
            <Pressable style={styles.sheetCancel} onPress={() => setAddOpen(false)}>
              <Txt variant="label" color={Palette.textMuted}>
                Cancel
              </Txt>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Photo lightbox */}
      <Modal
        visible={!!viewing}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}>
        <View style={styles.lightbox}>
          <Pressable style={styles.lightboxBackdrop} onPress={() => setViewing(null)} />
          {viewing && tileUri(viewing) ? (
            <Image
              source={{ uri: tileUri(viewing)! }}
              style={styles.lightboxImage}
              contentFit="contain"
            />
          ) : null}
          <Pressable
            style={styles.lightboxClose}
            onPress={() => setViewing(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <IconSymbol name="xmark" size={26} color={Palette.text} />
          </Pressable>
          {viewing?.title ? (
            <Txt variant="label" color={Palette.text} style={styles.lightboxLabel}>
              {viewing.title}
            </Txt>
          ) : null}
          <View style={styles.lightboxActions}>
            {viewing?.sourceUrl || viewing?.url ? (
              <Pressable
                style={styles.lightboxSecondary}
                onPress={() => viewing && onOpenLink(viewing)}
                accessibilityRole="button"
                accessibilityLabel="Open original link">
                <Txt variant="label" color={Palette.text}>
                  Open pin
                </Txt>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.lightboxSave, savingLook && styles.disabled]}
              onPress={() => viewing && onSaveShare(viewing)}
              disabled={savingLook || !viewing}
              accessibilityRole="button"
              accessibilityLabel="Save or share this photo">
              {savingLook ? (
                <ActivityIndicator color={Palette.black} />
              ) : (
                <Txt variant="label" color={Palette.black}>
                  {Platform.OS === 'web' ? 'Download' : 'Save / Share'}
                </Txt>
              )}
            </Pressable>
            <Pressable
              style={styles.lightboxDanger}
              onPress={() => viewing && onDelete(viewing)}
              accessibilityRole="button"
              accessibilityLabel="Delete this photo">
              <Txt variant="label" color={Palette.accent}>
                Delete
              </Txt>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>,
  );
}

export default function ReferencesScreen() {
  return <ReferencesPanel />;
}

function SheetBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.sheetBtn} onPress={onPress} accessibilityRole="button">
      <Txt variant="body">{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.bg },
  embeddedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    width: '100%',
  },
  masonry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  masonryCol: {
    flex: 1,
    gap: Spacing.sm,
  },
  tile: {
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Palette.surface,
  },
  tileImg: { width: '100%', height: '100%' },
  tileFallback: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Palette.surfaceAlt,
  },
  tileFallbackText: { textAlign: 'center' },
  tileBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  sheetTitle: { marginBottom: Spacing.sm, textAlign: 'center' },
  sheetBtn: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  sheetCancel: { alignItems: 'center', paddingVertical: Spacing.md },

  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxBackdrop: { ...StyleSheet.absoluteFillObject },
  lightboxImage: { width: '100%', height: '68%' },
  lightboxClose: { position: 'absolute', top: Spacing.xl + 24, right: Spacing.lg, zIndex: 2 },
  lightboxLabel: {
    position: 'absolute',
    top: Spacing.xl + 28,
    left: Spacing.lg,
    right: 56,
  },
  lightboxActions: {
    position: 'absolute',
    bottom: Spacing.xxl,
    left: Spacing.lg,
    right: Spacing.lg,
    gap: Spacing.sm,
  },
  lightboxSave: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  lightboxSecondary: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  lightboxDanger: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
});
