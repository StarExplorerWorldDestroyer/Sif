import { AppImage as Image } from '@/components/ui/app-image';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { PHOTO_ANGLES, type Photo, type PhotoAngle } from '@/types';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PhotoEditor({
  photos,
  onChange,
}: {
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
}) {
  async function addFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to add photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const added: Photo[] = result.assets.map((asset) => ({
      id: newId(),
      uri: asset.uri,
      angle: 'front',
      note: '',
    }));
    onChange([...photos, ...added]);
  }

  async function addFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    onChange([...photos, { id: newId(), uri: result.assets[0].uri, angle: 'front', note: '' }]);
  }

  function addPhotos() {
    // On web, Alert.alert with action buttons doesn't render, so the picker
    // would never open. Go straight to the file/library picker there.
    if (Platform.OS === 'web') {
      addFromLibrary();
      return;
    }
    Alert.alert('Add photos', undefined, [
      { text: 'Take Photo', onPress: addFromCamera },
      { text: 'Choose from Library', onPress: addFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function updatePhoto(id: string, patch: Partial<Photo>) {
    onChange(photos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePhoto(id: string) {
    onChange(photos.filter((p) => p.id !== id));
  }

  return (
    <View>
      {photos.map((photo) => (
        <View key={photo.id} style={styles.row}>
          <View style={styles.topRow}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
            <View style={styles.rowBody}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.angleRow}>
                {PHOTO_ANGLES.map((a) => {
                  const active = a.value === photo.angle;
                  return (
                    <Pressable
                      key={a.value}
                      onPress={() => updatePhoto(photo.id, { angle: a.value as PhotoAngle })}
                      style={[styles.anglePill, active && styles.anglePillActive]}>
                      <Txt variant="caption" color={active ? Palette.black : Palette.textMuted}>
                        {a.label}
                      </Txt>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <TextInput
                value={photo.note}
                onChangeText={(t) => updatePhoto(photo.id, { note: t })}
                placeholder="Add a note for this photo…"
                placeholderTextColor={Palette.textDim}
                style={styles.note}
              />
            </View>
            <Pressable onPress={() => removePhoto(photo.id)} hitSlop={8} style={styles.remove}>
              <IconSymbol name="xmark" size={16} color={Palette.textMuted} />
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable style={styles.addButton} onPress={addPhotos}>
        <IconSymbol name="plus" size={20} color={Palette.accent} />
        <Txt variant="label" color={Palette.accent}>
          {photos.length === 0 ? 'Add photos' : 'Add more photos'}
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  topRow: { flexDirection: 'row', gap: Spacing.sm },
  thumb: { width: 64, height: 64, borderRadius: Radius.sm, backgroundColor: Palette.surfaceAlt },
  rowBody: { flex: 1, gap: Spacing.sm },
  angleRow: { gap: Spacing.xs, paddingRight: Spacing.sm },
  anglePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  anglePillActive: { backgroundColor: Palette.accent },
  note: {
    color: Palette.text,
    fontSize: FontSize.sm,
    paddingVertical: 4,
  },
  remove: { padding: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.accent,
    borderStyle: 'dashed',
    marginBottom: Spacing.lg,
  },
});
