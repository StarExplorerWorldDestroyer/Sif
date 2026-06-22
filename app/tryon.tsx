import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppImage as Image } from '@/components/ui/app-image';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { Glow, Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import {
  EFFECTS,
  fetchTryOnStyles,
  grantTryonConsent,
  hasTryonConsent,
  requestTryOn,
  uploadTryonImage,
  type ColorParams,
  type EffectKind,
  type TryOnStyle,
} from '@/lib/tryon';
import { useAuth } from '@/store/auth';
import { useFeedback } from '@/store/feedback';

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

async function pickImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.9,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

type StyleCache = Record<string, { styles: TryOnStyle[]; nextToken: string | null }>;

export default function TryOnScreen() {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const centered = useCenteredContent(560);

  const [consent, setConsent] = useState<boolean | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);

  const [selfie, setSelfie] = useState<string | null>(null);
  const [effect, setEffect] = useState<EffectKind>('hairstyle');

  // Style library per effect (cached so switching tabs doesn't refetch).
  const cacheRef = useRef<StyleCache>({});
  const [styles_, setStyles] = useState<TryOnStyle[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [picked, setPicked] = useState<TryOnStyle | null>(null);

  // Hairstyle can also use a reference photo instead of the library.
  const [useReference, setUseReference] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  // Color settings.
  const [colorHex, setColorHex] = useState<string | null>(null);
  const [hexInput, setHexInput] = useState('');
  const [intensity, setIntensity] = useState(75);
  const [ombre, setOmbre] = useState(false);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const effectType = EFFECTS.find((e) => e.id === effect)?.type ?? 'template';

  useEffect(() => {
    if (!user) return;
    hasTryonConsent(user.id).then(setConsent);
  }, [user]);

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
      const { styles, nextToken: nt } = await fetchTryOnStyles(kind, token);
      const merged = append ? [...(cacheRef.current[kind]?.styles ?? []), ...styles] : styles;
      cacheRef.current[kind] = { styles: merged, nextToken: nt };
      setStyles(merged);
      setNextToken(nt);
      setStylesLoading(false);
    },
    [],
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

  const onPickSelfie = async () => {
    const uri = await pickImage();
    if (uri) {
      setSelfie(uri);
      setResult(null);
    }
  };

  const onPickReference = async () => {
    const uri = await pickImage();
    if (uri) {
      setReference(uri);
      setResult(null);
    }
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

  const canRun =
    !!selfie &&
    !running &&
    (effectType === 'color'
      ? !!colorHex
      : effect === 'hairstyle' && useReference
        ? !!reference
        : !!picked);

  const onRun = async () => {
    if (!user || !selfie) return;
    setRunning(true);
    setResult(null);
    try {
      const selfiePath = await uploadTryonImage(user.id, 'selfie', selfie);
      let res;
      if (effectType === 'color') {
        const color: ColorParams = {
          hex: colorHex!,
          intensity,
          pattern: ombre ? 'ombre' : 'full',
          coloringSection: 'bottom',
        };
        res = await requestTryOn({ kind: 'color', selfiePath, color });
      } else if (effect === 'hairstyle' && useReference) {
        const refPath = await uploadTryonImage(user.id, 'ref', reference!);
        res = await requestTryOn({ kind: 'hairstyle', selfiePath, source: 'reference', refPath });
      } else if (effect === 'hairstyle') {
        res = await requestTryOn({
          kind: 'hairstyle',
          selfiePath,
          source: 'template',
          templateId: picked!.templateId,
          styleLabel: picked!.label,
        });
      } else {
        res = await requestTryOn({
          kind: effect as 'bangs' | 'extension' | 'volume' | 'wavy',
          selfiePath,
          templateId: picked!.templateId,
          styleLabel: picked!.label,
        });
      }
      if (res.status === 'succeeded' && res.resultUrl) setResult(res.resultUrl);
      else toast(res.error ?? 'Could not generate this look.', { tone: 'error' });
    } catch {
      toast('Could not generate this look. Please try again.', { tone: 'error' });
    } finally {
      setRunning(false);
    }
  };

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

  // --- Main studio ---
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Try a look" />
      <ScrollView contentContainerStyle={[styles.body, centered ?? undefined]}>
        {/* Step 1 — selfie */}
        <Txt variant="heading" style={styles.sectionTitle}>1. Your photo</Txt>
        <Pressable
          style={styles.selfieBox}
          onPress={onPickSelfie}
          accessibilityRole="button"
          accessibilityLabel="Choose a selfie">
          {selfie ? (
            <Image source={{ uri: selfie }} style={styles.fill} contentFit="cover" />
          ) : (
            <Txt variant="label" color={Palette.textMuted}>Tap to choose a clear, front-facing selfie</Txt>
          )}
        </Pressable>

        {/* Step 2 — effect */}
        <Txt variant="heading" style={styles.sectionTitle}>2. Choose an effect</Txt>
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
              <Pressable
                style={styles.refBox}
                onPress={onPickReference}
                accessibilityRole="button"
                accessibilityLabel="Choose a reference style photo">
                {reference ? (
                  <Image source={{ uri: reference }} style={styles.fill} contentFit="cover" />
                ) : (
                  <Txt variant="label" color={Palette.textMuted}>Tap to upload a photo of the hairstyle you want</Txt>
                )}
              </Pressable>
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

        {/* Run */}
        <Pressable
          style={[styles.cta, !canRun && styles.ctaDisabled]}
          onPress={onRun}
          disabled={!canRun}
          accessibilityRole="button"
          accessibilityLabel="Try this look">
          {running ? (
            <ActivityIndicator color={Palette.accent} />
          ) : (
            <Txt variant="label" color={Palette.accent} style={styles.ctaTxt}>TRY THIS LOOK</Txt>
          )}
        </Pressable>
        {running && (
          <Txt variant="caption" color={Palette.textDim} style={styles.note}>
            Generating your look — this can take up to a minute.
          </Txt>
        )}

        {/* Result */}
        {result && (
          <View style={styles.resultWrap}>
            <Txt variant="heading" style={styles.sectionTitle}>Your new look</Txt>
            <Image source={{ uri: result }} style={styles.resultImg} contentFit="cover" />
          </View>
        )}
      </ScrollView>
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

  resultWrap: { marginTop: Spacing.lg, gap: Spacing.sm },
  resultImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: Radius.lg, backgroundColor: Palette.surface },
});
