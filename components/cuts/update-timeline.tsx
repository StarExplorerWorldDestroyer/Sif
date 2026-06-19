import { AppImage as Image } from '@/components/ui/app-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DatePickerField } from '@/components/ui/date-picker-field';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { toISODate } from '@/lib/reminders';
import { useFeedback } from '@/store/feedback';
import { useHaircuts } from '@/store/haircuts';
import type { HaircutUpdate } from '@/types';

const today = () => toISODate(new Date());

/**
 * A follow-up timeline for a haircut: add dated photos + notes to track how it
 * grew out and aged. The original photos remain the haircut's main images.
 */
export function UpdateTimeline({ haircutId }: { haircutId: string }) {
  const { fetchUpdates, addUpdate, deleteUpdate } = useHaircuts();
  const { confirm, toast } = useFeedback();
  const [updates, setUpdates] = useState<HaircutUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  const [uri, setUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [takenOn, setTakenOn] = useState(today());
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setUpdates(await fetchUpdates(haircutId));
    setLoading(false);
  }, [fetchUpdates, haircutId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to add an update.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    setUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return;
    setUri(result.assets[0].uri);
  }

  function choosePhoto() {
    if (Platform.OS === 'web') {
      pickPhoto();
      return;
    }
    Alert.alert('Add update photo', undefined, [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function save() {
    if (!uri || saving) return;
    setSaving(true);
    try {
      await addUpdate(haircutId, { uri, note, takenOn });
      setUri(null);
      setNote('');
      setTakenOn(today());
      await reload();
    } catch {
      toast('Something went wrong adding your update. Please try again.', { tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove(id: string) {
    const ok = await confirm({
      title: 'Remove update?',
      message: 'This deletes this photo and note.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setUpdates((prev) => prev.filter((u) => u.id !== id));
    await deleteUpdate(id);
  }

  return (
    <View>
      {loading ? (
        <ActivityIndicator color={Palette.accent} />
      ) : (
        updates.map((u) => (
          <View key={u.id} style={styles.item}>
            <Pressable onPress={() => setViewing(u.uri)}>
              <Image source={{ uri: u.uri }} style={styles.thumb} contentFit="cover" />
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="caption" color={Palette.textMuted}>
                {formatDate(u.takenOn)}
              </Txt>
              {u.note ? <Txt variant="label">{u.note}</Txt> : null}
            </View>
            <Pressable
              onPress={() => confirmRemove(u.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Remove update">
              <IconSymbol name="trash" size={16} color={Palette.textMuted} />
            </Pressable>
          </View>
        ))
      )}

      {/* Add new update */}
      <View style={styles.form}>
        {uri ? (
          <Image source={{ uri }} style={styles.preview} contentFit="cover" />
        ) : (
          <Pressable style={styles.pickBox} onPress={choosePhoto}>
            <IconSymbol name="plus" size={20} color={Palette.accent} />
            <Txt variant="label" color={Palette.accent}>
              Add a grow-out photo
            </Txt>
          </Pressable>
        )}

        {uri ? (
          <View style={styles.fields}>
            <DatePickerField
              label="Date taken"
              value={takenOn}
              onChange={setTakenOn}
              style={styles.dateField}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="How does it look now?"
              placeholderTextColor={Palette.textDim}
              style={styles.input}
            />
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.save]} onPress={save} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={Palette.black} />
                ) : (
                  <Txt variant="label" color={Palette.black} style={{ fontWeight: '600' }}>
                    Add update
                  </Txt>
                )}
              </Pressable>
              <Pressable style={[styles.btn, styles.cancel]} onPress={() => setUri(null)}>
                <Txt variant="label" color={Palette.textMuted}>
                  Cancel
                </Txt>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.lightbox} onPress={() => setViewing(null)}>
          {viewing ? (
            <Image source={{ uri: viewing }} style={styles.lightboxImage} contentFit="contain" />
          ) : null}
          <Pressable
            style={styles.lightboxClose}
            onPress={() => setViewing(null)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close photo">
            <IconSymbol name="xmark" size={24} color={Palette.text} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  thumb: { width: 56, height: 56, borderRadius: Radius.sm, backgroundColor: Palette.surfaceAlt },
  form: { marginTop: Spacing.md },
  pickBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.accent,
    borderStyle: 'dashed',
  },
  preview: { width: '100%', height: 180, borderRadius: Radius.md, backgroundColor: Palette.surfaceAlt },
  fields: { gap: Spacing.sm, marginTop: Spacing.sm },
  dateField: { marginBottom: 0 },
  input: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Palette.text,
    fontSize: FontSize.sm,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  btn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill, alignItems: 'center' },
  save: { backgroundColor: Palette.accent },
  cancel: { borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  lightboxImage: { width: '100%', height: '80%' },
  lightboxClose: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing.xl,
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
