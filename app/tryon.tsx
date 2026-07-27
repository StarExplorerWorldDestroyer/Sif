import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppImage as Image } from '@/components/ui/app-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { Glow, Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import { errorMessage, reportClientError, UserError } from '@/lib/errors';
import { listInspirations, type Inspiration } from '@/lib/inspirations';
import { hasPhoto, primaryPhotoUri } from '@/lib/photos';
import {
  EFFECTS,
  cacheTryonImage,
  deleteTryon,
  fetchTryOnStyles,
  grantTryonConsent,
  hasTryonConsent,
  listTryonResults,
  listTryonSelfies,
  requestTryOn,
  signTryonPhoto,
  uploadTryonImageFromUri,
  type ColorParams,
  type EffectKind,
  type SavedSelfie,
  type TryOnGalleryItem,
  type TryOnStyle,
} from '@/lib/tryon';
import { useAuth } from '@/store/auth';
import { useFeedback } from '@/store/feedback';
import { useHaircuts } from '@/store/haircuts';

const COLOR_SWATCHES: { name: string; hex: string }[] = [
  { name: 'Jet Black', hex: '#1C1C1C' },
  { name: 'Espresso', hex: '#3B2417' },
  { name: 'Chestnut', hex: '#6A3E26' },
  { name: 'Caramel', hex: '#A86B38' },
  { name: 'Honey', hex: '#C9A227' },
  { name: 'Platinum', hex: '#E6E1D3' },
  { name: 'Auburn', hex: '#7A2E1E' },
  { name: 'Copper', hex: '#B45A2B' },
  { name: 'Burgundy', hex: '#5C1A2B' },
  { name: 'Rose Gold', hex: '#C08A7D' },
  { name: 'Ash', hex: '#8A8D8F' },
  { name: 'Pastel Pink', hex: '#E6A8C8' },
  { name: 'Lavender', hex: '#9A7BD0' },
  { name: 'Ocean', hex: '#2E5E8C' },
  { name: 'Emerald', hex: '#1F6B4F' },
  { name: 'Fire Red', hex: '#B12A2A' },
];

const INTENSITIES: { label: string; value: number }[] = [
  { label: 'Subtle', value: 50 },
  { label: 'Medium', value: 75 },
  { label: 'Bold', value: 100 },
];

function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(v) ? `#${v.toUpperCase()}` : null;
}

type PickedImage = { uri: string; width?: number; height?: number };

async function pickFromLibrary(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Please allow photo access to choose a selfie.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.9,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

async function pickFromCamera(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Please allow camera access to take a selfie.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.9,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/** Ask for a selfie — camera or library on native; library-only on web. */
function pickImage(): Promise<PickedImage | null> {
  if (Platform.OS === 'web') return pickFromLibrary();
  return new Promise((resolve) => {
    Alert.alert('Your photo', undefined, [
      { text: 'Take Photo', onPress: () => void pickFromCamera().then(resolve) },
      { text: 'Choose from Library', onPress: () => void pickFromLibrary().then(resolve) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

/** Resolve an image's pixel dimensions (works for local and remote URIs). */
function getImageSize(uri: string): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    RNImage.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({}),
    );
  });
}

/** The active selfie — always already stored in the private bucket so it can be
 * reused and chained without re-uploading. */
type SelfieSel = { path: string; url: string };

type StyleCache = Record<string, { styles: TryOnStyle[]; nextToken: string | null }>;

/** One effect in a stacked look. Steps are applied in order, each on the
 * previous step's result, so several effects combine into a single look. */
type LookStep =
  | { id: string; kind: 'hairstyle'; source: 'template'; templateId: string; label: string }
  | { id: string; kind: 'hairstyle'; source: 'reference'; refPath: string; label: string }
  | { id: string; kind: 'bangs' | 'extension' | 'volume' | 'wavy'; templateId: string; label: string }
  | { id: string; kind: 'color'; color: ColorParams; label: string };

const EFFECT_LABEL: Record<EffectKind, string> = {
  hairstyle: 'Style',
  color: 'Color',
  bangs: 'Bangs',
  extension: 'Length',
  volume: 'Volume',
  wavy: 'Wavy',
};

/** Run a single look step on top of the given image path. */
function runStep(step: LookStep, selfiePath: string) {
  if (step.kind === 'color') {
    return requestTryOn({ kind: 'color', selfiePath, color: step.color, styleLabel: step.label });
  }
  if (step.kind === 'hairstyle' && step.source === 'reference') {
    return requestTryOn({ kind: 'hairstyle', selfiePath, source: 'reference', refPath: step.refPath });
  }
  if (step.kind === 'hairstyle') {
    return requestTryOn({
      kind: 'hairstyle',
      selfiePath,
      source: 'template',
      templateId: step.templateId,
      styleLabel: step.label,
    });
  }
  return requestTryOn({ kind: step.kind, selfiePath, templateId: step.templateId, styleLabel: step.label });
}

export default function TryOnScreen() {
  const { user } = useAuth();
  const { toast, confirm } = useFeedback();
  const { haircuts } = useHaircuts();
  const router = useRouter();
  const centered = useCenteredContent(560);
  const params = useLocalSearchParams<{ ref?: string; style?: string }>();

  const [consent, setConsent] = useState<boolean | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);

  // 'create' = build a look; 'gallery' = browse/delete saved looks.
  const [tab, setTab] = useState<'create' | 'gallery'>('create');

  // Selfie: chosen from saved photos / a new upload / an existing haircut photo.
  const [selfie, setSelfie] = useState<SelfieSel | null>(null);
  const [savedSelfies, setSavedSelfies] = useState<SavedSelfie[]>([]);
  const [importing, setImporting] = useState(false);
  const [showCuts, setShowCuts] = useState(false);

  // Saved looks gallery.
  const [gallery, setGallery] = useState<TryOnGalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const [effect, setEffect] = useState<EffectKind>('hairstyle');

  // Style library per effect (cached so switching tabs doesn't refetch).
  const cacheRef = useRef<StyleCache>({});
  const [styles_, setStyles] = useState<TryOnStyle[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [picked, setPicked] = useState<TryOnStyle | null>(null);

  // Hairstyle can also use a reference photo instead of the library.
  const [useReference, setUseReference] = useState(false);
  const [reference, setReference] = useState<PickedImage | null>(null);
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [savedRefs, setSavedRefs] = useState<Inspiration[]>([]);
  const [savedRefsLoading, setSavedRefsLoading] = useState(false);

  // Color settings.
  const [colorHex, setColorHex] = useState<string | null>(null);
  const [hexInput, setHexInput] = useState('');
  const [intensity, setIntensity] = useState(100);
  const [ombre, setOmbre] = useState(false);

  // The look being built — effects applied in order, each on the previous result.
  const [steps, setSteps] = useState<LookStep[]>([]);
  const [adding, setAdding] = useState(false);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // Full-screen preview for a generated look (gallery or just-created result).
  const [viewing, setViewing] = useState<{ url: string; label?: string } | null>(null);
  const [savingLook, setSavingLook] = useState(false);

  const effectType = EFFECTS.find((e) => e.id === effect)?.type ?? 'template';

  useEffect(() => {
    if (!user) return;
    hasTryonConsent(user.id).then(setConsent);
  }, [user]);

  const refreshSelfies = useCallback(async () => {
    if (!user) return;
    const list = await listTryonSelfies(user.id);
    setSavedSelfies(list);
    // Default the active selfie to the most recent saved one.
    setSelfie((cur) => cur ?? list[0] ?? null);
  }, [user]);

  const refreshGallery = useCallback(async () => {
    if (!user) return;
    setGalleryLoading(true);
    const list = await listTryonResults(user.id);
    setGallery(list);
    setGalleryLoading(false);
  }, [user]);

  // Once consent is granted, load the user's saved selfies and look gallery.
  useEffect(() => {
    if (!consent || !user) return;
    refreshSelfies();
    refreshGallery();
  }, [consent, user, refreshSelfies, refreshGallery]);

  // Deep-link from Discover ("Try this look"): preload a reference style photo.
  const appliedParamRef = useRef(false);
  useEffect(() => {
    if (!consent || appliedParamRef.current) return;
    if (params.ref) {
      appliedParamRef.current = true;
      setEffect('hairstyle');
      setUseReference(true);
      setReference({ uri: String(params.ref) });
    }
  }, [consent, params.ref]);

  const loadStyles = useCallback(
    async (kind: EffectKind, append = false) => {
      const cached = cacheRef.current[kind];
      if (cached && !append) {
        setStyles(cached.styles);
        setNextToken(cached.nextToken);
        return;
      }
      setStylesLoading(true);
      const token = append ? (cacheRef.current[kind]?.nextToken ?? undefined) : undefined;
      const { styles, nextToken: nt, error } = await fetchTryOnStyles(kind, token);
      if (error && styles.length === 0) {
        toast(error, { tone: 'error' });
      }
      const merged = append ? [...(cacheRef.current[kind]?.styles ?? []), ...styles] : styles;
      cacheRef.current[kind] = { styles: merged, nextToken: nt };
      setStyles(merged);
      setNextToken(nt);
      setStylesLoading(false);
    },
    [toast],
  );

  // Load the library when consent is granted, the effect changes, or we leave
  // reference mode — but only for template-based effects.
  useEffect(() => {
    if (!consent) return;
    if (effectType === 'template' && !(effect === 'hairstyle' && useReference)) {
      loadStyles(effect);
    }
  }, [consent, effect, effectType, useReference, loadStyles]);

  const onAgree = async () => {
    if (!user) return;
    setSavingConsent(true);
    const ok = await grantTryonConsent(user.id);
    setSavingConsent(false);
    if (ok) setConsent(true);
    else toast('Could not save your choice. Please try again.', { tone: 'error' });
  };

  const switchEffect = (next: EffectKind) => {
    setEffect(next);
    setPicked(null);
    setResult(null);
    setUseReference(false);
  };

  // Upload a freshly-picked or existing photo, persist it as a reusable selfie,
  // and select it. Selfies live in the private bucket so they can be reused next
  // time without re-uploading.
  const addSelfieFromUri = useCallback(
    async (uri: string, dims?: { width?: number; height?: number }) => {
      if (!user) return;
      setImporting(true);
      try {
        const path = await uploadTryonImageFromUri(user.id, 'selfie', uri, dims);
        const url = (await signTryonPhoto(path)) ?? uri;
        const item = { path, url };
        setSavedSelfies((prev) => [item, ...prev.filter((s) => s.path !== path)]);
        setSelfie(item);
        setResult(null);
      } catch (e) {
        reportClientError({
          scope: 'tryon.upload_selfie',
          message: errorMessage(e),
        });
        toast(UserError.tryonPhoto, { tone: 'error' });
      } finally {
        setImporting(false);
      }
    },
    [user, toast],
  );

  const onAddPhoto = async () => {
    const img = await pickImage();
    if (img) await addSelfieFromUri(img.uri, img);
  };

  const onPickFromCut = async (uri: string) => {
    setShowCuts(false);
    const dims = await getImageSize(uri);
    await addSelfieFromUri(uri, dims);
  };

  const openSavedRefPicker = async () => {
    if (!user) return;
    setRefPickerOpen(true);
    setSavedRefsLoading(true);
    const list = await listInspirations(user.id);
    setSavedRefs(list.filter((i) => i.kind === 'photo' && i.imageUrl));
    setSavedRefsLoading(false);
  };

  const onPickReference = async () => {
    const chooseLibrary = async () => {
      const img = await pickFromLibrary();
      if (img) {
        setReference(img);
        setResult(null);
      }
    };
    if (Platform.OS === 'web') {
      // Web: offer library or saved references via confirm-style choices isn't great;
      // library first, with a secondary path from the "Saved" link below the box.
      await chooseLibrary();
      return;
    }
    Alert.alert('Reference photo', undefined, [
      { text: 'Photo Library', onPress: () => void chooseLibrary() },
      { text: 'My references', onPress: () => void openSavedRefPicker() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onPickHex = (hex: string) => {
    setColorHex(hex);
    setResult(null);
  };

  const onSubmitHexInput = () => {
    const norm = normalizeHex(hexInput);
    if (norm) {
      setColorHex(norm);
      setResult(null);
    } else {
      toast('Enter a 6-digit hex color, e.g. #B45A2B.', { tone: 'error' });
    }
  };

  // Whether the current controls describe a valid effect to add to the look.
  const configReady =
    effectType === 'color'
      ? !!colorHex
      : effect === 'hairstyle' && useReference
        ? !!reference
        : !!picked;
  const canAdd = configReady && !adding && !running;
  // Allow Generate with either a stacked look OR the effect currently selected
  // (so picking a style + Generate works without the extra "Add to look" tap).
  const canGenerate = !!selfie && (steps.length > 0 || configReady) && !running && !adding;

  /** Build a LookStep from the current effect controls (may upload a ref photo). */
  const buildCurrentStep = async (): Promise<LookStep> => {
    if (!user) throw new Error('Not signed in');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (effectType === 'color') {
      const color: ColorParams = {
        hex: colorHex!,
        intensity,
        pattern: ombre ? 'ombre' : 'full',
        coloringSection: 'bottom',
      };
      return { id, kind: 'color', color, label: colorHex! };
    }
    if (effect === 'hairstyle' && useReference) {
      const refPath = await uploadTryonImageFromUri(user.id, 'ref', reference!.uri, reference!);
      return { id, kind: 'hairstyle', source: 'reference', refPath, label: 'Reference photo' };
    }
    if (effect === 'hairstyle') {
      return {
        id,
        kind: 'hairstyle',
        source: 'template',
        templateId: picked!.templateId,
        label: picked!.label || 'Style',
      };
    }
    return {
      id,
      kind: effect as 'bangs' | 'extension' | 'volume' | 'wavy',
      templateId: picked!.templateId,
      label: picked!.label || EFFECT_LABEL[effect],
    };
  };

  const onAddStep = async () => {
    if (!user || !configReady) return;
    setAdding(true);
    try {
      const step = await buildCurrentStep();
      setSteps((prev) => [...prev, step]);
      setResult(null);
      // Clear the per-effect selection so the next pick starts fresh.
      setPicked(null);
      setColorHex(null);
    } catch (e) {
      reportClientError({
        scope: 'tryon.add_step',
        message: errorMessage(e),
        detail: { effect },
      });
      toast(UserError.tryonAddStep, { tone: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    setResult(null);
  };

  const onGenerate = async () => {
    if (!user || !selfie) return;
    setRunning(true);
    setResult(null);
    try {
      let lookSteps = steps;
      // No stacked look yet — use whatever is currently selected in the controls.
      if (lookSteps.length === 0) {
        if (!configReady) return;
        const step = await buildCurrentStep();
        lookSteps = [step];
        setSteps(lookSteps);
        setPicked(null);
        setColorHex(null);
      }
      let currentPath = selfie.path;
      let lastResultPath: string | null = null;
      let lastResultUrl: string | null = null;
      for (let i = 0; i < lookSteps.length; i++) {
        const step = lookSteps[i];
        setProgress(`Applying ${EFFECT_LABEL[step.kind]} (${i + 1}/${lookSteps.length})…`);
        const res = await runStep(step, currentPath);
        if (res.status !== 'succeeded' || !res.resultPath) {
          // `res.error` is already sanitized in lib/tryon (details logged there).
          toast(res.error ?? UserError.tryonGenerate, { tone: 'error' });
          if (res.resultUrl) setResult(res.resultUrl);
          return;
        }
        currentPath = res.resultPath;
        lastResultPath = res.resultPath;
        if (res.resultUrl) {
          lastResultUrl = res.resultUrl;
          setResult(res.resultUrl);
        }
      }
      if (lastResultPath) refreshGallery();
      if (lastResultUrl) setViewing({ url: lastResultUrl, label: 'Your new look' });
    } catch (e) {
      reportClientError({
        scope: 'tryon.generate',
        message: errorMessage(e),
        detail: { stepCount: steps.length },
      });
      toast(UserError.tryonGenerate, { tone: 'error' });
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const onSaveLook = async (url: string) => {
    setSavingLook(true);
    try {
      if (Platform.OS === 'web') {
        // Open the signed URL — browsers let the user save/download from there.
        await Linking.openURL(url);
        toast('Opened look — right-click or long-press to save.', { tone: 'success' });
        return;
      }
      const local = await cacheTryonImage(url);
      await Share.share(
        Platform.OS === 'ios'
          ? { url: local }
          : { message: local, url: local, title: 'Golden Sif look' },
      );
    } catch (e) {
      reportClientError({
        scope: 'tryon.save_look',
        message: errorMessage(e),
      });
      toast(UserError.tryonSave, { tone: 'error' });
    } finally {
      setSavingLook(false);
    }
  };

  const onDeleteLook = async (item: TryOnGalleryItem) => {
    const ok = await confirm({
      title: 'Delete this look?',
      message: 'This permanently removes the generated photo.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setGallery((prev) => prev.filter((g) => g.id !== item.id));
    const done = await deleteTryon(item.id, item.resultPath);
    if (!done) {
      toast('Could not delete that look. Please try again.', { tone: 'error' });
      refreshGallery();
    }
  };

  const renderLookViewer = () => (
    <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
      <View style={styles.lightbox}>
        <Pressable style={styles.lightboxBackdrop} onPress={() => setViewing(null)} />
        {viewing ? (
          <Image source={{ uri: viewing.url }} style={styles.lightboxImage} contentFit="contain" />
        ) : null}
        <Pressable
          style={styles.lightboxClose}
          onPress={() => setViewing(null)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close look">
          <IconSymbol name="xmark" size={26} color={Palette.text} />
        </Pressable>
        {viewing?.label ? (
          <Txt variant="label" color={Palette.text} style={styles.lightboxLabel}>
            {viewing.label}
          </Txt>
        ) : null}
        <Pressable
          style={[styles.lightboxSave, savingLook && styles.ctaDisabled]}
          onPress={() => viewing && onSaveLook(viewing.url)}
          disabled={savingLook || !viewing}
          accessibilityRole="button"
          accessibilityLabel="Save or share this look">
          {savingLook ? (
            <ActivityIndicator color={Palette.black} />
          ) : (
            <Txt variant="label" color={Palette.black}>
              {Platform.OS === 'web' ? 'Download' : 'Save / Share'}
            </Txt>
          )}
        </Pressable>
      </View>
    </Modal>
  );

  const renderSavedRefPicker = () => (
    <Modal
      visible={refPickerOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setRefPickerOpen(false)}>
      <Pressable style={styles.refPickerBackdrop} onPress={() => setRefPickerOpen(false)}>
        <Pressable style={styles.refPickerSheet} onPress={() => {}}>
          <Txt variant="heading" style={styles.refPickerTitle}>
            My references
          </Txt>
          {savedRefsLoading ? (
            <ActivityIndicator color={Palette.accent} style={{ marginVertical: Spacing.xl }} />
          ) : savedRefs.length === 0 ? (
            <View style={styles.refPickerEmpty}>
              <Txt variant="label" color={Palette.textMuted} style={{ textAlign: 'center' }}>
                No saved reference photos yet. Add some from Styles → Saved.
              </Txt>
              <Pressable
                style={styles.refPickerManage}
                onPress={() => {
                  setRefPickerOpen(false);
                  router.push('/references');
                }}>
                <Txt variant="label" color={Palette.accent}>
                  Open Saved
                </Txt>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.refPickerGrid}>
              {savedRefs.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.refPickerCell}
                  onPress={() => {
                    if (!item.imageUrl) return;
                    setReference({ uri: item.imageUrl });
                    setResult(null);
                    setRefPickerOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.title || 'Use this reference'}>
                  <Image
                    source={{ uri: item.imageUrl! }}
                    style={styles.refPickerImg}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          )}
          <Pressable style={styles.refPickerCancel} onPress={() => setRefPickerOpen(false)}>
            <Txt variant="label" color={Palette.textMuted}>
              Cancel
            </Txt>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // --- Loading consent state ---
  if (consent === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Try a look" />
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // --- Consent gate ---
  if (!consent) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Try a look" />
        <ScrollView contentContainerStyle={[styles.body, centered ?? undefined]}>
          <Txt variant="title" glow color={Palette.accent} style={styles.consentTitle}>
            See a new look on you
          </Txt>
          <Txt variant="body" color={Palette.textMuted} style={styles.consentText}>
            Upload a selfie and our AI previews different hairstyles, colors, and more on your own
            face. To do this, your photo is sent securely to our styling provider (Perfect Corp /
            YouCam) to generate the preview.
          </Txt>
          <View style={styles.consentList}>
            <Txt variant="label" color={Palette.textMuted}>• Your photos are stored privately — only you can see them.</Txt>
            <Txt variant="label" color={Palette.textMuted}>• They’re used only to generate your previews, never to identify you or for ads.</Txt>
            <Txt variant="label" color={Palette.textMuted}>• You can stop using try-on anytime; deleting your account removes them.</Txt>
          </View>
          <Pressable
            style={[styles.cta, savingConsent && styles.ctaDisabled]}
            onPress={onAgree}
            disabled={savingConsent}
            accessibilityRole="button"
            accessibilityLabel="Agree and continue">
            {savingConsent ? (
              <ActivityIndicator color={Palette.accent} />
            ) : (
              <Txt variant="label" color={Palette.accent} style={styles.ctaTxt}>I AGREE & CONTINUE</Txt>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const cutPhotos = haircuts.filter(hasPhoto);

  // --- Gallery (saved looks) ---
  if (tab === 'gallery') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Try a look" />
        <View style={[styles.modeToggleWrap, centered ?? undefined]}>
          <View style={styles.modeToggle}>
            <Pressable style={styles.modeTab} onPress={() => setTab('create')} accessibilityRole="button">
              <Txt variant="label" color={Palette.textMuted}>Create</Txt>
            </Pressable>
            <Pressable style={[styles.modeTab, styles.modeTabActive]} accessibilityRole="button">
              <Txt variant="label" color={Palette.black}>Saved looks</Txt>
            </Pressable>
          </View>
        </View>
        <ScrollView contentContainerStyle={[styles.body, centered ?? undefined]}>
          {galleryLoading && gallery.length === 0 ? (
            <View style={styles.stylesLoading}>
              <ActivityIndicator color={Palette.accent} />
            </View>
          ) : gallery.length === 0 ? (
            <Txt variant="label" color={Palette.textDim} style={[styles.note, { marginTop: Spacing.xl }]}>
              No saved looks yet. Generate one in Create and it’ll show up here.
            </Txt>
          ) : (
            <View style={styles.galleryGrid}>
              {gallery.map((g) => (
                <View key={g.id} style={styles.galleryCell}>
                  <Pressable
                    onPress={() => setViewing({ url: g.url, label: g.styleLabel || undefined })}
                    accessibilityRole="button"
                    accessibilityLabel="View this look larger">
                    <Image source={{ uri: g.url }} style={styles.galleryImg} contentFit="cover" />
                  </Pressable>
                  <Pressable
                    style={styles.galleryDelete}
                    onPress={() => onDeleteLook(g)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete this look">
                    <Txt variant="label" color={Palette.text}>✕</Txt>
                  </Pressable>
                  {!!g.styleLabel && (
                    <Txt variant="caption" color={Palette.textDim} numberOfLines={1} style={styles.galleryLabel}>
                      {g.styleLabel}
                    </Txt>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
        {renderLookViewer()}
        {renderSavedRefPicker()}
      </SafeAreaView>
    );
  }

  // --- Main studio (create) ---
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Try a look" />
      <View style={[styles.modeToggleWrap, centered ?? undefined]}>
        <View style={styles.modeToggle}>
          <Pressable style={[styles.modeTab, styles.modeTabActive]} accessibilityRole="button">
            <Txt variant="label" color={Palette.black}>Create</Txt>
          </Pressable>
          <Pressable style={styles.modeTab} onPress={() => setTab('gallery')} accessibilityRole="button">
            <Txt variant="label" color={Palette.textMuted}>Saved looks</Txt>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.body, centered ?? undefined]}>
        {params.style ? (
          <View style={styles.hintBanner}>
            <Txt variant="caption" color={Palette.accent}>
              Trying “{String(params.style)}” — pick your photo, then Add to look & Generate.
            </Txt>
          </View>
        ) : null}

        {/* Step 1 — selfie */}
        <Txt variant="heading" style={styles.sectionTitle}>1. Your photo</Txt>
        <View style={styles.selfieBox}>
          {selfie ? (
            <Image source={{ uri: selfie.url }} style={styles.fill} contentFit="cover" />
          ) : (
            <Txt variant="label" color={Palette.textMuted}>Choose a clear, front-facing photo</Txt>
          )}
          {importing ? (
            <View style={styles.selfieBusy}>
              <ActivityIndicator color={Palette.accent} />
            </View>
          ) : null}
        </View>

        {/* Saved selfies + sources */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.styleRow}>
          <Pressable style={styles.sourceCard} onPress={onAddPhoto} accessibilityRole="button" accessibilityLabel="Upload a new photo">
            <Txt variant="label" color={Palette.accent}>＋</Txt>
            <Txt variant="caption" color={Palette.textMuted}>Upload</Txt>
          </Pressable>
          <Pressable
            style={styles.sourceCard}
            onPress={() => setShowCuts((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Choose from my haircut photos">
            <Txt variant="label" color={Palette.accent}>✦</Txt>
            <Txt variant="caption" color={Palette.textMuted}>My cuts</Txt>
          </Pressable>
          {savedSelfies.map((s) => (
            <Pressable
              key={s.path}
              style={[styles.selfieThumbWrap, selfie?.path === s.path && styles.styleCardActive]}
              onPress={() => { setSelfie(s); setResult(null); }}
              accessibilityRole="button"
              accessibilityLabel="Use this photo">
              <Image source={{ uri: s.url }} style={styles.selfieThumb} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>

        {/* Pick from existing haircut photos */}
        {showCuts ? (
          cutPhotos.length === 0 ? (
            <Txt variant="caption" color={Palette.textDim} style={styles.note}>
              No haircut photos yet — add some in your cuts to reuse them here.
            </Txt>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.styleRow}>
              {cutPhotos.map((h) => (
                <Pressable
                  key={h.id}
                  style={styles.selfieThumbWrap}
                  onPress={() => onPickFromCut(primaryPhotoUri(h))}
                  accessibilityRole="button"
                  accessibilityLabel="Use this haircut photo">
                  <Image source={{ uri: primaryPhotoUri(h) }} style={styles.selfieThumb} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          )
        ) : null}

        {/* Step 2 — effect */}
        <Txt variant="heading" style={styles.sectionTitle}>2. Build your look</Txt>
        <Txt variant="caption" color={Palette.textDim}>
          Add one or more effects — they stack in order, so you can combine length, waves, color,
          volume and bangs into a single look.
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.effectRow}>
          {EFFECTS.map((e) => (
            <Pressable
              key={e.id}
              style={[styles.effectTab, effect === e.id && styles.effectTabActive]}
              onPress={() => switchEffect(e.id)}
              accessibilityRole="button">
              <Txt variant="label" color={effect === e.id ? Palette.accent : Palette.textMuted}>{e.label}</Txt>
            </Pressable>
          ))}
        </ScrollView>

        {/* Effect-specific controls */}
        {effectType === 'color' ? (
          <View style={styles.colorPane}>
            <View style={styles.swatchGrid}>
              {COLOR_SWATCHES.map((s) => (
                <Pressable
                  key={s.hex}
                  onPress={() => onPickHex(s.hex)}
                  accessibilityRole="button"
                  accessibilityLabel={s.name}
                  style={[styles.swatch, { backgroundColor: s.hex }, colorHex === s.hex && styles.swatchActive]}
                />
              ))}
            </View>
            <View style={styles.hexRow}>
              <TextInput
                value={hexInput}
                onChangeText={setHexInput}
                onSubmitEditing={onSubmitHexInput}
                placeholder="#B45A2B"
                placeholderTextColor={Palette.textDim}
                autoCapitalize="characters"
                style={styles.hexInput}
              />
              <Pressable style={styles.hexBtn} onPress={onSubmitHexInput} accessibilityRole="button">
                <Txt variant="label" color={Palette.accent}>Use hex</Txt>
              </Pressable>
              {colorHex ? (
                <View style={[styles.swatchPreview, { backgroundColor: colorHex }]} />
              ) : null}
            </View>

            <Txt variant="label" color={Palette.textMuted} style={styles.controlLabel}>Intensity</Txt>
            <View style={styles.pillRow}>
              {INTENSITIES.map((i) => (
                <Pressable
                  key={i.value}
                  onPress={() => setIntensity(i.value)}
                  style={[styles.pill, intensity === i.value && styles.pillActive]}
                  accessibilityRole="button">
                  <Txt variant="caption" color={intensity === i.value ? Palette.black : Palette.textMuted}>{i.label}</Txt>
                </Pressable>
              ))}
            </View>

            <Txt variant="label" color={Palette.textMuted} style={styles.controlLabel}>Coverage</Txt>
            <View style={styles.pillRow}>
              {[{ label: 'Full', v: false }, { label: 'Ombre', v: true }].map((p) => (
                <Pressable
                  key={p.label}
                  onPress={() => setOmbre(p.v)}
                  style={[styles.pill, ombre === p.v && styles.pillActive]}
                  accessibilityRole="button">
                  <Txt variant="caption" color={ombre === p.v ? Palette.black : Palette.textMuted}>{p.label}</Txt>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <>
            {effect === 'hairstyle' ? (
              <View style={styles.subTabs}>
                {[{ label: 'Library', ref: false }, { label: 'Reference photo', ref: true }].map((t) => (
                  <Pressable
                    key={t.label}
                    style={[styles.pill, useReference === t.ref && styles.pillActive]}
                    onPress={() => { setUseReference(t.ref); setResult(null); }}
                    accessibilityRole="button">
                    <Txt variant="caption" color={useReference === t.ref ? Palette.black : Palette.textMuted}>{t.label}</Txt>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {effect === 'hairstyle' && useReference ? (
              <View style={styles.refWrap}>
                <Pressable
                  style={styles.refBox}
                  onPress={onPickReference}
                  accessibilityRole="button"
                  accessibilityLabel="Choose a reference style photo">
                  {reference ? (
                    <Image source={{ uri: reference.uri }} style={styles.fill} contentFit="cover" />
                  ) : (
                    <Txt variant="label" color={Palette.textMuted}>
                      Tap to pick a hairstyle photo
                    </Txt>
                  )}
                </Pressable>
                <View style={styles.refLinks}>
                  <Pressable
                    onPress={() => void openSavedRefPicker()}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Choose from saved references">
                    <Txt variant="caption" color={Palette.accent}>
                      From my references
                    </Txt>
                  </Pressable>
                  <Txt variant="caption" color={Palette.textDim}>
                    ·
                  </Txt>
                  <Pressable
                    onPress={() => router.push('/references')}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Manage saved references">
                    <Txt variant="caption" color={Palette.textMuted}>
                      Manage saved
                    </Txt>
                  </Pressable>
                </View>
              </View>
            ) : stylesLoading && styles_.length === 0 ? (
              <View style={styles.stylesLoading}>
                <ActivityIndicator color={Palette.accent} />
              </View>
            ) : styles_.length === 0 ? (
              <Txt variant="label" color={Palette.textDim} style={styles.note}>No styles available yet.</Txt>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.styleRow}>
                {styles_.map((s) => (
                  <Pressable
                    key={s.templateId}
                    style={[styles.styleCard, picked?.templateId === s.templateId && styles.styleCardActive]}
                    onPress={() => setPicked(s)}
                    accessibilityRole="button"
                    accessibilityLabel={s.label || 'Style'}>
                    <Image source={{ uri: s.thumbnailUrl }} style={styles.styleThumb} contentFit="cover" />
                    {!!s.label && <Txt variant="caption" numberOfLines={1} style={styles.styleLabel}>{s.label}</Txt>}
                  </Pressable>
                ))}
                {nextToken ? (
                  <Pressable
                    style={[styles.styleCard, styles.moreCard]}
                    onPress={() => loadStyles(effect, true)}
                    accessibilityRole="button"
                    accessibilityLabel="Load more styles">
                    {stylesLoading ? (
                      <ActivityIndicator color={Palette.accent} />
                    ) : (
                      <Txt variant="label" color={Palette.accent}>More</Txt>
                    )}
                  </Pressable>
                ) : null}
              </ScrollView>
            )}
          </>
        )}

        {/* Add the configured effect to the look */}
        <Pressable
          style={[styles.addBtn, !canAdd && styles.ctaDisabled]}
          onPress={onAddStep}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityLabel="Add this effect to your look">
          {adding ? (
            <ActivityIndicator color={Palette.accent} />
          ) : (
            <Txt variant="label" color={Palette.accent}>+ ADD TO LOOK</Txt>
          )}
        </Pressable>

        {/* The stacked look */}
        {steps.length > 0 && (
          <View style={styles.lookWrap}>
            <Txt variant="heading" style={styles.sectionTitle}>3. Your look ({steps.length})</Txt>
            {steps.map((s, i) => (
              <View key={s.id} style={styles.stepRow}>
                <Txt variant="caption" color={Palette.textDim} style={styles.stepNum}>{i + 1}</Txt>
                {s.kind === 'color' ? (
                  <View style={[styles.stepDot, { backgroundColor: s.color.hex ?? Palette.surface }]} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Txt variant="label">{EFFECT_LABEL[s.kind]}</Txt>
                  <Txt variant="caption" color={Palette.textDim} numberOfLines={1}>{s.label}</Txt>
                </View>
                <Pressable
                  onPress={() => removeStep(s.id)}
                  disabled={running}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${EFFECT_LABEL[s.kind]}`}>
                  <Txt variant="label" color={Palette.textMuted}>Remove</Txt>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Generate the whole look */}
        <Pressable
          style={[styles.cta, !canGenerate && styles.ctaDisabled]}
          onPress={onGenerate}
          disabled={!canGenerate}
          accessibilityRole="button"
          accessibilityLabel="Generate your look">
          {running ? (
            <ActivityIndicator color={Palette.accent} />
          ) : (
            <Txt variant="label" color={Palette.accent} style={styles.ctaTxt}>GENERATE LOOK</Txt>
          )}
        </Pressable>
        {!selfie && (steps.length > 0 || configReady) && (
          <Txt variant="caption" color={Palette.textDim} style={styles.note}>
            Add a selfie above to generate your look.
          </Txt>
        )}
        {selfie && steps.length === 0 && !configReady && (
          <Txt variant="caption" color={Palette.textDim} style={styles.note}>
            Pick a style (or color) above, then Generate — or Add to look to stack more effects.
          </Txt>
        )}
        {running && (
          <Txt variant="caption" color={Palette.textDim} style={styles.note}>
            {progress ?? 'Generating your look — this can take a minute.'}
          </Txt>
        )}

        {/* Result */}
        {result && (
          <View style={styles.resultWrap}>
            <Txt variant="heading" style={styles.sectionTitle}>Your new look</Txt>
            <Pressable
              onPress={() => setViewing({ url: result, label: 'Your new look' })}
              accessibilityRole="button"
              accessibilityLabel="View look larger">
              <Image source={{ uri: result }} style={styles.resultImg} contentFit="cover" />
            </Pressable>
            <Pressable
              style={styles.saveResultBtn}
              onPress={() => onSaveLook(result)}
              disabled={savingLook}
              accessibilityRole="button"
              accessibilityLabel="Save or share this look">
              {savingLook ? (
                <ActivityIndicator color={Palette.accent} />
              ) : (
                <Txt variant="label" color={Palette.accent}>
                  {Platform.OS === 'web' ? 'DOWNLOAD LOOK' : 'SAVE / SHARE LOOK'}
                </Txt>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
      {renderLookViewer()}
      {renderSavedRefPicker()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  fill: { width: '100%', height: '100%' },

  consentTitle: { marginTop: Spacing.lg },
  consentText: { lineHeight: 22 },
  consentList: { gap: Spacing.sm, marginTop: Spacing.sm },

  modeToggleWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Palette.surface,
    borderRadius: Radius.pill,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  modeTabActive: { backgroundColor: Palette.accent },

  hintBanner: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.accent,
    backgroundColor: Palette.accentSoft,
  },

  sectionTitle: { marginTop: Spacing.md },
  selfieBox: {
    height: 220,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: Spacing.lg,
  },
  selfieBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sourceCard: {
    width: 72,
    height: 96,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  selfieThumbWrap: {
    width: 72,
    height: 96,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  selfieThumb: { width: '100%', height: '100%', backgroundColor: Palette.surface },

  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  galleryCell: { width: '31%', gap: Spacing.xs },
  galleryImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: Radius.md, backgroundColor: Palette.surface },
  galleryDelete: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  galleryLabel: { paddingHorizontal: 2 },

  effectRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  effectTab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  effectTabActive: { borderColor: Palette.accent, backgroundColor: Palette.accentSoft },

  subTabs: { flexDirection: 'row', gap: Spacing.sm },

  colorPane: { gap: Spacing.sm },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  swatch: { width: 44, height: 44, borderRadius: Radius.pill, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: Palette.accent },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  hexInput: {
    flex: 1,
    color: Palette.text,
    backgroundColor: Palette.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  hexBtn: {
    borderWidth: 1,
    borderColor: Palette.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  swatchPreview: { width: 32, height: 32, borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border },
  controlLabel: { marginTop: Spacing.sm },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  pillActive: { backgroundColor: Palette.accent },

  stylesLoading: { height: 120, alignItems: 'center', justifyContent: 'center' },
  note: { textAlign: 'center' },
  styleRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  styleCard: { width: 96, borderRadius: Radius.md, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  styleCardActive: { borderColor: Palette.accent },
  styleThumb: { width: '100%', height: 120, backgroundColor: Palette.surface },
  styleLabel: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.xs },
  moreCard: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Palette.accent,
    backgroundColor: Palette.accentSoft,
  },

  addBtn: {
    marginTop: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
  },

  lookWrap: { gap: Spacing.sm, marginTop: Spacing.sm },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  stepNum: { width: 16, textAlign: 'center' },
  stepDot: { width: 20, height: 20, borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border },

  cta: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderWidth: 1,
    borderColor: Palette.accent,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    ...Glow.sm,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaTxt: { letterSpacing: 4 },

  refWrap: { gap: Spacing.sm },
  refBox: {
    height: 200,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: Spacing.lg,
  },
  refLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  refPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  refPickerSheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    maxHeight: '70%',
    gap: Spacing.md,
  },
  refPickerTitle: { textAlign: 'center' },
  refPickerEmpty: { gap: Spacing.md, paddingVertical: Spacing.lg },
  refPickerManage: { alignItems: 'center', paddingVertical: Spacing.sm },
  refPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  refPickerCell: { width: '31%', aspectRatio: 3 / 4, borderRadius: Radius.md, overflow: 'hidden' },
  refPickerImg: { width: '100%', height: '100%', backgroundColor: Palette.surfaceAlt },
  refPickerCancel: { alignItems: 'center', paddingVertical: Spacing.md },

  resultWrap: { marginTop: Spacing.lg, gap: Spacing.sm },
  resultImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: Radius.lg, backgroundColor: Palette.surface },
  saveResultBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: Palette.accent,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
  },

  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxBackdrop: { ...StyleSheet.absoluteFillObject },
  lightboxImage: { width: '100%', height: '72%' },
  lightboxClose: { position: 'absolute', top: Spacing.xl + 24, right: Spacing.lg, zIndex: 2 },
  lightboxLabel: {
    position: 'absolute',
    top: Spacing.xl + 28,
    left: Spacing.lg,
    right: 56,
  },
  lightboxSave: {
    position: 'absolute',
    bottom: Spacing.xxl,
    alignSelf: 'center',
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    minWidth: 160,
    alignItems: 'center',
  },
});
