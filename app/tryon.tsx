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

type PickedImage = { uri: string; width?: number; height?: number };

async function pickImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
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
  const { toast } = useFeedback();
  const centered = useCenteredContent(560);

  const [consent, setConsent] = useState<boolean | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);

  const [selfie, setSelfie] = useState<PickedImage | null>(null);
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

  // Color settings.
  const [colorHex, setColorHex] = useState<string | null>(null);
  const [hexInput, setHexInput] = useState('');
  const [intensity, setIntensity] = useState(75);
  const [ombre, setOmbre] = useState(false);

  // The look being built — effects applied in order, each on the previous result.
  const [steps, setSteps] = useState<LookStep[]>([]);
  const [adding, setAdding] = useState(false);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
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
    const img = await pickImage();
    if (img) {
      setSelfie(img);
      setResult(null);
    }
  };

  const onPickReference = async () => {
    const img = await pickImage();
    if (img) {
      setReference(img);
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

  // Whether the current controls describe a valid effect to add to the look.
  const configReady =
    effectType === 'color'
      ? !!colorHex
      : effect === 'hairstyle' && useReference
        ? !!reference
        : !!picked;
  const canAdd = configReady && !adding && !running;
  const canGenerate = !!selfie && steps.length > 0 && !running;

  const onAddStep = async () => {
    if (!user || !configReady) return;
    setAdding(true);
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      let step: LookStep;
      if (effectType === 'color') {
        const color: ColorParams = {
          hex: colorHex!,
          intensity,
          pattern: ombre ? 'ombre' : 'full',
          coloringSection: 'bottom',
        };
        step = { id, kind: 'color', color, label: colorHex! };
      } else if (effect === 'hairstyle' && useReference) {
        const refPath = await uploadTryonImage(user.id, 'ref', reference!.uri, reference!);
        step = { id, kind: 'hairstyle', source: 'reference', refPath, label: 'Reference photo' };
      } else if (effect === 'hairstyle') {
        step = { id, kind: 'hairstyle', source: 'template', templateId: picked!.templateId, label: picked!.label || 'Style' };
      } else {
        step = {
          id,
          kind: effect as 'bangs' | 'extension' | 'volume' | 'wavy',
          templateId: picked!.templateId,
          label: picked!.label || EFFECT_LABEL[effect],
        };
      }
      setSteps((prev) => [...prev, step]);
      setResult(null);
      // Clear the per-effect selection so the next pick starts fresh.
      setPicked(null);
      setColorHex(null);
    } catch {
      toast('Could not add that to your look. Please try again.', { tone: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    setResult(null);
  };

  const onGenerate = async () => {
    if (!user || !selfie || steps.length === 0) return;
    setRunning(true);
    setResult(null);
    try {
      setProgress('Preparing your photo…');
      let currentPath = await uploadTryonImage(user.id, 'selfie', selfie.uri, selfie);
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        setProgress(`Applying ${EFFECT_LABEL[step.kind]} (${i + 1}/${steps.length})…`);
        const res = await runStep(step, currentPath);
        if (res.status !== 'succeeded' || !res.resultPath) {
          toast(res.error ?? `Could not apply ${EFFECT_LABEL[step.kind]}.`, { tone: 'error' });
          if (res.resultUrl) setResult(res.resultUrl);
          return;
        }
        currentPath = res.resultPath;
        if (res.resultUrl) setResult(res.resultUrl);
      }
    } catch {
      toast('Could not generate this look. Please try again.', { tone: 'error' });
    } finally {
      setRunning(false);
      setProgress(null);
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
            <Image source={{ uri: selfie.uri }} style={styles.fill} contentFit="cover" />
          ) : (
            <Txt variant="label" color={Palette.textMuted}>Tap to choose a clear, front-facing selfie</Txt>
          )}
        </Pressable>

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
              <Pressable
                style={styles.refBox}
                onPress={onPickReference}
                accessibilityRole="button"
                accessibilityLabel="Choose a reference style photo">
                {reference ? (
                  <Image source={{ uri: reference.uri }} style={styles.fill} contentFit="cover" />
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
        {!selfie && steps.length > 0 && (
          <Txt variant="caption" color={Palette.textDim} style={styles.note}>
            Add a selfie above to generate your look.
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
