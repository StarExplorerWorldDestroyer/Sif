import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Txt } from '@/components/ui/text';
import { FontSize, Glow, Palette, Radius, Spacing } from '@/constants/theme';

/** A labeled text input styled for the dark theme. */
export function Field({
  label,
  required,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { label: string; required?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Txt variant="label" style={styles.label}>
        {label}
        {required ? <Txt color={Palette.accent}> *</Txt> : null}
      </Txt>
      <TextInput
        placeholderTextColor={Palette.textDim}
        style={[styles.input, focused && styles.inputFocused, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
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
  inputFocused: {
    borderWidth: 1,
    borderColor: Palette.accent,
    ...Glow.sm,
  },
});
