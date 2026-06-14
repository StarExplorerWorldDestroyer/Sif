import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/ui/field';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useHaircuts } from '@/store/haircuts';

const today = new Date().toISOString().slice(0, 10);

export default function AddHaircutScreen() {
  const router = useRouter();
  const { addHaircut } = useHaircuts();

  const [cutType, setCutType] = useState('');
  const [location, setLocation] = useState('');
  const [stylistName, setStylistName] = useState('');
  const [date, setDate] = useState(today);
  const [price, setPrice] = useState('');
  const [tip, setTip] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  const canSave = cutType.trim().length > 0;

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to choose a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
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
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  function choosePhoto() {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleSave() {
    if (!canSave) return;
    addHaircut({
      cutType,
      location,
      stylistName,
      date,
      price: Number(price) || 0,
      tip: Number(tip) || 0,
      notes,
      photoUri,
    });
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
        <Txt variant="heading">Add Haircut</Txt>
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
          <Pressable style={styles.photoPicker} onPress={choosePhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <IconSymbol name="plus" size={28} color={Palette.textMuted} />
                <Txt variant="label">Add a photo</Txt>
              </View>
            )}
          </Pressable>

          <Field
            label="Cut type"
            placeholder="e.g. Mid Skin Fade"
            value={cutType}
            onChangeText={setCutType}
            autoFocus
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
              Save Haircut
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
  photoPicker: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    backgroundColor: Palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
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
