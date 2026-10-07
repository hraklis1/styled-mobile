import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReviewReducedMotion } from '../../hooks/useReviewReducedMotion';
import { useBatchExtractionReview } from '../../hooks/useBatchExtractionReview';
import type { InclusionChange } from '../../lib/extraction-review';
import { track } from '../../lib/analytics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CropAdjustEditor, type Bbox } from './CropAdjustModal';
import {
  duplicatePieceIds,
  loupeHeroHeight,
  overlapDuplicates,
  readyBlurb,
  reviewBlurb,
  nextFlaggedPieceId,
  pieceReviewState,
  piecesMissingBrand,
  resolvedActivePieceId,
  reviewSummary,
  sheetGuidance,
  type PieceReviewState,
} from '../../lib/scan-review';
import { colors, ingestion, spacing, stroke, typography } from '../../theme';
import { UndoToast } from '../primitives/UndoToast';
import { ActionBar, type ActionBarMode } from './scan-review/ActionBar';
import { PreExtractGrid, PieceLine, type SheetFilter } from './scan-review/PreExtractGrid';
import { DetectionState, ExtractionState, type FilmFrame } from './scan-review/LoadingStates';
import { ItemInspectionModal } from './scan-review/ItemInspectionModal';
import { PhotoReview } from './scan-review/PhotoReview';
import { PieceEditorSheet } from './scan-review/PieceEditorSheet';
import { PieceDetailSheet } from './scan-review/PieceDetailSheet';
import { usePolishChoice } from './scan-review/usePolishChoice';
import { PolishExample } from './scan-review/PolishExample';
import { PieceTag } from './scan-review/PieceRow';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../../types/item';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { BrandSearchSheet } from './scan-review/BrandSearchSheet';
import { selectionFeedback, bulkFeedback, cropFeedback } from './scan-review/feedback';
import { ConfirmationPanel } from './scan-review/overlays';
import { CategoryPicker, MaterialPicker, SeasonPicker, SheetButton } from './scan-review/pickers';
import { ChipRow, TextLink } from './scan-review/atoms';
import { WorkspaceSheet } from './scan-review/WorkspaceSheet';
import { ArmedDiscardRow, MenuRow } from './scan-review/MenuRows';
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
  /** Batch photos for the detection filmstrip. */
  scanPhotos?: FilmFrame[];
  pieces: ScanReviewPiece[];
  brandSuggestions: string[];
  extractionProgress: { current: number; total: number };
  failure?: { message: string; retryLabel?: string; onRetry: () => void } | null;
  onUpdate: (id: string, patch: Partial<ScanReviewPiece>) => void;
  onToggleCutout: (id: string) => void;
  onApplyCrop: (id: string, bbox: Bbox) => void | Promise<void>;
  onInclusionChange: (changes: InclusionChange[]) => void;
  onKeepBasic: (ids: string[]) => void;
  onExtract: (ids: string[], trigger: ExtractTrigger, reviewedCount: number, brandCount: number) => void;
  /** `polishIds`: the saved pieces that should get a polished cover once they land. */
  onSave: (ids: string[], polishIds: string[]) => void;
  onClose: () => void;
  /**
   * Batch import runs in the background, so its workspace can be put away at
   * any stage without stopping anything. When set, a minimise control hides
   * the workspace (and the system back gesture does the same), and close
   * becomes "discard", available at every stage except mid-save.
   */
  onMinimize?: () => void;
  /**
   * Adds a piece the scan missed, cut from the same photo. Resolves to the
   * new piece's id, or null when the crop couldn't be made. Only a
   * single-photo scan offers this.
   */
  onAddPiece?: (bbox: Bbox, category: string) => Promise<string | null>;
  /** Brands already in the closet, labelled apart from the generic list in brand search. */
  closetBrands?: string[];
};

/** Where "Add one" starts: a centred box the user then fits to the garment. */
const ADD_START_BBOX: Bbox = { x: 25, y: 25, width: 50, height: 50 };

type View_ = 'sheet' | 'loupe';
/**
 * Closet scan review, in two levels:
 *
 *   Contact sheet — every piece at once. Triage ("12 ready · 4 to check"),
 *                   inclusion and bulk metadata edits for every scan size.
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
  scanPhotos,
  pieces,
  brandSuggestions,
  extractionProgress,
  failure,
  onUpdate,
  onToggleCutout,
  onApplyCrop,
  onInclusionChange,
  onKeepBasic,
  onExtract,
  onSave,
  onClose,
  onMinimize,
  onAddPiece,
  closetBrands,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReviewReducedMotion();
  const review = isReviewStage(stage);
  const busy = stage === 'scanning' || stage === 'extracting' || stage === 'saving';
  // Scanning and extracting can be stopped (the parent's session guard drops
  // late results); only a save in flight holds the screen.
  const closeDisabled = stage === 'saving';

  const [view, setView] = useState<View_>('sheet');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const [filter, setFilter] = useState<SheetFilter>('all');
  const [confirmedIds, setConfirmedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [openedIds, setOpenedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [walk, setWalk] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const [sheetDismissed, setSheetDismissed] = useState(false);
  const [seasonDraft, setSeasonDraft] = useState<string[]>([]);
  const cropBusy = useRef(false);
  const [cropApplying, setCropApplying] = useState(false);
  const [cropId, setCropId] = useState<string | null>(null);
  /** The editor a crop was opened from; it reopens when the crop closes. */
  const [cropReturn, setCropReturn] = useState<string | null>(null);
  /** "Add one": the box drawn so far, waiting on its type. */
  const [adding, setAdding] = useState<{ step: 'crop' } | { step: 'type'; bbox: Bbox } | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const inclusion = useBatchExtractionReview(pieces, busy, onInclusionChange);
  const polish = usePolishChoice();
  const gridOffset = useRef(0);
  const [brandFeedback, setBrandFeedback] = useState({ revision: 0, ids: new Set<string>() });
  /** After one piece gets a brand: offer it to the included pieces still without one. */
  const [brandOffer, setBrandOffer] = useState<{ brand: string; ids: string[] } | null>(null);
  useEffect(() => {
    if (!brandOffer) return;
    const timer = setTimeout(() => setBrandOffer(null), ingestion.undoMs);
    return () => clearTimeout(timer);
  }, [brandOffer]);
  // ── Derived ────────────────────────────────────────────────────────────────

  const preExtract = stage === 'pre-extract';
  // Before extraction every detection stays in view; an unticked one is
  // dimmed and can be ticked back. A piece left out of extraction never
  // reappears in review, where skipping is a separate, reversible choice.
  const visiblePieces = useMemo(() => {
    const shown = pieces.filter(piece =>
      preExtract || piece.included !== false || (piece.extraction !== 'not-started' && piece.extraction !== undefined));
    if (preExtract) {
      const overlaps = overlapDuplicates(shown.map(piece => ({ id: piece.id, category: piece.category, bbox: piece.cropBbox })));
      return overlaps.size ? shown.map(piece => overlaps.has(piece.id) ? { ...piece, overlap: overlaps.get(piece.id) } : piece) : shown;
    }
    if (!review) return shown;
    const duplicates = duplicatePieceIds(shown);
    return duplicates.size ? shown.map(piece => duplicates.has(piece.id) ? { ...piece, possibleDuplicate: true } : piece) : shown;
  }, [pieces, preExtract, review]);
  const states = useMemo(() => {
    const map: Record<string, PieceReviewState> = {};
    if (review) for (const piece of visiblePieces) {
      if (piece.included !== false && (piece.extraction === 'ready' || piece.extraction === 'failed')) map[piece.id] = piece.possibleDuplicate && !confirmedIds.has(piece.id) ? 'check' : pieceReviewState(piece, confirmedIds);
    }
    return map;
  }, [confirmedIds, review, visiblePieces]);
  const summary = useMemo(() => reviewSummary(Object.values(states)), [states]);
  const checkCount = summary.check;

  const sheetEnabled = true;
  // One photo behind every piece: the photo-led review. A batch spans many
  // photos, so it keeps the contact sheet.
  const reviewPhoto = (preExtract || review) && visiblePieces.length > 0 && visiblePieces.every(piece => piece.cropSource === visiblePieces[0].cropSource)
    ? visiblePieces[0].cropSource
    : null;
  // Numbered once, by detection order, so piece 5 is piece 5 before and after extraction.
  const numbers = useMemo(() => new Map(pieces.map((piece, index) => [piece.id, index + 1])), [pieces]);
  // Strong overlaps start unselected; they wait in a collapsed group instead of crowding the list.
  const duplicateIds = useMemo(
    () => new Set(preExtract ? visiblePieces.filter(piece => piece.overlap?.strong).map(piece => piece.id) : []),
    [preExtract, visiblePieces],
  );
  const noteFor = useCallback((piece: ScanReviewPiece): string | null => {
    if (preExtract) {
      const of = piece.overlap ? numbers.get(piece.overlap.of) : undefined;
      return of === undefined ? null : piece.overlap!.strong ? `Looks like #${of}` : `Possibly same as #${of}`;
    }
    if (piece.extraction === 'failed') return 'Couldn’t read details';
    if (states[piece.id] !== 'check') return null;
    return piece.possibleDuplicate ? 'Possible repeat' : 'Worth a look';
  }, [numbers, preExtract, states]);
  const effectiveView: View_ = view;
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

  // A new scan resets navigation; minimizing a batch retains its place.
  useEffect(() => {
    if (stage !== 'scanning' && (visible || onMinimize)) return;
    setView('sheet');
    setActiveId(null);
    setFilter('all');
    setConfirmedIds(new Set());
    setOpenedIds(new Set());
    setWalk(null);
    setSheet(null);
    setCropId(null);
    setCropReturn(null);
    setAdding(null);
    setConfirmClose(false);

    gridOffset.current = 0;
  }, [visible, stage, onMinimize]);

  // Return to the overview when approved extraction finishes.
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
      setSheet(null);
      setCropId(null);
      setCropReturn(null);
      setAdding(null);
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

  const update = useCallback((id: string, patch: PiecePatch) => {
    onUpdate(id, patch);
  }, [onUpdate]);

  const openPiece = useCallback((id: string) => {
    setWalk(filter === 'check' && review ? sheetPieces.map((piece) => piece.id) : null);
    track('scan_review_inspected', { mode: onMinimize ? 'batch' : 'single' });
    setActiveId(id);
    setView('loupe');
  }, [filter, review, sheetPieces, onMinimize]);

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
    bulkFeedback();
    setConfirmedIds((current) => new Set(current).add(activeResolvedId));
    if (nextAfterConfirm) setActiveId(nextAfterConfirm);
    else finishWalk();
  }, [activeResolvedId, finishWalk, nextAfterConfirm]);

  const extract = () => {
    if (busy) return;
    const snapshot = inclusion.snapshot();
    const retrying = snapshot.some(p => p.extraction === 'failed');
    const targets = snapshot.filter(p => p.extraction === (retrying ? 'failed' : 'not-started'));
    if (!targets.length) return;
    const opened = targets.filter(p => openedIds.has(p.id)).length;
    track('scan_review_extraction_approved', { mode: onMinimize ? 'batch' : 'single', included_count: snapshot.length, extraction_count: targets.length, detected_count: pieces.length });
    onExtract(targets.map(p => p.id), opened === targets.length ? 'completed_review' : 'extract_now', opened, targets.filter(p => p.brand.trim()).length);
  };
  const save = () => {
    if (busy) return;
    const targets = inclusion.snapshot();
    if (!targets.length || targets.some(p => p.extraction !== 'ready')) return;
    const polishIds = targets.filter(p => polish.isPolished(p.id)).map(p => p.id);
    track('scan_review_save_approved', { mode: onMinimize ? 'batch' : 'single', item_count: targets.length, polish_count: polishIds.length });
    onSave(targets.map(p => p.id), polishIds);
  };

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
  // A menu row that opens another sheet waits for the menu to finish closing.
  const afterSheet = useRef<(() => void) | null>(null);
  const thenDismiss = useCallback((next: () => void) => { afterSheet.current = next; setSheetDismissed(true); }, []);
  const closeSheet = useCallback(() => {
    // A brand or type sheet opened from the editor hands back to it.
    const returnTo = sheet && (sheet.kind === 'brand' || sheet.kind === 'category' || sheet.kind === 'material') ? sheet.returnTo : undefined;
    setSheet(null);
    setSheetDismissed(false);
    const next = afterSheet.current;
    afterSheet.current = null;
    if (next) next();
    else if (returnTo && pieces.some(piece => piece.id === returnTo)) setSheet({ kind: 'editor', target: [returnTo] });
  }, [pieces, sheet]);

  const openEditor = useCallback((id: string) => {
    track('scan_review_inspected', { mode: onMinimize ? 'batch' : 'single' });
    setActiveId(id);
    setOpenedIds(current => new Set(current).add(id));
    setSheetDismissed(false);
    setSheet({ kind: 'editor', target: [id] });
  }, [onMinimize]);

  const closeCrop = useCallback(() => {
    setCropId(null);
    const back = cropReturn;
    setCropReturn(null);
    if (back && pieces.some(piece => piece.id === back)) { setSheetDismissed(false); setSheet({ kind: 'editor', target: [back] }); }
  }, [cropReturn, pieces]);

  const toggleIncluded = useCallback((id: string) => {
    selectionFeedback();
    const included = inclusion.snapshot().some(p => p.id === id);
    inclusion.change([id], !included);
    track('scan_review_inclusion_changed', { mode: onMinimize ? 'batch' : 'single', included: !included });
  }, [inclusion, onMinimize]);


  const requestSystemClose = useCallback(() => {
    if (sheet) return dismissSheet();
    if (confirmClose) return setConfirmClose(false);
    if (effectiveView === 'loupe' && sheetEnabled) {
      setWalk(null);
      return setView('sheet');
    }
    if (onMinimize) {
      return onMinimize();
    }
    if (!closeDisabled) setConfirmClose(true);
  }, [closeDisabled, confirmClose, dismissSheet, effectiveView, onMinimize, sheet, sheetEnabled]);

  // ── Crop editor (full screen: precise manipulation earns the takeover) ─────

  if (adding?.step === 'crop' && reviewPhoto) {
    return (
      <Modal visible={visible} presentationStyle="fullScreen" animationType="none" onRequestClose={() => setAdding(null)}>
        <GestureHandlerRootView style={styles.root}>
          <CropAdjustEditor
            sourceImage={reviewPhoto}
            initialBbox={ADD_START_BBOX}
            itemName="the new piece"
            title="Add a piece"
            instruction="Drag the edges around the piece you want to add."
            applyLabel="Next"
            onApply={bbox => { setSheetDismissed(false); setAdding({ step: 'type', bbox }); setSheet({ kind: 'add-type', target: [] }); }}
            onCancel={() => setAdding(null)}
          />
        </GestureHandlerRootView>
      </Modal>
    );
  }

  const cropPiece = cropId ? pieces.find((piece) => piece.id === cropId) ?? null : null;
  if (cropPiece?.cropSource && cropPiece.cropBbox) {
    return (
      <Modal visible={visible} presentationStyle="fullScreen" animationType="none" onRequestClose={() => { if (!cropBusy.current) closeCrop(); }}>
        <GestureHandlerRootView style={styles.root}>
          <CropAdjustEditor
            sourceImage={cropPiece.cropSource}
            initialBbox={cropPiece.cropBbox}
            itemName={cropPiece.name}
            instruction={preExtract ? 'Drag the edges to include the whole piece.' : undefined}
            applyLabel={preExtract ? 'Save crop' : undefined}
            onApply={async (bbox) => {
              if (cropBusy.current) return;
              cropBusy.current = true;
              setCropApplying(true);
              try {
                await onApplyCrop(cropPiece.id, bbox);
                cropFeedback(true);
                closeCrop();
              } catch {
                cropFeedback(false);
                Alert.alert('Couldn’t adjust crop', 'Please try again.');
              } finally {
                cropBusy.current = false;
                setCropApplying(false);
              }
            }}
            onCancel={() => { if (!cropBusy.current) closeCrop(); }}
          />
          {cropApplying ? <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chromeTint }]} accessibilityRole="alert"><ActivityIndicator /><Text>Updating crop…</Text></View> : null}
        </GestureHandlerRootView>
      </Modal>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const heroHeight = loupeHeroHeight(height);
  const contentBottom = spacing.xxl;


  // Scanning and extracting tell their own story in the hero; the footer
  // would only repeat it, so it holds its space empty.
  const heroSpeaks = stage === 'scanning' || stage === 'extracting';
  const polishCount = inclusion.included.filter(p => polish.isPolished(p.id)).length;
  const actionMode: ActionBarMode = heroSpeaks
    ? { kind: 'busy', label: '' }
    : stage === 'saving'
        ? { kind: 'busy', label: 'Adding to closet…' }
        : inclusion.included.some(p => p.extraction === 'failed')
            ? { kind: 'failed', count: inclusion.included.filter(p => p.extraction === 'failed').length, onRetry: extract, onKeepBasic: () => onKeepBasic(inclusion.included.filter(p => p.extraction === 'failed').map(p => p.id)) }
          : (stage === 'pre-extract' && !pieces.some(p => p.extraction === 'ready')) || inclusion.included.some(p => p.extraction === 'not-started')
            ? { kind: 'extract', count: inclusion.included.length, onExtract: extract, extractionCount: inclusion.included.filter(p => p.extraction === 'not-started').length, additional: pieces.some(p => p.extraction === 'ready') }
            : effectiveView === 'loupe' && pieces.find(p => p.id === activeResolvedId)?.extraction === 'ready'
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
                count: inclusion.included.length,
                flagged: sheetEnabled ? checkCount : 0,
                onSave: save,
                onReviewFlagged: reviewPhoto
                  ? () => { const first = visiblePieces.find(p => states[p.id] === 'check'); if (first) openEditor(first.id); }
                  : startFlaggedWalk,
                polish: effectiveView === 'sheet' ? {
                  count: polishCount,
                  total: inclusion.included.length,
                  cost: polish.costFor(polishCount),
                  balance: polish.balance,
                  locked: !polish.isPremium,
                  onToggle: next => { void polish.setAll(next); },
                  onExample: () => openSheet({ kind: 'polish-example', target: [] }),
                } : undefined,
              };

  const sheetTargets = sheet ? pieces.filter((piece) => sheet.target.includes(piece.id) && (!(sheet.kind === 'brand' && sheet.includedOnly) || piece.included !== false)) : [];
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
        <KeyboardProvider>
        <View style={styles.root} accessibilityElementsHidden={Boolean(sheet)} importantForAccessibility={sheet ? "no-hide-descendants" : "auto"}>
          <WorkspaceHeader
            stage={stage}
            view={effectiveView}
            canGoBack={effectiveView === 'loupe' && sheetEnabled && !busy}
            position={effectiveView === 'loupe' && activeIndex >= 0 ? { index: activeIndex, count: loupeIds.length, walk: Boolean(walk) } : null}
            includedCount={inclusion.included.length}
            totalCount={visiblePieces.length}
            onIncludeAll={busy ? undefined : () => { bulkFeedback(); inclusion.change(visiblePieces.map(p => p.id), true); }}
            onMore={onMinimize ? () => openSheet({ kind: 'options', target: [] }) : undefined}
            closeDisabled={closeDisabled}
            topInset={insets.top}
            onBack={() => { setWalk(null); setView('sheet'); }}
            onClose={() => setConfirmClose(true)}
            busy={heroSpeaks}
            onMinimize={onMinimize}
            heading={reviewPhoto ? (preExtract ? 'Review your pieces' : 'Your pieces are ready') : undefined}
          />

          {failure ? (
            <View style={styles.failureBanner} accessibilityRole="alert">
              <Ionicons name="alert-circle-outline" size={18} color={colors.action} />
              <Text style={styles.failureText}>{failure.message}</Text>
              <TextLink label={failure.retryLabel ?? 'Retry'} onPress={failure.onRetry} disabled={busy} />
            </View>
          ) : null}

          {stage === 'scanning' ? (
            <DetectionState previewImage={previewImage} photos={scanPhotos} progress={scanProgress} heroHeight={heroHeight} reduceMotion={reduceMotion} />
          ) : stage === 'extracting' ? (
            <ExtractionState piece={visiblePieces[0] ?? null} pieces={inclusion.included} progress={extractionProgress} heroHeight={heroHeight} reduceMotion={reduceMotion} />
          ) : reviewPhoto ? (
            <PhotoReview
              source={reviewPhoto}
              blurb={preExtract ? reviewBlurb(visiblePieces.length) : readyBlurb(inclusion.included.length, checkCount)}
              pieces={visiblePieces}
              numbers={numbers}
              noteFor={noteFor}
              isPolished={polishCount > 0 ? polish.isPolished : undefined}
              duplicateIds={duplicateIds}
              compactPhoto={review}
              activeId={activeId}
              disabled={stage === 'saving'}
              reduceMotion={reduceMotion}
              bottomPadding={contentBottom}
              onActivate={id => { selectionFeedback(); setActiveId(id); }}
              onClearActive={() => setActiveId(null)}
              onOpen={openEditor}
              onToggleIncluded={toggleIncluded}
              onBrand={id => { setActiveId(id); openSheet({ kind: 'brand', target: [id] }); }}
              onAddPiece={onAddPiece ? () => { setActiveId(null); setAdding({ step: 'crop' }); } : undefined}
            />
          ) : effectiveView === 'sheet' ? (
            <PreExtractGrid
              pieces={sheetPieces}
              totalCount={visiblePieces.length}
              stage={stage}
              states={states}
              guidance={sheetGuidance(review ? 'review' : 'pre-extract', summary)}
              checkCount={checkCount}
              filter={filter}
              selection={null}
              disabled={stage === 'saving'}
              reduceMotion={reduceMotion}
              bottomPadding={contentBottom}
              onFilterChange={setFilter}
              onOpen={openPiece}
              scrollOffset={gridOffset}
              brandFeedback={brandFeedback}
              focusId={sheet ? null : activeId}
              onToggleIncluded={id => {
                selectionFeedback();
                const piece = inclusion.snapshot().find(p => p.id === id);
                inclusion.change([id], !piece);
                track('scan_review_inclusion_changed', { mode: onMinimize ? 'batch' : 'single', included: !piece });
              }}
              onToggleSelect={() => {}}
              onCrop={stage === 'pre-extract' ? setCropId : undefined}
              onBrand={id => openSheet({ kind: 'brand', target: [id] })}
            />
          ) : activeResolvedId ? (
            <ItemInspectionModal
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
              onToggleIncluded={id => {
                selectionFeedback();
                inclusion.change([id], !inclusion.snapshot().some(p => p.id === id));
              }}
              onToggleCutout={onToggleCutout}
              footerHeight={footerHeight}
            />
          ) : <View style={styles.root} />}

          <View onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}>
            {heroSpeaks
              ? <View style={{ height: Math.max(insets.bottom, spacing.md) + spacing.sm + 56 }} />
              : <ActionBar mode={actionMode} bottomInset={insets.bottom} />}
          </View>
          {brandOffer && effectiveView === 'sheet' && !sheet ? (
            <UndoToast bottom={footerHeight + spacing.sm} actionLabel="Apply"
              message={`Add ${brandOffer.brand} to ${brandOffer.ids.length} more ${brandOffer.ids.length === 1 ? 'piece' : 'pieces'}?`}
              onUndo={() => {
                bulkFeedback();
                // Re-check at tap time: a piece skipped or branded since the offer is left alone.
                const live = new Set(inclusion.snapshot().filter(p => !p.brand.trim()).map(p => p.id));
                const ids = brandOffer.ids.filter(id => live.has(id));
                for (const id of ids) update(id, { brand: brandOffer.brand });
                setBrandFeedback(current => ({ revision: current.revision + 1, ids: new Set(ids) }));
                setBrandOffer(null);
              }} />
          ) : null}

        </View>

        {/* The sheets present natively; their host must take no room in the layout, or the review collapses behind them. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {sheet?.kind === 'editor' && singleTarget && (singleTarget.extraction === 'ready' || singleTarget.extraction === 'failed') ? (
          <PieceDetailSheet
            piece={singleTarget}
            stage={singleTarget.extraction === 'failed' ? 'pre-extract' : stage}
            confirmed={confirmedIds.has(singleTarget.id)}
            disabled={stage === 'saving'}
            dismissed={sheetDismissed}
            reduceMotion={reduceMotion}
            onClose={closeSheet}
            onDone={() => {
              // Done means "looked at": its "worth a look" note retires.
              setConfirmedIds(current => new Set(current).add(singleTarget.id));
              dismissSheet();
            }}
            onCrop={singleTarget.canAdjustCrop && singleTarget.cropSource && singleTarget.cropBbox
              ? () => thenDismiss(() => { setCropReturn(singleTarget.id); setCropId(singleTarget.id); })
              : undefined}
            onToggleCutout={() => onToggleCutout(singleTarget.id)}
            polish={singleTarget.extraction === 'ready' && polish.isPremium
              ? { on: polish.isPolished(singleTarget.id), cost: polish.costPerPiece, onToggle: next => polish.setPiece(singleTarget.id, next) }
              : undefined}
            onUpdate={patch => update(singleTarget.id, patch)}
            onOpenSheet={kind => thenDismiss(() => { setSheetDismissed(false); setSheet({ kind, target: [singleTarget.id], returnTo: singleTarget.id }); })}
          />
        ) : sheet?.kind === 'editor' && singleTarget ? (
          <PieceEditorSheet
            piece={singleTarget}
            dismissed={sheetDismissed}
            reduceMotion={reduceMotion}
            onClose={closeSheet}
            onDone={dismissSheet}
            onCrop={singleTarget.canAdjustCrop && singleTarget.cropSource && singleTarget.cropBbox
              ? () => thenDismiss(() => { setCropReturn(singleTarget.id); setCropId(singleTarget.id); })
              : undefined}
            onType={() => thenDismiss(() => { setSheetDismissed(false); setSheet({ kind: 'category', target: [singleTarget.id], returnTo: singleTarget.id }); })}
            onBrand={() => thenDismiss(() => { setSheetDismissed(false); setSheet({ kind: 'brand', target: [singleTarget.id], returnTo: singleTarget.id }); })}
          />
        ) : sheet?.kind === 'add-type' && adding?.step === 'type' ? (
          <WorkspaceSheet title="What is it?" reduceMotion={reduceMotion} dismissed={sheetDismissed}
            onClose={() => { closeSheet(); setAdding(current => current?.step === 'type' ? null : current); }}>
            <View style={styles.addTypeBody}>
              <ChipRow
                label="Type"
                options={CATEGORY_ORDER.map(value => ({ value: value as string, label: CATEGORY_LABELS[value] }))}
                isSelected={() => false}
                onToggle={category => {
                  if (!onAddPiece) return;
                  const { bbox } = adding;
                  // Leave the sheet first; the new piece's editor opens once it exists.
                  thenDismiss(() => {
                    setAdding(null);
                    void onAddPiece(bbox, category).then(id => {
                      if (id) { bulkFeedback(); openEditor(id); }
                      else Alert.alert('Couldn’t add that piece', 'Please try again.');
                    });
                  });
                }}
              />
            </View>
          </WorkspaceSheet>
        ) : sheet?.kind === 'brand' ? (
          <BrandSearchSheet targetIds={sheet.target} current={singleTarget?.brand ?? (sheetTargets.every(piece => piece.brand === sheetTargets[0]?.brand) ? sheetTargets[0]?.brand ?? '' : '')}
            suggestions={brandSuggestions} scanBrands={scanBrands} closetBrands={closetBrands} subtitle={singleTarget ? <PieceTag piece={singleTarget} /> : <Text style={styles.sheetSubtitle}>{pieceCountLabel(sheetTargets.length)}</Text>}
            reduceMotion={reduceMotion} dismissed={sheetDismissed} onClose={closeSheet}
            onSelect={(ids, brand) => {
              const targets = ids.filter(id => pieces.some(p => p.id === id && (!sheet.includedOnly || p.included !== false)));
              for (const id of targets) update(id, { brand });
              setBrandFeedback(current => ({ revision: current.revision + 1, ids: new Set(targets) }));
              const rest = brand.trim() && targets.length === 1 && (stage === 'pre-extract' || review) ? piecesMissingBrand(pieces, targets[0]).map(p => p.id) : [];
              setBrandOffer(rest.length ? { brand: brand.trim(), ids: rest } : null);
              dismissSheet();
            }} />
        ) : sheet?.kind === 'polish-example' ? (
          <WorkspaceSheet title="What Polish does" reduceMotion={reduceMotion} dismissed={sheetDismissed} onClose={closeSheet}>
            <PolishExample example={polish.example} />
          </WorkspaceSheet>
        ) : sheet?.kind === 'options' ? (
          <WorkspaceSheet title="Import options" detent="fit" rows={onMinimize ? 2 : 1} reduceMotion={reduceMotion} dismissed={sheetDismissed} onClose={closeSheet}>
            {onMinimize ? <MenuRow icon="chevron-down" label="Keep running in the background" onPress={() => thenDismiss(onMinimize)} /> : null}
            <ArmedDiscardRow
              detail={`${pieceCountLabel(pieces.length)} and your edits`}
              onConfirm={() => thenDismiss(() => {
                track('scan_review_discarded', { mode: 'batch', included_count: inclusion.included.length, detected_count: pieces.length });
                onClose();
              })}
            />
          </WorkspaceSheet>
        ) : sheet && sheet.kind !== 'editor' && sheet.kind !== 'add-type' ? (
          <WorkspaceSheet
            title={sheet.kind === 'material' ? 'Material' : sheet.kind === 'category' ? (preExtract ? 'Type' : 'Category') : 'Season'}
            subtitle={singleTarget ? <PieceLine piece={singleTarget} /> : <Text style={styles.sheetSubtitle}>{pieceCountLabel(sheetTargets.length)}</Text>}
            reduceMotion={reduceMotion}
            dismissed={sheetDismissed}
            onClose={closeSheet}
            footer={sheet.kind === 'season' ? (
              <SheetButton
                label={`Apply to ${pieceCountLabel(sheetTargets.length)}`}
                onPress={() => {
                  bulkFeedback();
                  for (const piece of sheetTargets) update(piece.id, { seasons: seasonDraft });
                  dismissSheet();
                }}
              />
            ) : undefined}
          >
            {sheet.kind === 'material' && singleTarget ? (
              <MaterialPicker
                current={singleTarget.material}
                onSelect={(material) => {
                  update(singleTarget.id, { material });
                  dismissSheet();
                }}
              />
            ) : sheet.kind === 'category' && singleTarget && preExtract ? (
              // Before extraction only the category is known; type details come from extraction.
              <View style={styles.addTypeBody}>
                <ChipRow
                  label="Type"
                  options={CATEGORY_ORDER.map(value => ({ value: value as string, label: CATEGORY_LABELS[value] }))}
                  isSelected={value => value === singleTarget.category}
                  onToggle={category => {
                    if (category !== singleTarget.category) { selectionFeedback(); update(singleTarget.id, { category }); }
                    dismissSheet();
                  }}
                />
              </View>
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
        </View>

        {confirmClose ? (
          <ConfirmationPanel
            title={heroSpeaks && !onMinimize ? (stage === 'scanning' ? 'Stop scanning?' : 'Stop reading details?') : 'Discard this scan?'}
            message={onMinimize
              ? 'Every photo in this batch, its detected pieces and your edits will be removed.'
              : 'Your detected pieces and edits in this review will be removed.'}
            confirmLabel={heroSpeaks && !onMinimize ? 'Stop and discard' : 'Discard scan'}
            bottomInset={insets.bottom}
            onCancel={() => setConfirmClose(false)}
            onConfirm={() => {
              setConfirmClose(false);
              track('scan_review_discarded', { mode: onMinimize ? 'batch' : 'single', included_count: inclusion.included.length, detected_count: pieces.length });
              onClose();
            }}
          />
        ) : null}
        </KeyboardProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}

function WorkspaceHeader({ stage, view, canGoBack, position, includedCount, totalCount, onIncludeAll, onMore, closeDisabled, busy, topInset, onBack, onClose, onMinimize, heading }: {
  /** A screen heading set in the bar itself, beside the close button: one compact row instead of a bar plus a title. */
  heading?: string;
  stage: ScanReviewStage;
  view: View_;
  canGoBack: boolean;
  position: { index: number; count: number; walk: boolean } | null;
  includedCount: number;
  totalCount: number;
  /** Quiet header link that undoes every skip at once. */
  onIncludeAll?: () => void;
  onMore?: () => void;
  closeDisabled: boolean;
  busy?: boolean;
  topInset: number;
  onBack: () => void;
  onClose: () => void;
  onMinimize?: () => void;
}) {
  const title = stage === 'scanning'
    ? 'Scanning'
    : stage === 'extracting'
      ? 'Reading details'
      : stage === 'pre-extract' ? 'Choose pieces' : 'Review details';
  const showPosition = view === 'loupe' && position && position.count > 1 && (stage === 'review' || stage === 'saving' || stage === 'pre-extract');

  if (heading) {
    return (
      <View style={[styles.headingBar, { paddingTop: topInset + spacing.xs }]}>
        <Text style={styles.heading} accessibilityRole="header" numberOfLines={1}>{heading}</Text>
        {onMore ? <Pressable onPress={onMore} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="More options"><Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} /></Pressable> : null}
        {onMinimize ? (
          <TouchableOpacity style={styles.headerButton} onPress={onMinimize} accessibilityRole="button" accessibilityLabel="Hide batch import" accessibilityHint="The batch keeps running in the background">
            <Ionicons name="chevron-down" size={22} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
            disabled={closeDisabled}
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Stop closet scan' : 'Close closet scan'}
          >
            <Ionicons name="close" size={22} color={closeDisabled ? colors.border : colors.foreground} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.header, { paddingTop: topInset + spacing.xs }]}>
      <View style={styles.headerSide}>
        {canGoBack ? (
          <TouchableOpacity style={styles.back} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to all pieces">
            <Ionicons name="chevron-back" size={18} color={colors.foreground} />
            <Text style={styles.backText}>Pieces</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.headerCenter}>
        {showPosition ? (
          <Text style={styles.position} accessibilityLabel={`Piece ${position.index + 1} of ${position.count}${position.walk ? ' to check' : ''}`}>
            {position.index + 1} of {position.count}{position.walk ? ' to check' : ''}
          </Text>
        ) : (
          <View><Text style={styles.masthead} accessibilityRole="header">{title}</Text>{(stage === 'pre-extract' || stage === 'review') && includedCount < totalCount ? <Text style={styles.position}>{`${includedCount} of ${totalCount} included`}{onIncludeAll ? <Text style={styles.position}>{' · '}<Text style={styles.includeAll} onPress={onIncludeAll} accessibilityRole="button" suppressHighlighting>Include all</Text></Text> : null}</Text> : null}</View>
        )}
      </View>
      <View style={[styles.headerSide, styles.headerSideEnd]}>
        {onMore ? <Pressable onPress={onMore} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="More options"><Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} /></Pressable> : null}
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
        {!onMinimize ? <TouchableOpacity
          style={styles.headerButton}
          onPress={onClose}
          disabled={closeDisabled}
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Stop closet scan' : 'Close closet scan'}
        >
          <Ionicons name="close" size={22} color={closeDisabled ? colors.border : colors.foreground} />
        </TouchableOpacity> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menuRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: stroke.hairline, borderBottomColor: colors.hairline },
  menuLabel: { ...typography.text.body, flex: 1 },
  discardArmed: { backgroundColor: colors.destructive, borderBottomColor: colors.destructive },
  discardDetail: { ...typography.text.bodySmall, opacity: 0.85 },
  inclusionControl: { minHeight: 44, marginHorizontal: spacing.lg, marginVertical: spacing.sm },
  root: { flex: 1, backgroundColor: colors.background },
  addTypeBody: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: colors.hairline,
  },
  headingBar: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingBottom: spacing.xs },
  heading: { ...typography.text.editorialSection, color: colors.foreground, flex: 1 },
  headerSide: { flexShrink: 0, flexDirection: 'row', alignItems: 'center' },
  headerSideEnd: { justifyContent: 'flex-end' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm },
  backText: { ...typography.text.label, color: colors.foreground },
  masthead: { ...typography.text.masthead, color: colors.mutedForeground },
  position: { ...typography.text.meta, color: colors.foreground, fontVariant: ['tabular-nums'] },
  includeAll: { textDecorationLine: 'underline' },
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
