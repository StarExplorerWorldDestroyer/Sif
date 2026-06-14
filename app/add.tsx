import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoEditor } from '@/components/photos/photo-editor';
import { Field } from '@/components/ui/field';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useHaircuts } from '@/store/haircuts';
import type { Photo } from '@/types';

const today = new Date().toISOString().slice(0, 10);

export default function AddHaircutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { addHaircut, updateHaircut, getById } = useHaircuts();

  const editing = getById(id ?? '');

  const [cutType, setCutType] = useState(editing?.cutType ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [stylistName, setStylistName] = useState(editing?.stylist.name ?? '');
  const [date, setDate] = useState(editing?.date ?? today);
  const [price, setPrice] = useState(editing ? String(editing.price) : '');
  const [tip, setTip] = useState(editing ? String(editing.tip) : '');
  const [notes, setNotes] = useState(editing?.publicNotes ?? '');
  const [photos, setPhotos] = useState<Photo[]>(editing?.photos ?? []);

  const canSave = cutType.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    const input = {
      cutType,
      location,
      stylistName,
      date,
      price: Number(price) || 0,
      tip: Number(tip) || 0,
      notes,
      photos,
    };
    if (editing) {
      updateHaircut(editing.id, input);
    } else {
      addHaircut(input);
    }
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
        <Txt variant="heading">{editing ? 'Edit Haircut' : 'Add Haircut'}</Txt>
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
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Txt variant="label" style={styles.sectionLabel}>
            Photos
          </Txt>
          <PhotoEditor photos={photos} onChange={setPhotos} />

          <Field
            label="Cut type"
            placeholder="e.g. Mid Skin Fade"
            value={cutType}
            onChangeText={setCutType}
          />
          <Field
            label="Salon / location"
            placeholder="e.g. Fellow Barber"
            value={location}
            onChangeText={setLocation}
          />
          <Field
            label="Stylist"
            placeholder="e.g. Marcus Reyes"
            value={stylistName}
            onChangeText={setStylistName}
          />
          <Field
            label="Date"
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
          />

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
            <Txt variant="body" color={Palette.black} style={styles.saveText}>
              {editing ? 'Save Changes' : 'Save Haircut'}
            </Txt>
          </Pressable>
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
  sectionLabel: { marginBottom: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md },
  half: { flex: 1 },
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
