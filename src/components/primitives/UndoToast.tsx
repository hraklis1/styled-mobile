import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, typography } from '../../theme';

/**
 * The floating "Removed · Undo" bar. A removal that can be taken back for a
 * few seconds needs no confirmation dialog in front of it.
 */
export function UndoToast({ message, onUndo, bottom }: { message: string; onUndo: () => void; bottom: number }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(140)}
      style={[styles.toast, { bottom }]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
      <Text style={styles.text} numberOfLines={1}>{message}</Text>
      <TouchableOpacity style={styles.button} onPress={onUndo} accessibilityRole="button">
        <Text style={styles.action}>Undo</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    minHeight: 52,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: { flex: 1, color: colors.foreground, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.medium },
  button: { minWidth: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  action: { color: colors.primary, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.bold },
});
