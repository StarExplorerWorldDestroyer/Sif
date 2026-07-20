import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoEditor } from '@/components/photos/photo-editor';
import { StylistAutocomplete } from '@/components/social/stylist-autocomplete';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Field } from '@/components/ui/field';
import { TagInput } from '@/components/ui/tag-input';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useCenteredContent } from '@/hooks/use-responsive';
import {
  clearHaircutDraft,
  draftHasContent,
  haircutDraftKey,
  loadHaircutDraft,
  saveHaircutDraft,
  type HaircutDraft,
} from '@/lib/haircut-drafts';
import { errorMessage, reportClientError, UserError } from '@/lib/errors';
import { toISODate } from '@/lib/reminders';
import { useFeedback } from '@/store/feedback';
import { useHaircuts } from '@/store/haircuts';
import type { Photo } from '@/types';

const today = toISODate(new Date());

export default function AddHaircutScreen() {
  const router = useRouter();
  const { id, clientId, clientName } = useLocalSearchParams<{
    id?: string;
    clientId?: string;
    clientName?: string;
  }>();
  const { addHaircut, updateHaircut, createForClient, getById } = useHaircuts();
  const { toast, confirm } = useFeedback();
  const centered = useCenteredContent(640);

  const editing = getById(id ?? '');
  // Stylist mode: building a cut to submit to a connected client's account.
  const forClient = !!clientId && !editing;
  const draftKey = useMemo(
    () => haircutDraftKey({ editingId: editing?.id, clientId: forClient ? clientId : undefined }),
    [editing?.id, forClient, clientId],
  );

  const [cutType, setCutType] = useState(editing?.cutType ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [stylistName, setStylistName] = useState(editing?.stylist.name ?? '');
  const [stylistId, setStylistId] = useState<string | null>(editing?.stylistId ?? null);
  const [date, setDate] = useState(editing?.date ?? today);
  const [price, setPrice] = useState(editing ? String(editing.price) : '');
  const [tip, setTip] = useState(editing ? String(editing.tip) : '');
  const [notes, setNotes] = useState(editing?.publicNotes ?? '');
  const [photos, setPhotos] = useState<Photo[]>(editing?.photos ?? []);
  const [lengthTop, setLengthTop] = useState(editing?.lengthTop ?? '');
  const [lengthSides, setLengthSides] = useState(editing?.lengthSides ?? '');
  const [lengthBack, setLengthBack] = useState(editing?.lengthBack ?? '');
  const [techniques, setTechniques] = useState<string[]>(editing?.techniques ?? []);
  const [tools, setTools] = useState<string[]>(editing?.tools ?? []);
  const [saving, setSaving] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Snapshot of notes that were already on the server when editing — used to
  // block accidental wipes if the form somehow clears them.
  const priorNotesRef = useRef(editing?.publicNotes?.trim() ?? '');

  const canSave = cutType.trim().length > 0 && !saving && draftReady;

  const applyDraft = (d: HaircutDraft) => {
    setCutType(d.cutType);
    setLocation(d.location);
    setStylistName(d.stylistName);
    setStylistId(d.stylistId);
    setDate(d.date || today);
    setPrice(d.price);
    setTip(d.tip);
    setNotes(d.notes);
    // Local photo URIs can expire after app restart — only restore when present.
    if (d.photos?.length) setPhotos(d.photos);
    setLengthTop(d.lengthTop);
    setLengthSides(d.lengthSides);
    setLengthBack(d.lengthBack);
    setTechniques(d.techniques ?? []);
    setTools(d.tools ?? []);
  };

  // Restore a local draft so notes survive failed saves / accidental backs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await loadHaircutDraft(draftKey);
      if (cancelled) return;
      if (draftHasContent(draft)) {
        if (editing) {
          // Prefer draft notes when they're longer than what's on the server
          // (covers "typed notes, save failed, came back to edit").
          const serverNotes = editing.publicNotes?.trim() ?? '';
          const draftNotes = draft!.notes.trim();
          if (draftNotes.length > serverNotes.length) {
            applyDraft(draft!);
            setDraftRestored(true);
          } else if (draftNotes.length > 0 && draftNotes !== serverNotes) {
            applyDraft({ ...draft!, notes: draftNotes || serverNotes });
            setDraftRestored(true);
          }
        } else {
          applyDraft(draft!);
          setDraftRestored(true);
        }
      }
      setDraftReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // Only run for this screen identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Debounced autosave of the whole form (notes especially).
  useEffect(() => {
    if (!draftReady) return;
    const timer = setTimeout(() => {
      void saveHaircutDraft(draftKey, {
        cutType,
        location,
        stylistName,
        stylistId,
        date,
        price,
        tip,
        notes,
        photos,
        lengthTop,
        lengthSides,
        lengthBack,
        techniques,
        tools,
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [
    draftReady,
    draftKey,
    cutType,
    location,
    stylistName,
    stylistId,
    date,
    price,
    tip,
    notes,
    photos,
    lengthTop,
    lengthSides,
    lengthBack,
    techniques,
    tools,
  ]);

  async function flushDraft() {
    await saveHaircutDraft(draftKey, {
      cutType,
      location,
      stylistName,
      stylistId,
      date,
      price,
      tip,
      notes,
      photos,
      lengthTop,
      lengthSides,
      lengthBack,
      techniques,
      tools,
    });
  }

  async function handleSave() {
    if (!canSave) return;
    Keyboard.dismiss();
    await flushDraft();

    const prior = priorNotesRef.current;
    if (editing && prior.length >= 20 && notes.trim().length === 0) {
      const ok = await confirm({
        title: 'Clear notes?',
        message: 'This cut already has notes saved. Saving now will erase them.',
        confirmLabel: 'Clear notes',
        cancelLabel: 'Keep editing',
        destructive: true,
      });
      if (!ok) return;
    }

    const input = {
      cutType,
      location,
      stylistName,
      stylistId,
      date,
      price: Number(price) || 0,
      tip: Number(tip) || 0,
      notes,
      photos,
      lengthTop,
      lengthSides,
      lengthBack,
      techniques,
      tools,
    };
    setSaving(true);
    try {
      if (forClient && clientId) {
        const result = await createForClient(clientId, input);
        if (!result.photosOk) {
          reportClientError({
            scope: 'haircut.submit_client.photos',
            message: 'Photos failed after cut submit',
            detail: { haircutId: result.id, photoCount: photos.length },
          });
          toast(UserError.saveHaircutPhotos, { tone: 'error' });
          // Keep draft so they can retry photos; cut is already pending for client.
          setSaving(false);
          return;
        }
        await clearHaircutDraft(draftKey);
        router.back();
        toast(
          `Sent to ${clientName || 'your client'}. It’ll appear in their account once they accept it.`,
          { tone: 'success' },
        );
        return;
      }
      if (editing) {
        const result = await updateHaircut(editing.id, input);
        priorNotesRef.current = notes.trim();
        if (!result.photosOk) {
          reportClientError({
            scope: 'haircut.update.photos',
            message: 'Photos failed after haircut update',
            detail: { haircutId: result.id, photoCount: photos.length },
          });
          toast(UserError.saveHaircutPhotos, { tone: 'error' });
          setSaving(false);
          return;
        }
        await clearHaircutDraft(draftKey);
        router.back();
        return;
      }

      const result = await addHaircut(input);
      priorNotesRef.current = notes.trim();
      if (!result.photosOk) {
        reportClientError({
          scope: 'haircut.save.photos',
          message: 'Photos failed after haircut create',
          detail: { haircutId: result.id, photoCount: photos.length },
        });
        await clearHaircutDraft(draftKey);
        // Cut + notes are on the server — open edit so they can retry photos.
        toast(UserError.saveHaircutPhotos, { tone: 'error' });
        router.replace({ pathname: '/add', params: { id: result.id } });
        return;
      }
      await clearHaircutDraft(draftKey);
      // Offer to set a reminder for the next cut, seeded from this cut's date.
      router.replace({ pathname: '/reminder', params: { postcut: '1', from: date } });
    } catch (e) {
      setSaving(false);
      await flushDraft();
      reportClientError({
        scope: forClient ? 'haircut.submit_client' : editing ? 'haircut.update' : 'haircut.save',
        message: errorMessage(e),
        detail: {
          forClient,
          editing: !!editing,
          photoCount: photos.length,
          notesLen: notes.trim().length,
        },
      });
      toast(UserError.saveHaircut, { tone: 'error' });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Txt variant="body" color={Palette.textMuted}>
            Cancel
          </Txt>
        </Pressable>
        <Txt variant="heading">
          {forClient ? 'Cut for client' : editing ? 'Edit Haircut' : 'Add Haircut'}
        </Txt>
        <Pressable onPress={handleSave} hitSlop={8} disabled={!canSave}>
          <Txt variant="body" color={canSave ? Palette.accent : Palette.textDim}>
            {forClient ? 'Submit' : 'Save'}
          </Txt>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {forClient ? (
            <View style={styles.clientBanner}>
              <Txt variant="label" color={Palette.text}>
                Submitting to {clientName ? `@${clientName}` : 'your client'}
              </Txt>
              <Txt variant="caption">
                They’ll review and accept it before it’s added to their account.
              </Txt>
            </View>
          ) : null}

          {draftRestored ? (
            <View style={styles.draftBanner}>
              <Txt variant="caption" color={Palette.accent}>
                Restored your unsaved draft (including notes).
              </Txt>
            </View>
          ) : null}

          <Txt variant="caption" style={styles.legend}>
            <Txt variant="caption" color={Palette.accent}>
              *
            </Txt>{' '}
            Required field
          </Txt>

          <Txt variant="label" style={styles.sectionLabel}>
            Photos
          </Txt>
          <PhotoEditor photos={photos} onChange={setPhotos} />

          <Field
            label="Cut type"
            placeholder="e.g. Mid Skin Fade"
            value={cutType}
            onChangeText={setCutType}
            required
          />
          <Field
            label="Salon / location"
            placeholder="e.g. Fellow Barber"
            value={location}
            onChangeText={setLocation}
          />
          <StylistAutocomplete
            label="Stylist"
            name={stylistName}
            linked={!!stylistId}
            onChangeName={setStylistName}
            onPick={(s) => setStylistId(s?.id ?? null)}
          />
          <DatePickerField label="Date" value={date} onChange={setDate} />

          <View style={styles.row}>
            <View style={styles.half}>
              <Field
                label="Price ($)"
                placeholder="45"
                value={price}
                onChangeText={setPrice}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.half}>
              <Field
                label="Tip ($)"
                placeholder="10"
                value={tip}
                onChangeText={setTip}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Txt variant="label" style={styles.sectionLabel}>
            Specifications
          </Txt>
          <View style={styles.row}>
            <View style={styles.third}>
              <Field
                label="Top"
                placeholder="2 in"
                value={lengthTop}
                onChangeText={setLengthTop}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.third}>
              <Field
                label="Sides"
                placeholder="0.5 in"
                value={lengthSides}
                onChangeText={setLengthSides}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.third}>
              <Field
                label="Back"
                placeholder="0.5 in"
                value={lengthBack}
                onChangeText={setLengthBack}
                autoCapitalize="none"
              />
            </View>
          </View>

          <TagInput
            label="Techniques"
            tags={techniques}
            onChange={setTechniques}
            placeholder="Type a technique, press return"
          />
          <TagInput
            label="Tools"
            tags={tools}
            onChange={setTools}
            placeholder="Type a tool, press return"
          />

          <Field
            label="Notes"
            placeholder="Anything you want to remember…"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            style={styles.notes}
          />
          {notes.trim().length > 0 ? (
            <Txt variant="caption" color={Palette.textDim} style={styles.notesHint}>
              Notes autosave on this device while you type.
            </Txt>
          ) : null}

          <Pressable
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}>
            {saving ? (
              <ActivityIndicator color={Palette.black} />
            ) : (
              <Txt variant="body" color={Palette.black} style={styles.saveText}>
                {forClient ? 'Submit to client' : editing ? 'Save Changes' : 'Save Haircut'}
              </Txt>
            )}
          </Pressable>

          {!cutType.trim() ? (
            <Txt variant="caption" style={styles.saveHint}>
              Add a cut type to save.
            </Txt>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  legend: { marginBottom: Spacing.lg },
  clientBanner: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: 2,
  },
  draftBanner: {
    backgroundColor: Palette.accentSoft,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.accent,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionLabel: { marginBottom: Spacing.sm },
  saveHint: { textAlign: 'center', marginTop: Spacing.sm },
  notesHint: { marginTop: -Spacing.md, marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  half: { flex: 1 },
  third: { flex: 1 },
  notes: { minHeight: 100, textAlignVertical: 'top' },
  saveButton: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveText: { fontWeight: '600' },
});
