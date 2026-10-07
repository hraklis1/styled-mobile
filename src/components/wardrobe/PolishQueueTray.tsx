import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedProgressBar } from '../primitives/AnimatedProgressBar';
import { useBatchImportStore } from '../../features/batch-import/store';
import { summarizePolish, usePolishQueueStore } from '../../features/polish-queue/store';
import { presentPaywall } from '../../lib/paywall';
import { colors, radii, spacing, typography } from '../../theme';

/** Same clearance as BatchImportTray: tab bar plus the raised Stylist button. */
const TAB_BAR_CLEARANCE = 60 + 30;
const DONE_DISMISS_MS = 4_000;

/**
 * Polishes queued from add-to-closet, running after the pieces have landed.
 * Yields to the batch tray, which owns the same spot while a batch is open.
 */
export function PolishQueueTray({ hidden = false }: { hidden?: boolean }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const jobs = usePolishQueueStore((s) => s.jobs);
  const blocked = usePolishQueueStore((s) => s.blocked);
  const batchShowing = useBatchImportStore((s) => s.batch !== null);
  const summary = useMemo(() => summarizePolish(jobs), [jobs]);

  const finished = summary.total > 0 && summary.active === 0 && summary.failed === 0 && summary.blocked === 0;
  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => usePolishQueueStore.getState().clearSettled(), DONE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [finished]);

  if (summary.total === 0 || batchShowing || hidden) return null;

  const store = usePolishQueueStore.getState;
  let title: string;
  let detail: string | null = null;
  let tone: 'working' | 'done' | 'attention';
  let onPress: () => void;
  if (summary.active > 0) {
    tone = 'working';
    title = `Polishing ${Math.min(summary.done + 1, summary.total)} of ${summary.total}`;
    detail = 'Covers update as each one finishes';
    onPress = () => {};
  } else if (summary.blocked > 0) {
    tone = 'attention';
    title = blocked === 'free_limit' ? 'Polish needs Premium' : `Out of credits — ${summary.blocked} not polished`;
    detail = 'Tap to get credits';
    onPress = () => { void presentPaywall().then((ok) => { if (ok) store().unblock(); }); };
  } else if (summary.failed > 0) {
    tone = 'attention';
    title = `${summary.failed} couldn't be polished`;
    detail = 'Tap to try again';
    onPress = () => store().retryFailed();
  } else {
    tone = 'done';
    title = summary.done === 1 ? '1 piece polished' : `${summary.done} pieces polished`;
    onPress = () => store().clearSettled();
  }

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(220)}
        exiting={reduceMotion ? undefined : FadeOutDown.duration(180)}
      >
        <TouchableOpacity
          style={styles.pill}
          onPress={onPress}
          disabled={tone === 'working'}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={[title, detail].filter(Boolean).join('. ')}
          accessibilityLiveRegion="polite"
        >
          {tone === 'working' ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Ionicons
              name={tone === 'done' ? 'checkmark-circle' : 'alert-circle-outline'}
              size={18}
              color={tone === 'done' ? colors.onPrimarySoftMuted : colors.primaryForeground}
            />
          )}
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {detail ? <Text style={styles.detail} numberOfLines={1}>{detail}</Text> : null}
            {tone === 'working' ? (
              <AnimatedProgressBar
                progress={(summary.done / summary.total) * 100}
                height={2}
                trackColor="rgba(255,255,255,0.18)"
                color={colors.primaryForeground}
                style={styles.progress}
              />
            ) : null}
          </View>
          {tone !== 'working' && tone !== 'done' ? (
            <TouchableOpacity onPress={() => store().clearSettled()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
              <Ionicons name="close" size={16} color={colors.onPrimarySoftMuted} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, maxWidth: 420,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  copy: { flexShrink: 1, gap: 2 },
  title: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  detail: { fontSize: typography.text.caption.fontSize, color: colors.onPrimarySoftMuted },
  progress: { marginTop: 4, minWidth: 160 },
});
