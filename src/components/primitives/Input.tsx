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
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  inputError: {
    borderColor: colors.error,
  },
});
