import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppImage as Image } from '@/components/ui/app-image';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
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
  const centered = useCenteredContent(720);

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
    if (!item.imageUrl) return;
    setSavingLook(true);
    try {
      if (Platform.OS === 'web') {
        await Linking.openURL(item.imageUrl);
        toast('Opened photo — right-click or long-press to save.', { tone: 'success' });
        return;
      }
      const local = await cacheInspirationImage(item.imageUrl);
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

  const photos = items.filter((i) => i.kind === 'photo' && i.imageUrl);
  const links = items.filter((i) => i.kind === 'pin' || i.kind === 'board');

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
          <Txt variant="label" color={Palette.textMuted} style={styles.intro}>
            Photos you can enlarge, share, and use in Try-on — plus Pinterest links that open in the app.
          </Txt>

          {photos.length > 0 ? (
            <View style={styles.section}>
              <Txt variant="heading" style={styles.sectionTitle}>
                Photos
              </Txt>
              <View style={styles.grid}>
                {photos.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.cell}
                    onPress={() => setViewing(item)}
                    onLongPress={() => onDelete(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title || 'Reference photo'}>
                    <Image
                      source={{ uri: item.imageUrl! }}
                      style={styles.thumb}
                      contentFit="cover"
                    />
                    {item.sourceUrl ? (
                      <View style={styles.badge}>
                        <IconSymbol name="link" size={12} color={Palette.text} />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {links.length > 0 ? (
            <View style={styles.section}>
              <Txt variant="heading" style={styles.sectionTitle}>
                Pins & boards
              </Txt>
              {links.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.linkRow}
                  onPress={() => onOpenLink(item)}
                  onLongPress={() => onDelete(item)}
                  accessibilityRole="link"
                  accessibilityLabel={item.title || (item.kind === 'board' ? 'Pinterest board' : 'Pinterest pin')}>
                  {item.previewUrl ? (
                    <Image
                      source={{ uri: item.previewUrl }}
                      style={styles.linkThumb}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.linkIcon}>
                      <IconSymbol
                        name={item.kind === 'board' ? 'bookmark.fill' : 'link'}
                        size={18}
                        color={Palette.accent}
                      />
                    </View>
                  )}
                  <View style={styles.linkBody}>
                    <Txt variant="body" numberOfLines={1}>
                      {item.title || (item.kind === 'board' ? 'Pinterest board' : 'Pinterest pin')}
                    </Txt>
                    <Txt variant="caption" color={Palette.textMuted} numberOfLines={1}>
                      {item.url}
                    </Txt>
                  </View>
                  <IconSymbol name="arrow.up.right" size={16} color={Palette.textDim} />
                </Pressable>
              ))}
            </View>
          ) : null}

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
          {viewing?.imageUrl ? (
            <Image
              source={{ uri: viewing.imageUrl }}
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
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  intro: { marginBottom: Spacing.xs },
  section: { gap: Spacing.md },
  sectionTitle: { marginBottom: Spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cell: { width: '31%', aspectRatio: 3 / 4, borderRadius: Radius.md, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%', backgroundColor: Palette.surface },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  linkIcon: {
    width: 56,
    height: 72,
    borderRadius: Radius.sm,
    backgroundColor: Palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkThumb: {
    width: 56,
    height: 72,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceAlt,
  },
  linkBody: { flex: 1, gap: 2 },
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
