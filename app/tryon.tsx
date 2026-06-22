import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppImage as Image } from '@/components/ui/app-image';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Txt } from '@/components/ui/text';
import { Glow, Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import {
  fetchTryOnStyles,
  grantTryonConsent,
  hasTryonConsent,
  requestTryOn,
  uploadTryonImage,
  type TryOnStyle,
} from '@/lib/tryon';
import { useAuth } from '@/store/auth';
import { useFeedback } from '@/store/feedback';

type Mode = 'library' | 'reference';

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

export default function TryOnScreen() {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const centered = useCenteredContent(560);

  const [consent, setConsent] = useState<boolean | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);

  const [selfie, setSelfie] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('library');
  const [styles_, setStyles] = useState<TryOnStyle[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [picked, setPicked] = useState<TryOnStyle | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    hasTryonConsent(user.id).then(setConsent);
  }, [user]);

  const loadStyles = useCallback(async () => {
    if (styles_.length || stylesLoading) return;
    setStylesLoading(true);
    setStyles(await fetchTryOnStyles());
    setStylesLoading(false);
  }, [styles_.length, stylesLoading]);

  useEffect(() => {
    if (consent && mode === 'library') loadStyles();
  }, [consent, mode, loadStyles]);

  const onAgree = async () => {
    if (!user) return;
    setSavingConsent(true);
    const ok = await grantTryonConsent(user.id);
    setSavingConsent(false);
    if (ok) setConsent(true);
    else toast('Could not save your choice. Please try again.', { tone: 'error' });
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

  const canRun = !!selfie && (mode === 'library' ? !!picked : !!reference) && !running;

  const onRun = async () => {
    if (!user || !selfie) return;
    setRunning(true);
    setResult(null);
    try {
      const selfiePath = await uploadTryonImage(user.id, 'selfie', selfie);
      const res =
        mode === 'library' && picked
          ? await requestTryOn({
              selfiePath,
              source: 'template',
              templateId: picked.templateId,
              styleLabel: picked.label,
            })
          : await requestTryOn({
              selfiePath,
              source: 'reference',
              refPath: await uploadTryonImage(user.id, 'ref', reference!),
            });
      if (res.status === 'succeeded' && res.resultUrl) {
        setResult(res.resultUrl);
      } else {
        toast(res.error ?? 'Could not generate this look.', { tone: 'error' });
      }
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
            See a new style on you
          </Txt>
          <Txt variant="body" color={Palette.textMuted} style={styles.consentText}>
            Upload a selfie and our AI previews different haircuts on your own face. To do this,
            your photo is sent securely to our styling provider (Perfect Corp / YouCam) to generate
            the preview.
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
              <Txt variant="label" color={Palette.accent} style={styles.ctaTxt}>
                I AGREE & CONTINUE
              </Txt>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Main flow ---
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
            <Image source={{ uri: selfie }} style={styles.selfieImg} contentFit="cover" />
          ) : (
            <Txt variant="label" color={Palette.textMuted}>Tap to choose a clear, front-facing selfie</Txt>
          )}
        </Pressable>

        {/* Step 2 — style */}
        <Txt variant="heading" style={styles.sectionTitle}>2. Choose a style</Txt>
        <View style={styles.tabs}>
          {(['library', 'reference'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              style={[styles.tab, mode === m && styles.tabActive]}
              onPress={() => setMode(m)}
              accessibilityRole="button">
              <Txt variant="label" color={mode === m ? Palette.accent : Palette.textMuted}>
                {m === 'library' ? 'Style library' : 'Reference photo'}
              </Txt>
            </Pressable>
          ))}
        </View>

        {mode === 'library' ? (
          stylesLoading ? (
            <View style={styles.stylesLoading}>
              <ActivityIndicator color={Palette.accent} />
            </View>
          ) : styles_.length === 0 ? (
            <Txt variant="label" color={Palette.textDim} style={styles.note}>
              No styles available yet.
            </Txt>
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
                  {!!s.label && (
                    <Txt variant="caption" numberOfLines={1} style={styles.styleLabel}>{s.label}</Txt>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )
        ) : (
          <Pressable
            style={styles.refBox}
            onPress={onPickReference}
            accessibilityRole="button"
            accessibilityLabel="Choose a reference style photo">
            {reference ? (
              <Image source={{ uri: reference }} style={styles.selfieImg} contentFit="cover" />
            ) : (
              <Txt variant="label" color={Palette.textMuted}>Tap to upload a photo of the hairstyle you want</Txt>
            )}
          </Pressable>
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
  selfieImg: { width: '100%', height: '100%' },

  tabs: { flexDirection: 'row', gap: Spacing.sm },
  tab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabActive: { borderColor: Palette.accent, backgroundColor: Palette.accentSoft },

  stylesLoading: { height: 120, alignItems: 'center', justifyContent: 'center' },
  styleRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  styleCard: {
    width: 96,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  styleCardActive: { borderColor: Palette.accent },
  styleThumb: { width: '100%', height: 120, backgroundColor: Palette.surface },
  styleLabel: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.xs },

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
  note: { textAlign: 'center' },

  resultWrap: { marginTop: Spacing.lg, gap: Spacing.sm },
  resultImg: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
  },
});
