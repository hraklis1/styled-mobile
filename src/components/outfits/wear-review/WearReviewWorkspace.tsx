import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';

import { DetectionState } from '../../wardrobe/scan-review/LoadingStates';
import { PrimaryButton } from '../../wardrobe/scan-review/ActionBar';
import { TextLink } from '../../wardrobe/scan-review/atoms';
import { cropFeedback } from '../../wardrobe/scan-review/feedback';
import { useReviewReducedMotion } from '../../../hooks/useReviewReducedMotion';
import { applySavedItems, useItems } from '../../../hooks/useItems';
import { OUTFIT_LOGS_QUERY_KEY } from '../../../hooks/useOutfitLogs';
import { track } from '../../../lib/analytics';
import { colors, spacing, stroke, typography } from '../../../theme';
import type { Item } from '../../../types/item';
import { saveWearLog } from '../../../features/wear-log/api';
import { canLog, matchedItemIds, orderedDetections, reviewCounts, reviewQueue, selectedItemIds, sharedMatch } from '../../../features/wear-log/reducer';
import { discardWearFlow, retryWearScan } from '../../../features/wear-log/runner';
import { dispatchWear, useWearLogStore } from '../../../features/wear-log/store';
import type { ReviewFlow } from '../../../features/wear-log/types';
import { ClosetPicker } from './ClosetMatchSheet';
import { WorkspaceSheet } from '../../wardrobe/scan-review/WorkspaceSheet';
import { WearResolveSheet } from './WearResolveSheet';
import { PieceImage } from './PieceImage';
import { WornDateSheet } from './WornDateSheet';
import { PairingRow } from './PairingRow';

type Surface = { kind: 'resolve'; queue: string[]; initialPhoto?: boolean } | { kind: 'add' } | { kind: 'date' };

/** After this long a scan offers to carry on without the user watching. */
const SLOW_SCAN_MS = 8_000;

/** True once `key` has stayed the same for `ms`; resets when it changes. */
function useSlowFlag(key: string | null, ms: number): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!key) return;
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return slow;
}
type DateChoice = 'today' | 'yesterday' | 'other';

function isoDay(offset: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateChoice(date: string): DateChoice {
  if (date === isoDay(0)) return 'today';
  if (date === isoDay(-1)) return 'yesterday';
  return 'other';
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const pieces = (n: number) => (n === 1 ? '1 piece' : `${n} pieces`);

/**
 * The outfit logger's scan: processing → review → logged, in one surface.
 * State lives in the wear-log store (persisted), so closing the logger or
 * the app mid-review resumes where it was; this component only renders it.
 */
export function WearReviewWorkspace({ onClose, onMinimize, onLogged, onPickManually }: {
  onClose: () => void;
  /** Close the logger and let the scan finish; the tray stands in for it. */
  onMinimize: () => void;
  onLogged: () => void;
  /** Leave the scan for the hand-picked logger (credits, a bad photo). */
  onPickManually: () => void;
}) {
  const flow = useWearLogStore((s) => s.flow);
  const setWorkspaceOpen = useWearLogStore((s) => s.setWorkspaceOpen);
  const reduceMotion = useReviewReducedMotion();
  useEffect(() => {
    setWorkspaceOpen(true);
    return () => setWorkspaceOpen(false);
  }, [setWorkspaceOpen]);
  const slow = useSlowFlag(flow.status === 'processing' ? flow.id : null, SLOW_SCAN_MS);
  const safe = useSafeAreaInsets();
  // The logger is an iOS page sheet, which already starts below the status
  // bar; the window's top inset would push the header down a second time.
  const insets = { top: Platform.OS === 'ios' ? 0 : safe.top, bottom: safe.bottom };
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.round(height * 0.32);

  if (flow.status === 'processing' || flow.status === 'failed') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="Log today’s wear" onClose={onClose} />
        {flow.status === 'processing' ? (
          <DetectionState
            previewImage={flow.photoUri}
            progress={{ current: 0, total: 0 }}
            heroHeight={heroHeight}
            reduceMotion={reduceMotion}
            title="Reading your outfit"
            stepLabels={['Detect', 'Match']}
          />
        ) : null}
        {flow.status === 'processing' ? (
          <View style={[styles.bar, styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            {slow ? (
              <View style={styles.center} accessibilityLiveRegion="polite">
                <Text style={styles.slowText}>Taking longer than usual</Text>
                <TextLink label="Keep going in the background" onPress={onMinimize} />
              </View>
            ) : (
              <View style={styles.center}>
                <TextLink label="Pick the pieces yourself" tone="muted" onPress={onPickManually} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.failed} accessibilityLiveRegion="polite">
            <Image source={{ uri: flow.photoUri }} style={{ width, height: heroHeight }} contentFit="contain" />
            <Text style={styles.failedTitle}>{flow.offline ? 'Saved for when you’re back online' : 'That didn’t go through'}</Text>
            <Text style={styles.failedCopy}>{flow.message}</Text>
            <View style={[styles.bar, styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
              {flow.offline
                ? <PrimaryButton label="Keep it for later" onPress={onMinimize} />
                : <PrimaryButton label="Try again" onPress={() => { if (!retryWearScan()) onPickManually(); }} />}
              <View style={styles.center}><TextLink label="Pick the pieces yourself" onPress={onPickManually} /></View>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (flow.status === 'logged') {
    return <Logged flow={flow} topInset={insets.top} onDone={onLogged} />;
  }

  if (flow.status === 'idle') return null;

  return (
    <Review
      flow={flow}
      heroHeight={Math.min(Math.round(height * 0.28), 240)}
      width={width}
      insets={insets}
      reduceMotion={reduceMotion}
      onClose={onClose}
    />
  );
}

function Header({ title, onClose, right }: { title: string; onClose: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onClose} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }} hitSlop={4} accessibilityRole="button" accessibilityLabel="Close">
        <Ionicons name="close" size={24} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} accessibilityRole="header">{title}</Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

function Review({ flow, heroHeight, width, insets, reduceMotion, onClose }: {
  flow: ReviewFlow;
  heroHeight: number;
  width: number;
  insets: { top: number; bottom: number };
  reduceMotion: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: items = [], isSuccess, isError, refetch } = useItems();
  const itemsById = useMemo(() => new Map<number, Item>(items.map((i) => [i.id, i])), [items]);
  const availableIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const [surface, setSurface] = useState<Surface | null>(null);
  const ordered = useMemo(() => orderedDetections(flow.scan), [flow.scan]);
  const numbers = useMemo(() => Object.fromEntries(ordered.map((d, i) => [d.id, i + 1])), [ordered]);
  const counts = reviewCounts(flow);
  const queue = reviewQueue(flow, isSuccess ? availableIds : undefined);
  const missingAdditional = isSuccess ? flow.additionalItemIds.filter((id) => !availableIds.has(id)) : [];
  const saving = flow.status === 'saving';
  const openPiece = (id: string) => { if (!saving) setSurface({ kind: 'resolve', queue: [id] }); };
  const closeSurface = () => { dispatchWear({ type: 'closeResolve' }); setSurface(null); };

  const save = useCallback(async () => {
    const current = useWearLogStore.getState().flow;
    if (current.status !== 'reviewing' || !canLog(current) || !isSuccess
      || selectedItemIds(current).some((id) => !availableIds.has(id))) return;
    dispatchWear({ type: 'saveStarted' });
    try {
      const saved = await saveWearLog(current);
      applySavedItems(qc, saved.createdItems);
      void qc.invalidateQueries({ queryKey: OUTFIT_LOGS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ['items'] });
      cropFeedback(true);
      track('outfit_scan_review_completed', {
        matched_count: matchedItemIds(current).length,
        new_count: saved.createdItems.length,
        manually_added_count: current.additionalItemIds.length,
        skipped_count: Object.values(current.resolutions).filter((r) => r.kind === 'dismissed').length,
        already_logged_count: saved.alreadyLoggedItemIds.length,
      });
      dispatchWear({ type: 'saved', logId: saved.logId, itemIds: saved.itemIds, alreadyLoggedItemIds: saved.alreadyLoggedItemIds });
    } catch (err) {
      cropFeedback(false);
      const offline = !(err as { response?: unknown })?.response;
      dispatchWear({ type: 'saveFailed', message: offline ? 'You’re offline. Your review is saved — log it when you’re back.' : 'Couldn’t log this outfit. Try again.' });
    }
  }, [qc, availableIds, isSuccess]);
  const dateLabel = dateChoice(flow.date) === 'today' ? 'Worn today' : dateChoice(flow.date) === 'yesterday' ? 'Worn yesterday' : `Worn ${shortDate(flow.date)}`;
  const buttonLabel = saving ? 'Logging…' : queue.length ? `Review ${pieces(queue.length)}` : 'Log outfit';
  const status = queue.length ? `${pieces(queue.length)} ${queue.length === 1 ? 'needs' : 'need'} review`
    : counts.newItems ? `${pieces(counts.logging)} selected` : `${pieces(counts.logging)} matched`;
  return (
    <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top }]}>
      <Header title="Review outfit" onClose={onClose} right={<TextLink label="Retake" tone="muted" disabled={saving} onPress={() => { discardWearFlow(); onClose(); }} />} />
      <View style={styles.body}>
        <FlatList data={ordered} keyExtractor={(d) => d.id} style={styles.body}
          ListHeaderComponent={<View>
            <Pressable disabled={saving} onPress={() => setSurface({ kind: 'resolve', queue: [], initialPhoto: true })} accessibilityRole="button" accessibilityLabel="View outfit photo and detected pieces">
              <Image source={{ uri: flow.photoUri }} style={{ width, height: heroHeight, backgroundColor: colors.surfaceSubtle }} contentFit="contain" />
            </Pressable>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle} accessibilityLiveRegion="polite">{status}</Text>
              <TextLink label="View photo" tone="muted" disabled={saving} onPress={() => setSurface({ kind: 'resolve', queue: [], initialPhoto: true })} />
            </View>
            {ordered.length === 0 ? <Text style={styles.failedCopy}>We couldn’t make out any clothes. Add pieces from your closet, or retake the photo.</Text> : null}
          </View>}
          renderItem={({ item: d }) => <PairingRow detection={d} resolution={flow.resolutions[d.id]} itemsById={itemsById} sharedWith={sharedMatch(flow, d.id).map((id) => numbers[id])} wardrobeReady={!!isSuccess} disabled={saving}
            onOpen={() => openPiece(d.id)} onRestore={() => dispatchWear({ type: 'restore', detectionId: d.id })} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={<View>
            {flow.additionalItemIds.map((id) => {
              const item = itemsById.get(id);
              const missing = isSuccess && !item;
              const duplicated = matchedItemIds(flow).includes(id);
              return <View style={styles.additionalRow} key={id}>
                <PieceImage item={item} />
                <View style={styles.additionalCopy}><Text style={styles.itemName} numberOfLines={2}>{item?.name ?? (missing ? 'Piece no longer in your closet' : 'Loading piece…')}</Text>
                  <Text style={[styles.meta, missing && styles.error]}>{missing ? 'Remove this piece to continue' : [item?.brand, 'Added manually'].filter(Boolean).join(' · ')}</Text>
                  {duplicated ? <Text style={styles.meta}>Also matched in your photo · logged once</Text> : null}
                </View>
                <TextLink label="Remove" disabled={saving} onPress={() => dispatchWear({ type: 'removeAdditionalItem', itemId: id })} accessibilityLabel={`Remove ${item?.name ?? 'missing piece'}`} />
              </View>;
            })}
            <View style={styles.addRow}><TextLink label="+ Add missing piece" disabled={saving || !isSuccess} onPress={() => setSurface({ kind: 'add' })} /></View>
          </View>}
          contentContainerStyle={{ paddingBottom: spacing.lg }} />
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {flow.saveError ? <Text style={styles.error} accessibilityLiveRegion="assertive">{flow.saveError}</Text> : null}
          {missingAdditional.length ? <Text style={styles.error}>Remove unavailable pieces before logging.</Text> : null}
          {!isSuccess ? <View style={styles.loadingRow}><Text style={styles.meta}>{isError ? 'Couldn’t load your closet' : 'Loading your closet…'}</Text>{isError ? <TextLink label="Try again" onPress={() => { void refetch(); }} /> : null}</View> : null}
          <Pressable style={styles.dateRow} disabled={saving} onPress={() => setSurface({ kind: 'date' })} accessibilityRole="button" accessibilityLabel={`${dateLabel}. Change date`}>
            <Ionicons name="calendar-outline" size={18} color={colors.mutedForeground} /><Text style={styles.dateText}>{dateLabel}</Text><Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
          </Pressable>
          <PrimaryButton label={buttonLabel} disabled={saving || !isSuccess || (!queue.length && (!canLog(flow) || missingAdditional.length > 0))}
            onPress={() => { if (queue.length) setSurface({ kind: 'resolve', queue }); else void save(); }} />
        </View>
      </View>
      <View style={styles.sheetHost} pointerEvents="box-none">
        {surface?.kind === 'resolve' ? <WearResolveSheet queue={surface.queue} initialPhoto={surface.initialPhoto} flow={flow} items={items} reduceMotion={reduceMotion} onClose={closeSurface} />
          : surface?.kind === 'add' ? <AdditionalPieceSheet items={items} selectedIds={selectedItemIds(flow)} reduceMotion={reduceMotion} onClose={closeSurface} />
          : surface?.kind === 'date' ? <WornDateSheet date={flow.date} reduceMotion={reduceMotion} onSelect={(date) => dispatchWear({ type: 'setDate', date })} onClose={closeSurface} /> : null}
      </View>
    </GestureHandlerRootView>
  );
}

function AdditionalPieceSheet({ items, selectedIds, reduceMotion, onClose }: {
  items: Item[]; selectedIds: number[]; reduceMotion: boolean; onClose: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  return <WorkspaceSheet title="Add missing piece" detent="large" reduceMotion={reduceMotion} dismissed={dismissed} onClose={onClose}>
    <ClosetPicker items={items} unavailableIds={selectedIds} onPick={(itemId) => { dispatchWear({ type: 'addAdditionalItem', itemId }); setDismissed(true); }} />
  </WorkspaceSheet>;
}

function Logged({ flow, topInset, onDone }: {
  flow: Extract<ReturnType<typeof useWearLogStore.getState>['flow'], { status: 'logged' }>;
  topInset: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(() => { discardWearFlow(); onDone(); }, 1400);
    return () => clearTimeout(t);
  }, [onDone]);
  const already = flow.alreadyLoggedItemIds.length;
  return (
    <View style={[styles.root, styles.logged, { paddingTop: topInset }]} accessibilityLiveRegion="polite">
      <Ionicons name="checkmark" size={28} color={colors.foreground} />
      <Text style={styles.loggedTitle}>Logged · {pieces(flow.itemIds.length)}</Text>
      <Text style={styles.failedCopy}>
        {already
          ? `${pieces(already)} ${already === 1 ? 'was' : 'were'} already logged that day and counted once.`
          : dateChoice(flow.date) === 'today' ? 'Added to today.' : `Added to ${shortDate(flow.date)}.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  sheetHost: { position: 'absolute', width: 0, height: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: { ...typography.text.editorialSection, color: colors.foreground, flex: 1 },
  headerRight: { minWidth: 44, alignItems: 'flex-end' },
  summary: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  summaryTitle: { ...typography.text.editorialSection, color: colors.foreground, flexGrow: 1 },
  additionalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: stroke.hairline, borderTopColor: colors.hairline },
  additionalCopy: { flex: 1, gap: 4 },
  itemName: { ...typography.text.bodySmall, color: colors.foreground },
  meta: { ...typography.text.meta, color: colors.mutedForeground },
  addRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  separator: { height: stroke.hairline, backgroundColor: colors.hairline, marginLeft: spacing.lg },
  bar: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: stroke.hairline,
    borderTopColor: colors.hairline,
    backgroundColor: colors.background,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  dateText: { ...typography.text.meta, color: colors.foreground, flex: 1 },
  error: { ...typography.text.meta, color: colors.error },
  failed: { flex: 1, alignItems: 'center', gap: spacing.sm },
  failedTitle: { ...typography.text.editorialSection, color: colors.foreground, textAlign: 'center', marginTop: spacing.lg },
  failedCopy: { ...typography.text.bodySmall, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: spacing.xl },
  center: { alignItems: 'center' },
  bottom: { marginTop: 'auto', alignSelf: 'stretch' },
  slowText: { ...typography.text.meta, color: colors.mutedForeground },
  logged: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loggedTitle: { ...typography.text.editorialSection, color: colors.foreground },
});
