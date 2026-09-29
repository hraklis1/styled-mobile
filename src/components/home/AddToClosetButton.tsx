import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, shadows, spacing, typography } from '../../theme';

type Props = { onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> };

/**
 * The stylist pill's secondary twin: same height and anatomy, light surface so
 * the obsidian stylist entry stays the primary action. What it does is
 * explained once by Home's first-run coachmark rather than a standing caption.
 */
export function AddToClosetButton({ onPress, disabled = false, style }: Props) {
  return (
    <PressableScale
      style={style} contentStyle={[styles.surface, disabled && styles.disabled]}
      pressedContentStyle={styles.pressed} motion="crisp" scaleTo={0.985} haptic={false}
      onPress={onPress} disabled={disabled} accessibilityRole="button"
      accessibilityLabel="Add to my closet" accessibilityState={{ disabled }}
      accessibilityHint="Opens options to take a photo, choose from your library, or import several pieces"
    >
      <Ionicons name="camera-outline" size={20} color={colors.primary} accessible={false} />
      <Text style={styles.label}>Add to my closet</Text>
      <Ionicons name="add" size={20} color={colors.primary} accessible={false} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  surface: {
    minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.control, paddingVertical: spacing.lg,
    borderRadius: radii.full, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: colors.surfaceElevated, ...shadows.control,
  },
  label: { flex: 1, ...typography.text.label, color: colors.foreground },
  pressed: { backgroundColor: colors.surfaceSubtle },
  disabled: { opacity: 0.5 },
});
