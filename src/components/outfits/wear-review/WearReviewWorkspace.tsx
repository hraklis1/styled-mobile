import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';

import { DetectionState } from '../../wardrobe/scan-review/LoadingStates';
import { PrimaryButton } from '../../wardrobe/scan-review/ActionBar';
import { TextLink, TextSegment } from '../../wardrobe/scan-review/atoms';
import { cropFeedback } from '../../wardrobe/scan-review/feedback';
import { useReviewReducedMotion } from '../../../hooks/useReviewReducedMotion';
import { applySavedItems, useItems } from '../../../hooks/useItems';
import { OUTFIT_LOGS_QUERY_KEY } from '../../../hooks/useOutfitLogs';
import { track } from '../../../lib/analytics';
import { colors, ingestion, spacing, stroke, typography } from '../../../theme';
import type { Item } from '../../../types/item';
import { saveWearLog } from '../../../features/wear-log/api';
import { canLog, needsCheck, orderedDetections, reviewCounts, sharedMatch } from '../../../features/wear-log/reducer';
import { discardWearFlow, retryWearScan } from '../../../features/wear-log/runner';
import { dispatchWear, useWearLogStore } from '../../../features/wear-log/store';
import type { ReviewFlow } from '../../../features/wear-log/types';
import { ClosetMatchSheet } from './ClosetMatchSheet';
import { NewPieceSheet } from './NewPieceSheet';
import { PairingRow, type RowActions } from './PairingRow';
import { PhotoHero } from './PhotoHero';

type Filter = 'all' | 'check';

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
      heroHeight={heroHeight}
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
      <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
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
  const { data: items = [] } = useItems();
  const itemsById = useMemo(() => new Map<number, Item>(items.map((i) => [i.id, i])), [items]);
  const [filter, setFilter] = useState<Filter>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ detectionId: string; name: string } | null>(null);
  const listRef = useRef<FlatList>(null);

  const ordered = useMemo(() => orderedDetections(flow.scan), [flow.scan]);
  const numbers = useMemo(() => Object.fromEntries(ordered.map((d, i) => [d.id, i + 1])), [ordered]);
  const byId = useMemo(() => new Map(ordered.map((d) => [d.id, d])), [ordered]);
  const counts = reviewCounts(flow);
  const visible = filter === 'check' ? ordered.filter((d) => needsCheck(flow.resolutions[d.id])) : ordered;
  const dimmed = useMemo(
    () => new Set(ordered.filter((d) => flow.resolutions[d.id]?.kind === 'dismissed').map((d) => d.id)),
    [flow.resolutions, ordered],
  );

  // Nothing left to check: fall back to the whole list rather than an empty one.
  useEffect(() => { if (filter === 'check' && counts.toCheck === 0) setFilter('all'); }, [counts.toCheck, filter]);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), ingestion.undoMs);
    return () => clearTimeout(t);
  }, [undo]);

  const focus = useCallback((id: string) => {
    setActiveId(id);
    const index = visible.findIndex((d) => d.id === id);
    if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.3, animated: !reduceMotion });
  }, [reduceMotion, visible]);

  const actions = useMemo<RowActions>(() => ({
    confirm: (detectionId, itemId) => dispatchWear({ type: 'confirm', detectionId, itemId }),
    findInCloset: (detectionId) => dispatchWear({ type: 'openResolve', detectionId, mode: 'library' }),
    addAsNew: (detectionId) => dispatchWear({ type: 'markNew', detectionId }),
    editNew: (detectionId) => dispatchWear({ type: 'openResolve', detectionId, mode: 'new' }),
    clear: (detectionId) => dispatchWear({ type: 'clear', detectionId }),
    dismiss: (detectionId) => {
      dispatchWear({ type: 'dismiss', detectionId });
      setUndo({ detectionId, name: byId.get(detectionId)?.attributes.name ?? 'Piece' });
    },
    restore: (detectionId) => { dispatchWear({ type: 'restore', detectionId }); setUndo(null); },
    focus: (detectionId) => setActiveId(detectionId),
  }), [byId]);

  const save = useCallback(async () => {
    const current = useWearLogStore.getState().flow;
    if (current.status !== 'reviewing' || !canLog(current)) return;
    dispatchWear({ type: 'saveStarted' });
    try {
      const saved = await saveWearLog(current);
      applySavedItems(qc, saved.createdItems);
      void qc.invalidateQueries({ queryKey: OUTFIT_LOGS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ['items'] });
      cropFeedback(true);
      track('outfit_scan_review_completed', {
        matched_count: saved.itemIds.length - saved.createdItems.length,
        new_count: saved.createdItems.length,
        skipped_count: Object.values(current.resolutions).filter((r) => r.kind === 'dismissed').length,
        already_logged_count: saved.alreadyLoggedItemIds.length,
      });
      dispatchWear({ type: 'saved', logId: saved.logId, itemIds: saved.itemIds, alreadyLoggedItemIds: saved.alreadyLoggedItemIds });
    } catch (err) {
      cropFeedback(false);
      const offline = !(err as { response?: unknown })?.response;
      dispatchWear({
        type: 'saveFailed',
        message: offline ? 'You’re offline. Your review is saved — log it when you’re back.' : 'Couldn’t log this outfit. Try again.',
      });
    }
  }, [qc]);

  const scanBrands = useMemo(() => [...new Set(
    Object.values(flow.resolutions).flatMap((r) => (r.kind === 'new' && r.draft.brand ? [r.draft.brand] : [])),
  )], [flow.resolutions]);
  const resolving = flow.resolving ? byId.get(flow.resolving.detectionId) : undefined;
  const resolvingCurrent = flow.resolving ? flow.resolutions[flow.resolving.detectionId] : undefined;
  const choice = dateChoice(flow.date);
  const saving = flow.status === 'saving';

  const buttonLabel = counts.toCheck > 0
    ? `Check ${counts.toCheck} more ${counts.toCheck === 1 ? 'piece' : 'pieces'}`
    : counts.logging === 0
      ? 'Nothing to log'
      : saving ? 'Logging…' : `Log outfit · ${pieces(counts.logging)}`;

  return (
    <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top }]}>
      <Header
        title={flow.scan.detections.length ? `We found ${pieces(flow.scan.detections.length)}` : 'No pieces found'}
        onClose={onClose}
        right={<TextLink label="Retake" tone="muted" onPress={() => { discardWearFlow(); onClose(); }} />}
      />
      {/* Content in its own flex box: the sheet hosts below are siblings of
          it, as in the Add Clothing workspace, so presenting one never takes
          layout from the list. */}
      <View style={styles.body}>
      <FlatList
        ref={listRef}
        style={styles.body}
        data={visible}
        keyExtractor={(d) => d.id}
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={
          <View>
            <PhotoHero
              uri={flow.photoUri}
              height={heroHeight}
              width={width}
              detections={ordered}
              numbers={numbers}
              activeId={activeId}
              dimmedIds={dimmed}
              onPressBox={focus}
            />
            <View style={styles.filterRow}>
              <TextSegment
                options={[
                  { value: 'all', label: `All ${counts.total}` },
                  { value: 'check', label: counts.toCheck ? `Check ${counts.toCheck}` : 'All checked' },
                ]}
                value={filter}
                onChange={setFilter}
                disabled={counts.toCheck === 0}
                accessibilityLabel="Which pieces to show"
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          flow.scan.detections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.failedTitle}>We couldn’t make out any clothes</Text>
              <Text style={styles.failedCopy}>A full-length photo in good light works best.</Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item: d }) => (
          <PairingRow
            detection={d}
            number={numbers[d.id]}
            resolution={flow.resolutions[d.id]}
            occluder={d.occludedBy ? byId.get(d.occludedBy) : undefined}
            itemsById={itemsById}
            sharedWith={sharedMatch(flow, d.id).map((id) => numbers[id])}
            active={d.id === activeId}
            actions={actions}
          />
        )}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      />

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {undo ? (
          <View style={styles.toast} accessibilityLiveRegion="polite">
            <Text style={styles.toastText} numberOfLines={1}>{undo.name} won’t be logged</Text>
            <TextLink label="Undo" onPress={() => actions.restore(undo.detectionId)} />
          </View>
        ) : null}
        {flow.saveError ? <Text style={styles.error} accessibilityLiveRegion="assertive">{flow.saveError}</Text> : null}
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>Worn</Text>
          <TextSegment<DateChoice>
            options={[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              ...(choice === 'other' ? [{ value: 'other' as const, label: shortDate(flow.date) }] : []),
            ]}
            value={choice}
            onChange={(v) => dispatchWear({ type: 'setDate', date: v === 'today' ? isoDay(0) : isoDay(-1) })}
            disabled={saving}
            accessibilityLabel="Day worn"
          />
        </View>
        <PrimaryButton
          label={buttonLabel}
          // Pieces still to check don't disable the button: it jumps to them.
          disabled={saving || (counts.toCheck === 0 && !canLog(flow))}
          onPress={() => {
            if (counts.toCheck > 0) {
              setFilter('check');
              return;
            }
            void save();
          }}
        />
      </View>
      </View>

      {/* The native sheet host is zero-size and out of flow: in the logger's
          page sheet a sibling host otherwise takes the list's height. */}
      <View style={styles.sheetHost} pointerEvents="box-none">
      {resolving && flow.resolving?.mode === 'library' ? (
        <ClosetMatchSheet
          key={resolving.id}
          detection={resolving}
          items={items}
          currentItemId={resolvingCurrent?.kind === 'matched' ? resolvingCurrent.itemId : null}
          reduceMotion={reduceMotion}
          onPick={(itemId) => dispatchWear({ type: 'confirm', detectionId: resolving.id, itemId })}
          onAddNew={() => dispatchWear({ type: 'markNew', detectionId: resolving.id })}
          onClose={() => dispatchWear({ type: 'closeResolve' })}
        />
      ) : resolving && flow.resolving?.mode === 'new' && resolvingCurrent?.kind === 'new' ? (
        <NewPieceSheet
          key={resolving.id}
          detection={resolving}
          draft={resolvingCurrent.draft}
          scanBrands={scanBrands}
          reduceMotion={reduceMotion}
          onChange={(patch) => dispatchWear({ type: 'editDraft', detectionId: resolving.id, patch })}
          onClose={() => dispatchWear({ type: 'closeResolve' })}
        />
      ) : null}
      </View>
    </GestureHandlerRootView>
  );
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
  filterRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  separator: { height: stroke.hairline, backgroundColor: colors.hairline, marginLeft: spacing.lg },
  bar: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: stroke.hairline,
    borderTopColor: colors.hairline,
    backgroundColor: colors.background,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  error: { ...typography.text.meta, color: colors.error },
  // Sits in the footer, over the date line, so it never covers a row.
  toast: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toastText: { ...typography.text.bodySmall, color: colors.foreground, flex: 1 },
  failed: { flex: 1, alignItems: 'center', gap: spacing.sm },
  failedTitle: { ...typography.text.editorialSection, color: colors.foreground, textAlign: 'center', marginTop: spacing.lg },
  failedCopy: { ...typography.text.bodySmall, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: spacing.xl },
  center: { alignItems: 'center' },
  bottom: { marginTop: 'auto', alignSelf: 'stretch' },
  slowText: { ...typography.text.meta, color: colors.mutedForeground },
  emptyState: { paddingVertical: spacing.xxl, gap: spacing.sm },
  logged: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loggedTitle: { ...typography.text.editorialSection, color: colors.foreground },
});
