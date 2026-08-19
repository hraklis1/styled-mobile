import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../../theme';

/** Shared field furniture for the questionnaire steps. */

export function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {optional ? <Text style={s.optional}>  optional</Text> : null}
      </Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  autoCapitalize = 'words',
  maxLength,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  maxLength?: number;
  onSubmitEditing?: () => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      style={s.input}
      autoFocus={autoFocus}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      maxLength={maxLength}
      returnKeyType="done"
      onSubmitEditing={onSubmitEditing}
    />
  );
}

export const s = StyleSheet.create({
  step: { gap: spacing.xl },
  field: { gap: spacing.sm },
  label: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wide,
  },
  optional: {
    fontWeight: typography.weight.regular,
    color: colors.mutedForeground,
    textTransform: 'none',
    letterSpacing: typography.tracking.none,
  },
  hint: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    lineHeight: typography.text.caption.fontSize * typography.lineHeight.normal,
    marginTop: -spacing.xs,
  },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.text.body.fontSize,
    lineHeight: typography.inputLineHeight(typography.text.body.fontSize),
    color: colors.foreground,
  },
});
