import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../../theme';

/**
 * The one full-width action at the foot of every step.
 *
 * When the step isn't answerable yet it says what's missing ("Pick 2 or
 * more") instead of just greying out, so a disabled button never leaves the
 * user guessing.
 */
export function PrimaryCTA({
  label,
  disabledLabel,
  disabled,
  loading,
  onPress,
}: {
  label: string;
  disabledLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
      style={[s.btn, disabled && s.btnDisabled]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityLabel={disabled && disabledLabel ? disabledLabel : label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primaryForeground} />
      ) : (
        <>
          <Text style={[s.text, disabled && s.textDisabled]}>{disabled && disabledLabel ? disabledLabel : label}</Text>
          {!disabled && <Ionicons name="arrow-forward" size={16} color={colors.primaryForeground} />}
        </>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
  },
  // Disabled reads as an outline, not a faded fill: still legible, clearly not ready.
  btnDisabled: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.hairline },
  text: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  textDisabled: { color: colors.mutedForeground, fontWeight: typography.weight.medium },
});
