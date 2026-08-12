import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useItems, useUpdateItem } from '../../hooks/useItems';
import { useAuth } from '../../contexts/AuthContext';
import { useEntitlement } from '../../hooks/useEntitlement';
import {
  itemsNeedingCutout,
  resetBackfillCursor,
  runCutoutBackfill,
  type BackfillHandle,
  type BackfillProgress,
} from '../../lib/cutoutBackfill';
import { SectionCard } from '../primitives/SectionCard';
import { AnimatedProgressBar } from '../primitives/AnimatedProgressBar';
import { colors, spacing, typography, radii } from '../../theme';
import type { Item } from '../../types/item';

/**
 * "Polish closet visuals" — opt-in batch background removal for items that
 * predate cutouts.
 *
 * Runs through lib/cutoutBackfill, which trickles one request at a time. The UI
 * stays deliberately honest about that: it shows progress and a cancel button
 * rather than implying the work is instant, because on a large closet it isn't.
 */
export function ClosetVisualsCard() {
  const { user } = useAuth();
  const { data: items = [] } = useItems();
  const updateItem = useUpdateItem();
  const { credits, costOf } = useEntitlement();

  const [progress, setProgress] = useState<BackfillProgress | null>(null);
  const [clearing, setClearing] = useState(false);
  const handleRef = useRef<BackfillHandle | null>(null);

  // This backfill drives POST /api/cutout per item, not the (pricier) `polish`
  // meter — so the per-item cost here is the cutout price.
  const cutoutCost = costOf('cutout');
  const pendingCount = itemsNeedingCutout(items).length;
  const cutoutCount = items.filter((i) => !!i.cutoutUrl).length;
  const pendingTotalCost = pendingCount * cutoutCost;
  const redoAllTotalCost = items.length * cutoutCost;
  const running = progress !== null && progress.stoppedReason === null
    && progress.completed < progress.total;

  // Cancel any in-flight run if the screen goes away mid-backfill.
  useEffect(() => () => handleRef.current?.cancel(), []);

  const startRun = useCallback((queue: Item[]) => {
    if (!user || handleRef.current) return;

    const handle = runCutoutBackfill({
      items: queue,
      userId: user.id,
      onProgress: setProgress,
      // Persist each cutout as it lands rather than batching at the end, so a
      // cancelled or interrupted run still keeps everything it finished.
      onItemCutout: (itemId, cutoutUrl) => updateItem.mutate({ id: itemId, cutoutUrl }),
    });
    handleRef.current = handle;

    handle.done.then((final) => {
      handleRef.current = null;
      setProgress(final);
      if (final.stoppedReason === 'too_many_failures') {
        Alert.alert(
          'Paused',
          'Background removal is busy right now, so the rest was left for later. Your finished items are saved — start again any time.',
        );
      }
    });
  }, [updateItem, user]);

  const handleStart = useCallback(() => {
    if (cutoutCost > 0 && credits != null && credits.total < pendingTotalCost) {
      Alert.alert(
        'Not enough credits',
        `Polishing ${pendingCount} item${pendingCount === 1 ? '' : 's'} needs ${pendingTotalCost} credit${pendingTotalCost === 1 ? '' : 's'} — you have ${credits.total}.`,
      );
      return;
    }
    startRun(items);
  }, [items, startRun, cutoutCost, credits, pendingCount, pendingTotalCost]);

  /**
   * Clear every existing cutout and process the library again.
   *
   * The quality rules that decide which cutouts are good enough will keep
   * moving, and the normal run only picks up items that have no cutout yet — so
   * without this, items processed under older rules would keep whatever they got
   * forever. Re-running needs to be a button rather than a hand-written SQL
   * statement.
   */
  const handleRedoAll = useCallback(() => {
    const withCutouts = items.filter((i) => !!i.cutoutUrl);
    if (cutoutCost > 0 && credits != null && credits.total < redoAllTotalCost) {
      Alert.alert(
        'Not enough credits',
        `Redoing all cutouts needs ${redoAllTotalCost} credit${redoAllTotalCost === 1 ? '' : 's'} — you have ${credits.total}.`,
      );
      return;
    }
    Alert.alert(
      'Redo all cutouts?',
      `This clears the ${withCutouts.length} existing cutout${withCutouts.length === 1 ? '' : 's'} and processes your closet again with the current quality rules${cutoutCost > 0 ? ` (${redoAllTotalCost} credit${redoAllTotalCost === 1 ? '' : 's'})` : ''}. Your original photos are untouched.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redo all',
          style: 'destructive',
          onPress: async () => {
            // Await every clear before starting the run. Firing these and
            // proceeding immediately loses cutouts: a `cutoutUrl: null` write
            // still in flight lands *after* the new cutout for the same item and
            // wipes it. Measured — 28 cutouts were produced and only 11 stuck.
            setClearing(true);
            try {
              await Promise.all(
                withCutouts.map((item) =>
                  updateItem.mutateAsync({ id: item.id, cutoutUrl: null }).catch(() => {}),
                ),
              );
              await resetBackfillCursor();
            } finally {
              setClearing(false);
            }
            // Queue from the pre-clear list with cutouts stripped: the items
            // query may not have refetched yet, and waiting on it would race.
            startRun(items.map((i) => ({ ...i, cutoutUrl: null })));
          },
        },
      ],
    );
  }, [items, startRun, updateItem, cutoutCost, credits, redoAllTotalCost]);

  const handleCancel = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
  }, []);

  const summary = running
    ? `${progress!.completed} of ${progress!.total}`
    : pendingCount > 0
      ? `${pendingCount} item${pendingCount === 1 ? '' : 's'} without a cutout`
      : cutoutCount > 0
        ? `${cutoutCount} item${cutoutCount === 1 ? '' : 's'} polished`
        : 'Nothing to polish';

  return (
    <SectionCard
      icon="color-wand-outline"
      title="CLOSET VISUALS"
      collapsible
      initiallyExpanded={false}
      summary={<Text style={styles.summary}>{summary}</Text>}
    >
      <Text style={styles.body}>
        Removes photo backgrounds so every piece sits on a clean, even surface —
        the catalog look. New items are done automatically as you add them; this
        catches up everything from before.
      </Text>

      {running ? (
        <View style={styles.progressBlock}>
          <AnimatedProgressBar
            progress={progress!.total ? (progress!.completed / progress!.total) * 100 : 0}
          />
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {progress!.completed} of {progress!.total} · {progress!.succeeded} polished
            </Text>
            <TouchableOpacity onPress={handleCancel} activeOpacity={0.7}>
              <Text style={styles.cancel}>Stop</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Processed one at a time to stay light on the server — leave this open,
            or come back later and pick up where it left off.
          </Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.button, pendingCount === 0 && styles.buttonDisabled]}
            onPress={handleStart}
            disabled={pendingCount === 0}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Ionicons
              name="color-wand-outline"
              size={16}
              color={pendingCount === 0 ? colors.mutedForeground : colors.white}
            />
            <Text style={[styles.buttonText, pendingCount === 0 && styles.buttonTextDisabled]}>
              {pendingCount === 0
                ? 'Nothing to polish'
                : `Polish ${pendingCount} item${pendingCount === 1 ? '' : 's'}${cutoutCost > 0 ? ` · ${pendingTotalCost} credit${pendingTotalCost === 1 ? '' : 's'}` : ''}`}
            </Text>
          </TouchableOpacity>

          {cutoutCount > 0 && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRedoAll}
              disabled={clearing}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Ionicons name="refresh-outline" size={14} color={colors.mutedForeground} />
              <Text style={styles.secondaryButtonText}>
                {clearing
                  ? 'Clearing…'
                  : `Redo all cutouts${cutoutCost > 0 ? ` · ${redoAllTotalCost} credit${redoAllTotalCost === 1 ? '' : 's'}` : ''}`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {progress?.stoppedReason === 'cancelled' && progress.succeeded > 0 && (
        <Text style={styles.hint}>
          Stopped — {progress.succeeded} polished and saved.
        </Text>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  summary: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  body: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 4,
  },
  buttonDisabled: {
    backgroundColor: colors.muted,
  },
  buttonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  buttonTextDisabled: {
    color: colors.mutedForeground,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  secondaryButtonText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
  },
  progressBlock: {
    gap: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  cancel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  hint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
});
