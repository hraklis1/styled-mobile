import { useEffect } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useScanDraftStore } from '../../features/scan-draft/store';
import { useBatchImportStore } from '../../features/batch-import/store';
import { confirmSheet } from '../primitives/ConfirmSheet';
import { colors, radii, spacing, typography } from '../../theme';

/** Tab bar (60 + inset, see RootNavigator) plus room for the raised Stylist button. */
const TAB_BAR_CLEARANCE = 60 + 30;

type Props = {
  /** The scan sheet is open, so the draft is on screen already. */
  hidden: boolean;
  onResume: () => void;
};

/**
 * An unfinished single-photo scan left behind by an app restart: a slim pill
 * above the tab bar so the user knows it exists before they tap Add.
 */
export function ScanDraftTray({ hidden, onResume }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const summary = useScanDraftStore((s) => s.summary);
  // One tray at a time; an active batch takes the slot.
  const batchActive = useBatchImportStore((s) => !!s.batch);

  // Re-read on foreground too, so a draft that ages past its limit drops out.
  useEffect(() => {
    void useScanDraftStore.getState().refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void useScanDraftStore.getState().refresh();
    });
    return () => sub.remove();
  }, []);

  if (!summary || hidden || batchActive) return null;

  const label = summary.count === 1 ? '1 piece waiting for review' : `${summary.count} pieces waiting for review`;
  const discard = () => confirmSheet({
    title: 'Discard unfinished scan?',
    message: 'These pieces haven’t been added to your closet yet.',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep',
    destructive: true,
    onConfirm: () => { void useScanDraftStore.getState().discard(); },
  });

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(220)}
        exiting={reduceMotion ? undefined : FadeOutDown.duration(180)}
        style={styles.pill}
      >
        <TouchableOpacity
          style={styles.main}
          onPress={onResume}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Unfinished scan. ${label}`}
          accessibilityHint="Resumes the scan"
        >
          {summary.image ? (
            <Image source={{ uri: summary.image }} style={styles.thumb} contentFit="cover" />
          ) : (
            <Ionicons name="shirt-outline" size={18} color={colors.primaryForeground} />
          )}
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>Unfinished scan</Text>
            <Text style={styles.detail} numberOfLines={1}>{label}</Text>
          </View>
          <Text style={styles.resume}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={discard}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Discard unfinished scan"
        >
          <Ionicons name="close" size={18} color={colors.onPrimarySoftMuted} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    maxWidth: 420,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
  },
  copy: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  detail: {
    fontSize: typography.text.caption.fontSize,
    color: colors.onPrimarySoftMuted,
  },
  resume: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
    marginLeft: spacing.sm,
  },
});
