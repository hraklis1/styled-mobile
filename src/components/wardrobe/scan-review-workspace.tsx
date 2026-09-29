import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CropAdjustEditor, type Bbox } from './CropAdjustModal';
import {
  loupeHeroHeight,
  nextFlaggedPieceId,
  pieceReviewState,
  resolvedActivePieceId,
  reviewSummary,
  sheetGuidance,
  usesContactSheet,
  type PieceReviewState,
} from '../../lib/scan-review';
import { colors, spacing, stroke, typography } from '../../theme';
import { ActionBar, type ActionBarMode } from './scan-review/ActionBar';
import { ContactSheet, PieceLine, type SheetFilter } from './scan-review/ContactSheet';
import { DetectionState, ExtractionState } from './scan-review/LoadingStates';
import { Loupe } from './scan-review/Loupe';
import { ConfirmationPanel, UndoToast } from './scan-review/overlays';
import { BrandPicker, CategoryPicker, MaterialPicker, SeasonPicker, SheetButton } from './scan-review/pickers';
import { TextLink } from './scan-review/atoms';
import { WorkspaceSheet } from './scan-review/WorkspaceSheet';
import {
  isReviewStage,
  pieceCountLabel,
  type ExtractTrigger,
  type PiecePatch,
  type ScanReviewPiece,
  type ScanReviewStage,
  type SheetRequest,
} from './scan-review/types';

export type { ScanReviewPiece, ScanReviewStage } from './scan-review/types';

type Props = {
  visible: boolean;
  stage: ScanReviewStage;
  // Only meaningful for `stage === 'scanning'` (the Detect hero has no
  // per-piece photos yet): the single scan's source photo, or for a batch the
  // photo currently being scanned. Optional so flows that never hit that
  // stage don't need to thread it through.
  previewImage?: string | null;
  // Batch scans walk several photos through the Detect stage, so the hero
  // needs a "photo 2 of 5" of its own. Single-photo flows leave this at zero
  // and the Detect stage reads exactly as it did before.
  scanProgress?: { current: number; total: number };
  pieces: ScanReviewPiece[];
  brandSuggestions: string[];
  extractionProgress: { current: number; total: number };
  failure?: { message: string; retryLabel?: string; onRetry: () => void } | null;
  onUpdate: (id: string, patch: Partial<ScanReviewPiece>) => void;
  onToggleCutout: (id: string) => void;
  onApplyCrop: (id: string, bbox: Bbox) => void;
  onRemove: (id: string) => void;
  onExtract: (trigger: ExtractTrigger, reviewedCount: number, brandCount: number) => void;
  onSave: () => void;
  onClose: () => void;
  /**
   * Batch import runs in the background, so its workspace can be put away at
   * any stage without stopping anything. When set, a minimise control hides
   * the workspace (and the system back gesture does the same), and close
   * becomes "discard", available at every stage except mid-save.
   */
  onMinimize?: () => void;
};

type View_ = 'sheet' | 'loupe';
type PendingRemoval = { ids: string[]; message: string };
type Deferred = { action: 'save' | 'extract'; waitFor: string[] };

const UNDO_MS = 4000;

/**
 * Closet scan review, in two levels:
 *
 *   Contact sheet — every piece at once. Triage ("12 ready · 4 to check"),
 *                   bulk edits, removal. Skipped for three pieces or fewer.
 *   Loupe         — one piece, large, with its spec sheet. Swipe the plate or
 *                   drag the tick rail to travel.
 *
 * Nothing forces a pass over every piece: the AI marks what it was unsure of,
 * "Add all" is always one tap, and the flagged walk visits only the marked.
 */
export function ScanReviewWorkspace({
  visible,
  stage,
  previewImage = null,
  scanProgress = { current: 0, total: 0 },
  pieces,
  brandSuggestions,
  extractionProgress,
  failure,
  onUpdate,
  onToggleCutout,
  onApplyCrop,
  onRemove,
  onExtract,
  onSave,
  onClose,
  onMinimize,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const review = isReviewStage(stage);
  const busy = stage === 'scanning' || stage === 'extracting' || stage === 'saving';
  const closeDisabled = onMinimize ? stage === 'saving' : busy;

  const [view, setView] = useState<View_>('sheet');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SheetFilter>('all');
  const [confirmedIds, setConfirmedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [openedIds, setOpenedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [selection, setSelection] = useState<ReadonlySet<string> | null>(null);
  const [walk, setWalk] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const [sheetDismissed, setSheetDismissed] = useState(false);
  const [seasonDraft, setSeasonDraft] = useState<string[]>([]);
  const [cropId, setCropId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [deferred, setDeferred] = useState<Deferred | null>(null);
  const [sheetLatched, setSheetLatched] = useState(false);
  const [actionBarHeight, setActionBarHeight] = useState(0);

  // ── Derived ────────────────────────────────────────────────────────────────

  const visiblePieces = useMemo(
    () => (pendingRemoval ? pieces.filter((piece) => !pendingRemoval.ids.includes(piece.id)) : pieces),
    [pendingRemoval, pieces],
  );
  const states = useMemo(() => {
    const map: Record<string, PieceReviewState> = {};
    if (review) for (const piece of visiblePieces) map[piece.id] = pieceReviewState(piece, confirmedIds);
    return map;
  }, [confirmedIds, review, visiblePieces]);
  const summary = useMemo(() => reviewSummary(Object.values(states)), [states]);
  const checkCount = summary.check;

  // Once the overview has been shown it stays, even if removals bring the
  // scan down to three — swapping the whole screen out mid-task would be the
  // more jarring thing.
  const sheetEnabled = sheetLatched || usesContactSheet(visiblePieces.length);
  const effectiveView: View_ = sheetEnabled ? view : 'loupe';
  const sheetPieces = filter === 'check' && review
    ? visiblePieces.filter((piece) => states[piece.id] === 'check')
    : visiblePieces;
  const loupePieces = useMemo(
    () => (walk ? visiblePieces.filter((piece) => walk.includes(piece.id)) : visiblePieces),
    [visiblePieces, walk],
  );
  const loupeIds = useMemo(() => loupePieces.map((piece) => piece.id), [loupePieces]);
  const activeResolvedId = resolvedActivePieceId(loupeIds, activeId);
  const activeIndex = activeResolvedId ? loupeIds.indexOf(activeResolvedId) : -1;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (usesContactSheet(visiblePieces.length) && !sheetLatched) setSheetLatched(true);
  }, [sheetLatched, visiblePieces.length]);

  // A fresh open starts from a clean slate.
  useEffect(() => {
    if (visible) return;
    setView('sheet');
    setActiveId(null);
    setFilter('all');
    setConfirmedIds(new Set());
    setOpenedIds(new Set());
    setSelection(null);
    setWalk(null);
    setSheet(null);
    setCropId(null);
    setConfirmClose(false);
    setSheetLatched(false);
  }, [visible]);

  // Extraction replaces the pieces wholesale: come back to the overview.
  const previousStage = useRef(stage);
  useEffect(() => {
    const before = previousStage.current;
    previousStage.current = stage;
    if (stage === before) return;
    if (stage === 'review' && before !== 'saving') {
      setView('sheet');
      setWalk(null);
      setFilter('all');
    }
    if (busy) {
      setSelection(null);
      setSheet(null);
      setCropId(null);
    }
  }, [busy, stage]);

  useEffect(() => {
    if (filter === 'check' && checkCount === 0) setFilter('all');
  }, [checkCount, filter]);

  useEffect(() => {
    if (effectiveView !== 'loupe' || !activeResolvedId || openedIds.has(activeResolvedId)) return;
    setOpenedIds((current) => new Set(current).add(activeResolvedId));
  }, [activeResolvedId, effectiveView, openedIds]);

  // A walk whose pieces were all removed has nothing left to show.
  useEffect(() => {
    if (effectiveView === 'loupe' && loupePieces.length === 0 && sheetEnabled && visiblePieces.length > 0) {
      setWalk(null);
      setView('sheet');
    }
  }, [effectiveView, loupePieces.length, sheetEnabled, visiblePieces.length]);

  // ── Removal with undo ─────────────────────────────────────────────────────

  const commitRemoval = useCallback((pending: PendingRemoval | null) => {
    if (!pending) return;
    for (const id of pending.ids) onRemove(id);
    setPendingRemoval((current) => (current === pending ? null : current));
  }, [onRemove]);

  useEffect(() => {
    if (!pendingRemoval) return;
    const timer = setTimeout(() => commitRemoval(pendingRemoval), UNDO_MS);
    return () => clearTimeout(timer);
  }, [commitRemoval, pendingRemoval]);

  // Save and extract read the host's piece list, so a removal still waiting
  // on its undo has to land first — and the host has to re-render with it —
  // before either may run.
  const runAfterRemovals = useCallback((action: Deferred['action']) => {
    if (!pendingRemoval) {
      if (action === 'save') onSave();
      else setDeferred({ action, waitFor: [] });
      return;
    }
    const waitFor = pendingRemoval.ids;
    commitRemoval(pendingRemoval);
    setDeferred({ action, waitFor });
  }, [commitRemoval, onSave, pendingRemoval]);

  const removeWithUndo = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pendingRemoval) commitRemoval(pendingRemoval);
    const remaining = visiblePieces.filter((piece) => !ids.includes(piece.id));

    if (activeResolvedId && ids.includes(activeResolvedId)) {
      const index = loupeIds.indexOf(activeResolvedId);
      const after = loupeIds.slice(index + 1).find((id) => !ids.includes(id));
      const before = loupeIds.slice(0, index).reverse().find((id) => !ids.includes(id));
      setActiveId(after ?? before ?? null);
    }
    setSelection(null);

    // Emptying the scan has nothing to show under an undo toast; let the
    // host close it straight away.
    if (remaining.length === 0) {
      for (const id of ids) onRemove(id);
      return;
    }
    const named = ids.length === 1 ? pieces.find((piece) => piece.id === ids[0]) : null;
    setPendingRemoval({
      ids,
      message: named ? `Removed ${named.name || 'piece'}` : `Removed ${pieceCountLabel(ids.length)}`,
    });
  }, [activeResolvedId, commitRemoval, loupeIds, onRemove, pendingRemoval, pieces, visiblePieces]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const update = useCallback((id: string, patch: PiecePatch) => {
    onUpdate(id, patch);
    // Touching a piece is the strongest "I've looked at this" there is.
    if (review) setConfirmedIds((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, [onUpdate, review]);

  const openPiece = useCallback((id: string) => {
    setWalk(filter === 'check' && review ? sheetPieces.map((piece) => piece.id) : null);
    setActiveId(id);
    setView('loupe');
  }, [filter, review, sheetPieces]);

  const startFlaggedWalk = useCallback(() => {
    const flagged = visiblePieces.filter((piece) => states[piece.id] === 'check').map((piece) => piece.id);
    if (flagged.length === 0) return;
    setWalk(flagged);
    setActiveId(flagged[0]);
    setView('loupe');
  }, [states, visiblePieces]);

  const finishWalk = useCallback(() => {
    setWalk(null);
    setFilter('all');
    if (sheetEnabled) setView('sheet');
  }, [sheetEnabled]);

  // The walk visits only what was flagged. Browsing outside it goes to the
  // next flagged piece while any remain, then simply onward, piece by piece.
  const nextAfterConfirm = useMemo(() => {
    if (!activeResolvedId) return null;
    const flagged = nextFlaggedPieceId(loupeIds, { ...states, [activeResolvedId]: 'confirmed' }, activeResolvedId);
    if (flagged || walk) return flagged;
    return loupeIds[loupeIds.indexOf(activeResolvedId) + 1] ?? null;
  }, [activeResolvedId, loupeIds, states, walk]);

  const confirmActive = useCallback(() => {
    if (!activeResolvedId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmedIds((current) => new Set(current).add(activeResolvedId));
    if (nextAfterConfirm) setActiveId(nextAfterConfirm);
    else finishWalk();
  }, [activeResolvedId, finishWalk, nextAfterConfirm]);

  const extract = useCallback(() => {
    runAfterRemovals('extract');
  }, [runAfterRemovals]);

  useEffect(() => {
    if (!deferred) return;
    if (pieces.some((piece) => deferred.waitFor.includes(piece.id))) return;
    setDeferred(null);
    if (deferred.action === 'save') {
      onSave();
      return;
    }
    const brandCount = pieces.filter((piece) => piece.brand.trim().length > 0).length;
    const opened = pieces.filter((piece) => openedIds.has(piece.id)).length;
    onExtract(opened >= pieces.length ? 'completed_review' : 'extract_now', opened, brandCount);
  }, [deferred, onExtract, onSave, openedIds, pieces]);

  const openSheet = useCallback((request: SheetRequest) => {
    setSheetDismissed(false);
    if (request.kind === 'season') {
      const targets = pieces.filter((piece) => request.target.includes(piece.id));
      const shared = targets.length > 0
        ? targets[0].seasons.filter((season) => targets.every((piece) => piece.seasons.includes(season)))
        : [];
      setSeasonDraft(shared);
    }
    setSheet(request);
  }, [pieces]);

  const dismissSheet = useCallback(() => setSheetDismissed(true), []);

  const endSelection = useCallback(() => setSelection(null), []);

  const requestSystemClose = useCallback(() => {
    if (sheet) return dismissSheet();
    if (confirmClose) return setConfirmClose(false);
    if (selection) return setSelection(null);
    if (effectiveView === 'loupe' && sheetEnabled) {
      setWalk(null);
      return setView('sheet');
    }
    if (onMinimize) {
      commitRemoval(pendingRemoval);
      return onMinimize();
    }
    if (!closeDisabled) setConfirmClose(true);
  }, [closeDisabled, commitRemoval, confirmClose, dismissSheet, effectiveView, onMinimize, pendingRemoval, selection, sheet, sheetEnabled]);

  // ── Crop editor (full screen: precise manipulation earns the takeover) ─────

  const cropPiece = cropId ? pieces.find((piece) => piece.id === cropId) ?? null : null;
  if (cropPiece?.cropSource && cropPiece.cropBbox) {
    return (
      <Modal visible={visible} presentationStyle="fullScreen" animationType="none" onRequestClose={() => setCropId(null)}>
        <GestureHandlerRootView style={styles.root}>
          <CropAdjustEditor
            sourceImage={cropPiece.cropSource}
            initialBbox={cropPiece.cropBbox}
            itemName={cropPiece.name}
            onApply={(bbox) => {
              onApplyCrop(cropPiece.id, bbox);
              setCropId(null);
            }}
            onCancel={() => setCropId(null)}
          />
        </GestureHandlerRootView>
      </Modal>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const heroHeight = loupeHeroHeight(height);
  const contentBottom = spacing.xxl + (pendingRemoval ? 56 : 0);
  const selecting = selection !== null && !busy;

  const actionMode: ActionBarMode = stage === 'scanning'
    ? { kind: 'busy', label: 'Looking at your photo…' }
    : stage === 'extracting'
      ? { kind: 'busy', label: `Extracting details for ${pieceCountLabel(visiblePieces.length)}…` }
      : stage === 'saving'
        ? { kind: 'busy', label: 'Adding to closet…' }
        : selecting
          ? {
            kind: 'selecting',
            count: selection.size,
            review,
            onBrand: () => openSheet({ kind: 'brand', target: [...selection] }),
            onSeason: () => openSheet({ kind: 'season', target: [...selection] }),
            onConfirm: () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setConfirmedIds((current) => new Set([...current, ...selection]));
              setSelection(null);
            },
            onRemove: () => removeWithUndo([...selection]),
          }
          : stage === 'pre-extract'
            ? { kind: 'extract', count: visiblePieces.length, onExtract: extract }
            : effectiveView === 'loupe' && sheetEnabled
              ? {
                kind: 'confirm',
                last: nextAfterConfirm === null,
                onConfirm: confirmActive,
                onSkip: activeIndex >= 0 && activeIndex < loupeIds.length - 1
                  ? () => setActiveId(loupeIds[activeIndex + 1])
                  : null,
              }
              : {
                kind: 'save',
                count: visiblePieces.length,
                flagged: sheetEnabled ? checkCount : 0,
                onSave: () => runAfterRemovals('save'),
                onReviewFlagged: startFlaggedWalk,
              };

  const sheetTargets = sheet ? pieces.filter((piece) => sheet.target.includes(piece.id)) : [];
  const singleTarget = sheetTargets.length === 1 ? sheetTargets[0] : null;
  const scanBrands = [...new Set(pieces.map((piece) => piece.brand.trim()).filter(Boolean))];

  return (
    <Modal
      visible={visible}
      presentationStyle="fullScreen"
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={requestSystemClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <WorkspaceHeader
            stage={stage}
            view={effectiveView}
            canGoBack={effectiveView === 'loupe' && sheetEnabled && !busy}
            position={effectiveView === 'loupe' && activeIndex >= 0 ? { index: activeIndex, count: loupeIds.length, walk: Boolean(walk) } : null}
            batch={Boolean(onMinimize)}
            closeDisabled={closeDisabled}
            topInset={insets.top}
            onBack={() => { setWalk(null); setView('sheet'); }}
            onClose={() => setConfirmClose(true)}
            onMinimize={onMinimize ? () => { commitRemoval(pendingRemoval); onMinimize(); } : undefined}
          />

          {failure ? (
            <View style={styles.failureBanner} accessibilityRole="alert">
              <Ionicons name="alert-circle-outline" size={18} color={colors.action} />
              <Text style={styles.failureText}>{failure.message}</Text>
              <TextLink label={failure.retryLabel ?? 'Retry'} onPress={failure.onRetry} disabled={busy} />
            </View>
          ) : null}

          {stage === 'scanning' ? (
            <DetectionState previewImage={previewImage} progress={scanProgress} heroHeight={heroHeight} reduceMotion={reduceMotion} />
          ) : stage === 'extracting' ? (
            <ExtractionState piece={visiblePieces[0] ?? null} progress={extractionProgress} heroHeight={heroHeight} reduceMotion={reduceMotion} />
          ) : effectiveView === 'sheet' ? (
            <ContactSheet
              pieces={sheetPieces}
              totalCount={visiblePieces.length}
              stage={stage}
              states={states}
              guidance={sheetGuidance(review ? 'review' : 'pre-extract', summary)}
              checkCount={checkCount}
              filter={filter}
              selection={selecting ? selection : null}
              disabled={stage === 'saving'}
              reduceMotion={reduceMotion}
              bottomPadding={contentBottom}
              onFilterChange={setFilter}
              onOpen={openPiece}
              onStartSelect={(id) => setSelection(new Set(id ? [id] : []))}
              onToggleSelect={(id) => setSelection((current) => {
                const next = new Set(current ?? []);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })}
              onSelectAll={() => setSelection(new Set(sheetPieces.map((piece) => piece.id)))}
              onEndSelect={endSelection}
            />
          ) : activeResolvedId ? (
            <Loupe
              key={walk ? `walk:${walk.join(',')}` : 'all'}
              pieces={loupePieces}
              stage={stage}
              states={states}
              activeId={activeResolvedId}
              disabled={stage === 'saving'}
              reduceMotion={reduceMotion}
              bottomPadding={contentBottom}
              onActiveChange={setActiveId}
              onUpdate={update}
              onOpenSheet={(kind, id) => openSheet({ kind, target: [id] })}
              onCrop={setCropId}
              onToggleCutout={onToggleCutout}
              onRemove={(id) => removeWithUndo([id])}
            />
          ) : <View style={styles.root} />}

          <View onLayout={(event) => setActionBarHeight(event.nativeEvent.layout.height)}>
            <ActionBar mode={actionMode} bottomInset={insets.bottom} />
          </View>
        </KeyboardAvoidingView>

        {pendingRemoval ? (
          <UndoToast
            key={pendingRemoval.ids.join(',')}
            message={pendingRemoval.message}
            bottom={actionBarHeight + spacing.sm}
            reduceMotion={reduceMotion}
            onUndo={() => setPendingRemoval(null)}
          />
        ) : null}

        {sheet ? (
          <WorkspaceSheet
            title={sheet.kind === 'brand' ? 'Brand' : sheet.kind === 'material' ? 'Material' : sheet.kind === 'category' ? 'Category' : 'Season'}
            subtitle={singleTarget ? <PieceLine piece={singleTarget} /> : <Text style={styles.sheetSubtitle}>{pieceCountLabel(sheetTargets.length)}</Text>}
            reduceMotion={reduceMotion}
            dismissed={sheetDismissed}
            onClose={() => { setSheet(null); setSheetDismissed(false); }}
            footer={sheet.kind === 'category' ? (
              <SheetButton label="Done" onPress={dismissSheet} />
            ) : sheet.kind === 'season' ? (
              <SheetButton
                label={`Apply to ${pieceCountLabel(sheetTargets.length)}`}
                onPress={() => {
                  for (const piece of sheetTargets) update(piece.id, { seasons: seasonDraft });
                  setSelection(null);
                  dismissSheet();
                }}
              />
            ) : undefined}
          >
            {sheet.kind === 'brand' ? (
              <BrandPicker
                current={singleTarget?.brand ?? (sheetTargets.every((piece) => piece.brand === sheetTargets[0]?.brand) ? sheetTargets[0]?.brand ?? '' : '')}
                suggestions={brandSuggestions}
                scanBrands={scanBrands}
                onSelect={(brand) => {
                  for (const piece of sheetTargets) update(piece.id, { brand });
                  setSelection(null);
                  dismissSheet();
                }}
              />
            ) : sheet.kind === 'material' && singleTarget ? (
              <MaterialPicker
                current={singleTarget.material}
                onSelect={(material) => {
                  update(singleTarget.id, { material });
                  dismissSheet();
                }}
              />
            ) : sheet.kind === 'category' && singleTarget ? (
              <CategoryPicker
                category={singleTarget.category}
                subcategory={singleTarget.subcategory}
                style={singleTarget.style}
                onChange={(patch) => update(singleTarget.id, patch)}
              />
            ) : sheet.kind === 'season' ? (
              <SeasonPicker value={seasonDraft} onChange={setSeasonDraft} />
            ) : null}
          </WorkspaceSheet>
        ) : null}

        {confirmClose ? (
          <ConfirmationPanel
            title="Discard this scan?"
            message={onMinimize
              ? 'Every photo in this batch, its detected pieces and your edits will be removed.'
              : 'Your detected pieces and edits in this review will be removed.'}
            confirmLabel="Discard scan"
            bottomInset={insets.bottom}
            onCancel={() => setConfirmClose(false)}
            onConfirm={() => {
              setConfirmClose(false);
              setPendingRemoval(null);
              onClose();
            }}
          />
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

function WorkspaceHeader({ stage, view, canGoBack, position, batch, closeDisabled, topInset, onBack, onClose, onMinimize }: {
  stage: ScanReviewStage;
  view: View_;
  canGoBack: boolean;
  position: { index: number; count: number; walk: boolean } | null;
  batch: boolean;
  closeDisabled: boolean;
  topInset: number;
  onBack: () => void;
  onClose: () => void;
  onMinimize?: () => void;
}) {
  const title = stage === 'scanning'
    ? 'Scanning'
    : stage === 'extracting'
      ? 'Reading details'
      : batch ? 'Batch import' : 'Closet scan';
  const showPosition = view === 'loupe' && position && position.count > 1 && (stage === 'review' || stage === 'saving' || stage === 'pre-extract');

  return (
    <View style={[styles.header, { paddingTop: topInset + spacing.xs }]}>
      <View style={styles.headerSide}>
        {canGoBack ? (
          <TouchableOpacity style={styles.back} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to all pieces">
            <Ionicons name="chevron-back" size={18} color={colors.foreground} />
            <Text style={styles.backText}>All</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.headerCenter}>
        {showPosition ? (
          <Text style={styles.position} accessibilityLabel={`Piece ${position.index + 1} of ${position.count}${position.walk ? ' to check' : ''}`}>
            {position.index + 1} of {position.count}{position.walk ? ' to check' : ''}
          </Text>
        ) : (
          <Text style={styles.masthead} accessibilityRole="header">{title}</Text>
        )}
      </View>
      <View style={[styles.headerSide, styles.headerSideEnd]}>
        {onMinimize ? (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onMinimize}
            accessibilityRole="button"
            accessibilityLabel="Hide batch import"
            accessibilityHint="The batch keeps running in the background"
          >
            <Ionicons name="chevron-down" size={22} color={colors.foreground} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onClose}
          disabled={closeDisabled}
          accessibilityRole="button"
          accessibilityLabel={onMinimize ? 'Discard batch import' : 'Close closet scan'}
        >
          <Ionicons name="close" size={22} color={closeDisabled ? colors.border : colors.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: colors.hairline,
  },
  headerSide: { width: 96, flexDirection: 'row', alignItems: 'center' },
  headerSideEnd: { justifyContent: 'flex-end' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm },
  backText: { ...typography.text.label, color: colors.foreground },
  masthead: { ...typography.text.masthead, color: colors.mutedForeground },
  position: { ...typography.text.meta, color: colors.foreground, fontVariant: ['tabular-nums'] },
  failureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceSelected,
  },
  failureText: { ...typography.text.bodySmall, color: colors.inkSubtle, flex: 1 },
  sheetSubtitle: { ...typography.text.meta, color: colors.mutedForeground },
});
