import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedProgressBar } from '../primitives/AnimatedProgressBar';
import { useBatchImportStore } from '../../features/batch-import/store';
import { summarizeBatch } from '../../features/batch-import/summary';
import { discardBatch } from '../../features/batch-import/runner';
import { colors, radii, spacing, typography } from '../../theme';

/** Tab bar (60 + inset, see RootNavigator) plus room for the raised Stylist button. */
const TAB_BAR_CLEARANCE = 60 + 30;
const DONE_DISMISS_MS = 4_000;

/**
 * The batch's presence while the user carries on elsewhere: a slim pill above
 * the tab bar. Tapping it opens the full progress/review workspace.
 */
export function BatchImportTray() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const batch = useBatchImportStore((s) => s.batch);
  const workspaceOpen = useBatchImportStore((s) => s.workspaceOpen);
  const openWorkspace = useBatchImportStore((s) => s.openWorkspace);
  const summary = useMemo(() => (batch ? summarizeBatch(batch) : null), [batch]);

  // A finished batch says so briefly, then clears itself.
  const isDone = summary?.tone === 'done';
  useEffect(() => {
    if (!isDone) return;
    const timer = setTimeout(discardBatch, DONE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [isDone]);

  if (!batch || !summary || workspaceOpen) return null;

  const onPress = summary.action === 'dismiss' ? discardBatch : openWorkspace;
  const icon = summary.tone === 'done'
    ? 'checkmark-circle'
    : summary.tone === 'attention'
      ? 'alert-circle-outline'
      : 'sparkles-outline';

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(220)}
        exiting={reduceMotion ? undefined : FadeOutDown.duration(180)}
      >
        <TouchableOpacity
          style={styles.pill}
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={[summary.title, summary.detail].filter(Boolean).join('. ')}
          accessibilityHint={summary.action === 'dismiss' ? 'Dismisses this message' : 'Opens the batch import'}
          accessibilityLiveRegion="polite"
        >
          {summary.tone === 'working' ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Ionicons
              name={icon}
              size={18}
              color={summary.tone === 'done' ? colors.onPrimarySoftMuted : colors.primaryForeground}
            />
          )}
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>{summary.title}</Text>
            {summary.detail ? <Text style={styles.detail} numberOfLines={1}>{summary.detail}</Text> : null}
            {summary.progress != null ? (
              <AnimatedProgressBar
                progress={summary.progress * 100}
                height={2}
                trackColor="rgba(255,255,255,0.18)"
                color={colors.primaryForeground}
                style={styles.progress}
              />
            ) : null}
          </View>
          {summary.action === 'open' ? (
            <Ionicons name="chevron-up" size={16} color={colors.onPrimarySoftMuted} />
          ) : null}
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
    gap: spacing.sm,
    minHeight: 48,
    maxWidth: 420,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
  progress: {
    marginTop: 4,
    minWidth: 160,
  },
});
