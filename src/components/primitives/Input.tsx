import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors, spacing, typography, radii } from '../../theme';

type Props = TextInputProps & {
  error?: boolean;
};

export function Input({ style, error = false, ...rest }: Props) {
  return (
    <TextInput
      style={[styles.input, error && styles.inputError, style]}
      placeholderTextColor={colors.mutedForeground}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.controlOutline,
    borderRadius: radii.field,
    paddingHorizontal: spacing.lg,
    fontSize: typography.text.body.fontSize,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  inputError: {
    borderColor: colors.error,
  },
});
