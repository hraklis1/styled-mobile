import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { dismissBrandTip, isBrandTipDismissed } from '../../../lib/scanBrandTip';
import { dismissCropTip, isCropTipDismissed } from '../../../lib/scanCropTip';

import { type PieceReviewState, type SheetGuidance } from '../../../lib/scan-review';
import { colors, radii, spacing, typography } from '../../../theme';
import { GridCard } from './GridCard';
import { Middot, TextSegment } from './atoms';
import { reviewColumns } from '../../../lib/extraction-review';
import { isReviewStage, type ScanReviewPiece, type ScanReviewStage } from './types';

export type SheetFilter = 'all' | 'check';

type Props = {
  pieces: ScanReviewPiece[];
  /** Every piece in the scan, for the title; `pieces` may be filtered. */
  totalCount: number;
  stage: ScanReviewStage;
  states: Readonly<Record<string, PieceReviewState>>;
  guidance: SheetGuidance;
  checkCount: number;
  filter: SheetFilter;
  selection: ReadonlySet<string> | null;
  disabled: boolean;
  reduceMotion: boolean;
  bottomPadding: number;
  onFilterChange: (filter: SheetFilter) => void;
  onOpen: (id: string) => void;
  onToggleIncluded: (id: string) => void;
  scrollOffset: MutableRefObject<number>;
  focusId: string | null;
  brandFeedback?: { revision: number; ids: ReadonlySet<string> };
  onToggleSelect: (id: string) => void;
  /** Present before extraction: tiles carry a remove mark and a "+ Brand" link. */
  onRemove?: (id: string) => void;
  onAddBrand?: (id: string) => void;
};

/**
 * The overview: every piece at once, as a lookbook contact sheet. Triage,
 * bulk edits and removal happen here; a tap opens the piece in the loupe.
 */
export function PreExtractGrid({
  pieces,
  stage,
  states,
  guidance,
  checkCount,
  filter,
  selection,
  disabled,
  reduceMotion,
  bottomPadding,
  onFilterChange,
  onOpen,
  onToggleIncluded,
  scrollOffset,
  focusId,
  onToggleSelect,
  brandFeedback,
  onRemove,
  onAddBrand,
}: Props) {
  const [tipDismissed, setTipDismissed] = useState(true);
  const [cropTipDismissed, setCropTipDismissed] = useState(true);
  useEffect(() => {
    void isBrandTipDismissed().then(setTipDismissed);
    void isCropTipDismissed().then(setCropTipDismissed);
  }, []);
  // One tip at a time: the crop tip first, since a bad crop spoils
  // extraction and brands are optional.
  const showCropTip = Boolean(onRemove) && !cropTipDismissed && pieces.length > 0;
  const showTip = !showCropTip && Boolean(onAddBrand) && !tipDismissed && pieces.some(piece => !piece.brand);
  const putAwayCropTip = () => { setCropTipDismissed(true); void dismissCropTip(); };
  const openPiece = (id: string) => { if (showCropTip) putAwayCropTip(); onOpen(id); };
  const { width, fontScale } = useWindowDimensions();
  const columns = reviewColumns(width, fontScale);
  const gap = spacing.md;
  const tileWidth = Math.floor((width - spacing.lg * 2 - gap * (columns - 1)) / columns);
  const review = isReviewStage(stage);
  const selecting = selection !== null;
  const displayedPieces = selecting ? pieces.filter(piece => piece.included !== false) : pieces;
  const list = useRef<FlatList<ScanReviewPiece>>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => list.current?.scrollToOffset({ offset: scrollOffset.current, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [columns, scrollOffset]);
  return (
    <FlatList
      ref={list}
      key={columns}
      data={displayedPieces}
      numColumns={columns}
      keyExtractor={piece => piece.id}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      columnWrapperStyle={columns > 1 ? { gap } : undefined}
      onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={32}
      extraData={{ selection, states, disabled, brandFeedback }}
      ListHeaderComponent={
        <View style={styles.masthead}>
          {showCropTip ? (
            <View style={styles.tip}>
              <Ionicons name="crop-outline" size={15} color={colors.foreground} />
              <Text style={styles.tipText}>Tap a piece to check and fix its crop.</Text>
              <Pressable hitSlop={12} onPress={putAwayCropTip} accessibilityRole="button" accessibilityLabel="Dismiss tip">
                <Ionicons name="close" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ) : null}
          {showTip ? (
            // A plain View: an exiting animation here leaves the list header
            // at its old height, stranding a blank band above the grid.
            <View style={styles.tip}>
              <Ionicons name="pricetag-outline" size={15} color={colors.foreground} />
              <Text style={styles.tipText}>Know the brands? Adding them sharpens the details we read.</Text>
              <Pressable hitSlop={12} onPress={() => { setTipDismissed(true); void dismissBrandTip(); }} accessibilityRole="button" accessibilityLabel="Dismiss tip">
                <Ionicons name="close" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ) : null}

          {review && checkCount > 0 && !selecting ? <TextSegment
            options={[{ value: 'all' as const, label: 'All' }, { value: 'check' as const, label: `To check · ${checkCount}` }]}
            value={filter} onChange={onFilterChange} accessibilityLabel="Filter pieces"
          /> : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.hint}>No pieces found. Try another photo or retry the scan.</Text>}
      renderItem={({ item: piece, index }) => (
        <Animated.View style={{ width: tileWidth }} layout={reduceMotion ? undefined : LinearTransition.duration(220)} exiting={reduceMotion ? undefined : FadeOut.duration(140)}>
          <GridCard piece={piece} index={index} count={displayedPieces.length} stage={stage}
            state={review ? states[piece.id] ?? 'ready' : null} width={tileWidth}
            selected={selection?.has(piece.id) ?? false}
            selecting={selecting} disabled={disabled} reduceMotion={reduceMotion}
            restoreFocus={piece.id === focusId}
            onPress={() => selecting ? onToggleSelect(piece.id) : openPiece(piece.id)}
            brandRevision={brandFeedback?.ids.has(piece.id) ? brandFeedback.revision : 0}
            onToggle={() => selecting ? onToggleSelect(piece.id) : onToggleIncluded(piece.id)}
            onRemove={onRemove ? () => onRemove(piece.id) : undefined}
            onAddBrand={onAddBrand ? () => onAddBrand(piece.id) : undefined}
          />
        </Animated.View>
      )}
    />
  );
}

/** "Brand · Name" as one quiet line, for sheet headers and toasts. */
export function PieceLine({ piece, hideBrand = false }: { piece: ScanReviewPiece; hideBrand?: boolean }) {
  return (
    <View style={styles.pieceLine}>
      {piece.brand && !hideBrand ? <><Text style={styles.brand}>{piece.brand}</Text><Middot /></> : null}
      <Text style={styles.pieceLineName} numberOfLines={1}>{piece.name || 'Unnamed piece'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  masthead: { gap: spacing.xs },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.xs, borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: colors.surfaceSubtle },
  tipText: { ...typography.text.bodySmall, color: colors.foreground, flex: 1 },
  hint: { ...typography.text.bodySmall, color: colors.mutedForeground },
  brand: { ...typography.text.label, color: colors.foreground },
  pieceLine: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  pieceLineName: { ...typography.text.editorialCard, color: colors.foreground, flexShrink: 1 },
});
