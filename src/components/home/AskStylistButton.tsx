import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, shadows, spacing, typography } from '../../theme';

type Props = { onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> };

/** A prompt launcher: composing stays in the stylist conversation. */
export function AskStylistButton({ onPress, disabled = false, style }: Props) {
  return (
    <PressableScale
      style={style}
      contentStyle={[styles.surface, disabled && styles.disabled]}
      pressedContentStyle={styles.pressed}
      motion="crisp" scaleTo={0.985} haptic={false}
      onPress={onPress} disabled={disabled}
      accessibilityRole="button" accessibilityLabel="Ask your stylist anything"
      accessibilityHint="Opens your stylist" accessibilityState={{ disabled }}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primaryForeground} accessible={false} />
      <Text style={styles.label}>Ask your stylist anything…</Text>
      <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} accessible={false} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  surface: {
    minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.control, paddingVertical: spacing.lg,
    borderRadius: radii.full, backgroundColor: colors.primary, ...shadows.control,
  },
  label: { flex: 1, ...typography.text.label, color: colors.primaryForeground },
  pressed: { backgroundColor: colors.primaryPressed },
  disabled: { opacity: 0.5 },
});
