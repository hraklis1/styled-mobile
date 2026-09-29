import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { colors, radii, spacing, typography } from '../../../theme';

/**
 * Removal is instant and undoable rather than confirmed up front — the
 * "are you sure?" step cost a tap on every removal to save one in a hundred.
 */
export function UndoToast({ message, bottom, reduceMotion, onUndo }: {
  message: string;
  bottom: number;
  reduceMotion: boolean;
  onUndo: () => void;
}) {
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(200)}
      exiting={reduceMotion ? undefined : FadeOutDown.duration(160)}
      style={[styles.toast, { bottom }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.toastText} numberOfLines={1}>{message}</Text>
      <TouchableOpacity onPress={onUndo} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Undo removal">
        <Text style={styles.undo}>Undo</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ConfirmationPanel({ title, message, confirmLabel, bottomInset, onCancel, onConfirm }: {
  title: string;
  message: string;
  confirmLabel: string;
  bottomInset: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.layer} accessibilityViewIsModal>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onCancel} accessibilityLabel="Cancel" />
      <View style={[styles.card, { paddingBottom: Math.max(bottomInset, spacing.lg) }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity style={styles.destructive} onPress={onConfirm} accessibilityRole="button">
          <Text style={styles.destructiveText}>{confirmLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancel} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Keep reviewing</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    boxShadow: '0 8px 24px rgba(31,26,22,0.18)',
  },
  toastText: { ...typography.text.bodySmall, color: colors.primaryForeground, flex: 1 },
  undo: { ...typography.text.label, color: colors.primaryForeground, textDecorationLine: 'underline' },
  layer: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', zIndex: 100 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(31,26,22,0.36)' },
  card: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderCurve: 'continuous',
    backgroundColor: colors.background,
    boxShadow: '0 -8px 28px rgba(31,26,22,0.12)',
  },
  handle: { width: 36, height: 4, alignSelf: 'center', borderRadius: radii.full, backgroundColor: colors.border },
  title: { ...typography.text.editorialSection, color: colors.foreground, textAlign: 'center' },
  message: { ...typography.text.bodySmall, color: colors.mutedForeground, textAlign: 'center' },
  destructive: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.action,
    backgroundColor: colors.surfaceSelected,
  },
  destructiveText: { ...typography.text.label, color: colors.action },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...typography.text.label, color: colors.foreground },
});
