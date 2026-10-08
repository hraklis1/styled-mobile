import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, radii, spacing, stroke, typography } from '../../../theme';

/**
 * Disabled is a solid stone bar with muted ink — it reads as "not yet", never
 * as a secondary button. Busy keeps full ink with a spinner so work in flight
 * doesn't look switched off.
 */
export function PrimaryButton({ label, icon, trailingIcon, onPress, disabled = false, busy = false, variant = 'primary' }: {
  disabled?: boolean; busy?: boolean; label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void;
  /** After the label, for an onward step ("Continue →"). */
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  /** `secondary` is an ink outline: still a button, but not the finishing action. */
  variant?: 'primary' | 'secondary';
}) {
  const idle = disabled && !busy;
  const ink = idle ? colors.mutedForeground : variant === 'secondary' ? colors.foreground : colors.primaryForeground;
  return (
    <TouchableOpacity disabled={disabled || busy} accessibilityState={{ disabled: disabled && !busy, busy }} style={[styles.primary, variant === 'secondary' && styles.primaryOutline, idle && styles.primaryIdle]} onPress={onPress} accessibilityRole="button" activeOpacity={0.85}>
      {busy ? <ActivityIndicator size="small" color={ink} />
        : icon ? <Ionicons name={icon} size={17} color={ink} /> : null}
      <Animated.Text key={label} entering={FadeIn.duration(180)} style={[styles.primaryText, { color: ink }]}>{label}</Animated.Text>
      {trailingIcon && !busy ? <Ionicons name={trailingIcon} size={18} color={ink} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
  },
  // Disabled is a solid stone pair, not a faded black: readable, clearly inert.
  primaryIdle: { backgroundColor: colors.hairline, borderWidth: 0 },
  primaryOutline: { backgroundColor: 'transparent', borderWidth: stroke.fine, borderColor: colors.foreground },
  primaryText: { textAlign: 'center', ...typography.text.sectionTitle, color: colors.primaryForeground },
});
