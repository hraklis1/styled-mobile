import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useBatchImportStore } from '../../../features/batch-import/store';
import { reviewCounts } from '../../../features/wear-log/reducer';
import { startWearRunner } from '../../../features/wear-log/runner';
import { useWearLogStore } from '../../../features/wear-log/store';
import type { WearFlow } from '../../../features/wear-log/types';
import { colors, radii, spacing, typography } from '../../../theme';

/** Same clearance as BatchImportTray: tab bar plus the raised Stylist button. */
const TAB_BAR_CLEARANCE = 60 + 30;
/** When the batch tray is up, this one sits above it rather than on top. */
const STACK_OFFSET = 56;

type Summary = { title: string; detail: string | null; tone: 'working' | 'ready' | 'attention' };

function summarize(flow: WearFlow): Summary | null {
  switch (flow.status) {
    case 'processing':
      return { title: 'Reading your outfit', detail: 'Matching it to your closet', tone: 'working' };
    case 'failed':
      return flow.offline
        ? { title: 'Outfit photo waiting', detail: 'Finishes when you’re back online', tone: 'attention' }
        : { title: 'Outfit photo didn’t go through', detail: 'Tap to try again', tone: 'attention' };
    case 'reviewing':
    case 'saving': {
      const c = reviewCounts(flow);
      return {
        title: c.total === 1 ? '1 piece to review' : `${c.total} pieces to review`,
        detail: c.unresolved ? `${c.unresolved} still to decide` : 'Ready to log',
        tone: 'ready',
      };
    }
    default:
      return null;
  }
}

/**
 * The outfit scan's presence while the logger is closed — kept in the
 * background, or left mid-review. Same pill as the batch import tray;
 * tapping it reopens the logger on the scan.
 */
export function WearLogTray({ onOpen }: { onOpen: () => void }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const flow = useWearLogStore((s) => s.flow);
  const workspaceOpen = useWearLogStore((s) => s.workspaceOpen);
  const batchTrayUp = useBatchImportStore((s) => Boolean(s.batch) && !s.workspaceOpen);

  useEffect(() => startWearRunner(), []);

  const summary = summarize(flow);
  if (!summary || workspaceOpen) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.anchor, { bottom: insets.bottom + TAB_BAR_CLEARANCE + (batchTrayUp ? STACK_OFFSET : 0) }]}
    >
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(220)}
        exiting={reduceMotion ? undefined : FadeOutDown.duration(180)}
      >
        <TouchableOpacity
          style={styles.pill}
          onPress={onOpen}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={[summary.title, summary.detail].filter(Boolean).join('. ')}
          accessibilityHint="Opens your outfit log"
          accessibilityLiveRegion="polite"
        >
          {summary.tone === 'working' ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Ionicons
              name={summary.tone === 'attention' ? 'cloud-offline-outline' : 'shirt-outline'}
              size={18}
              color={colors.primaryForeground}
            />
          )}
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>{summary.title}</Text>
            {summary.detail ? <Text style={styles.detail} numberOfLines={1}>{summary.detail}</Text> : null}
          </View>
          <Ionicons name="chevron-up" size={16} color={colors.onPrimarySoftMuted} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
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
  copy: { flexShrink: 1, gap: 2 },
  title: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  detail: { fontSize: typography.text.caption.fontSize, color: colors.onPrimarySoftMuted },
});
