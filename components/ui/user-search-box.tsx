import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette, Radius, Spacing } from '@/constants/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Pill on Explore; rounded rectangle in the messaging flows. */
  shape?: 'pill' | 'rounded';
  style?: StyleProp<ViewStyle>;
};

/** The shared "search people by name or @username" input box. */
export function UserSearchBox({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search people by name or @username',
  autoFocus,
  shape = 'rounded',
  style,
}: Props) {
  return (
    <View
      style={[styles.box, { borderRadius: shape === 'pill' ? Radius.pill : Radius.lg }, style]}>
      <IconSymbol name="person.fill" size={16} color={Palette.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Palette.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={onClear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search">
          <IconSymbol name="xmark" size={16} color={Palette.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  input: { flex: 1, color: Palette.text, fontSize: 15, paddingVertical: 2 },
});
