import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, spacing, stroke, typography } from '../../theme';

type Props = { onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> };

/**
 * The stylist pill's secondary twin: same height, drawn as a 1pt outline on
 * the canvas so the charcoal stylist entry stays the primary action. What it
 * does is explained once by Home's first-run coachmark rather than a standing
 * caption.
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
      <Ionicons name="camera-outline" size={18} color={colors.foreground} accessible={false} />
      <Text style={styles.label} numberOfLines={2}>Add to my closet</Text>
      <Ionicons name="add" size={18} color={colors.foreground} accessible={false} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  surface: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.control, paddingVertical: spacing.md,
    borderRadius: radii.full, borderWidth: stroke.fine, borderColor: colors.ghostStroke,
    backgroundColor: 'transparent',
  },
  label: {
    flex: 1, ...typography.text.label, fontWeight: typography.weight.medium, color: colors.foreground,
  },
  pressed: { backgroundColor: colors.surfaceSubtle },
  disabled: { opacity: 0.5 },
});
