import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { toISODate } from '@/lib/reminders';
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
  const centered = useCenteredContent(640);

  const editing = getById(id ?? '');
  // Stylist mode: building a cut to submit to a connected client's account.
  const forClient = !!clientId && !editing;

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

  const canSave = cutType.trim().length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
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
        await createForClient(clientId, input);
        router.back();
        Alert.alert(
          'Cut submitted',
          `Sent to ${clientName || 'your client'}. It’ll appear in their account once they accept it.`,
        );
        return;
      }
      if (editing) {
        await updateHaircut(editing.id, input);
        router.back();
      } else {
        await addHaircut(input);
        // Offer to set a reminder for the next cut, seeded from this cut's date.
        router.replace({ pathname: '/reminder', params: { postcut: '1', from: date } });
      }
    } catch {
      setSaving(false);
      Alert.alert('Could not save', 'Something went wrong saving your haircut. Please try again.');
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
            Save
          </Txt>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, centered]}
          keyboardShouldPersistTaps="handled"
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
  sectionLabel: { marginBottom: Spacing.sm },
  saveHint: { textAlign: 'center', marginTop: Spacing.sm },
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
