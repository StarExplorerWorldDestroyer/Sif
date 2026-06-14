import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Txt } from '@/components/ui/text';
import { FontSize, Palette, Radius, Spacing } from '@/constants/theme';

/** A labeled text input styled for the dark theme. */
export function Field({
  label,
  style,
  ...rest
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.wrap}>
      <Txt variant="label" style={styles.label}>
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={Palette.textDim}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg },
  label: { marginBottom: Spacing.xs },
  input: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Palette.text,
    fontSize: FontSize.md,
  },
});
