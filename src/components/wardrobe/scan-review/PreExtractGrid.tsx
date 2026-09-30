import { useEffect, useRef, type MutableRefObject } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { type PieceReviewState, type SheetGuidance } from '../../../lib/scan-review';
import { colors, spacing, typography } from '../../../theme';
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
  onBrand: (id: string) => void;
  onClearBrand?: (id: string) => void;
  brandFeedback?: { revision: number; ids: ReadonlySet<string> };
  onToggleSelect: (id: string) => void;

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
  onBrand, onClearBrand, brandFeedback,

}: Props) {
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

          {review && checkCount > 0 && !selecting ? <TextSegment
            options={[{ value: 'all' as const, label: 'All' }, { value: 'check' as const, label: `To check · ${checkCount}` }]}
            value={filter} onChange={onFilterChange} accessibilityLabel="Filter pieces"
          /> : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.hint}>No pieces found. Try another photo or retry the scan.</Text>}
      renderItem={({ item: piece, index }) => (
        <View style={{ width: tileWidth }}>
          <GridCard piece={piece} index={index} count={displayedPieces.length} stage={stage}
            state={review ? states[piece.id] ?? 'ready' : null} width={tileWidth}
            selected={selection?.has(piece.id) ?? false}
            selecting={selecting} disabled={disabled} reduceMotion={reduceMotion}
            restoreFocus={piece.id === focusId}
            onPress={() => selecting ? onToggleSelect(piece.id) : onOpen(piece.id)}
            onBrand={() => onBrand(piece.id)}
            onClearBrand={() => onClearBrand?.(piece.id)}
            brandRevision={brandFeedback?.ids.has(piece.id) ? brandFeedback.revision : 0}
            onToggle={() => selecting ? onToggleSelect(piece.id) : onToggleIncluded(piece.id)}
          />
        </View>
      )}
    />
  );
}

/** "Brand · Name" as one quiet line, for sheet headers and toasts. */
export function PieceLine({ piece }: { piece: ScanReviewPiece }) {
  return (
    <View style={styles.pieceLine}>
      {piece.brand ? <><Text style={styles.brand}>{piece.brand}</Text><Middot /></> : null}
      <Text style={styles.pieceLineName} numberOfLines={1}>{piece.name || 'Unnamed piece'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  masthead: { gap: spacing.xs },
  hint: { ...typography.text.bodySmall, color: colors.mutedForeground },
  brand: { ...typography.text.label, color: colors.foreground },
  pieceLine: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  pieceLineName: { ...typography.text.editorialCard, color: colors.foreground, flexShrink: 1 },
});
