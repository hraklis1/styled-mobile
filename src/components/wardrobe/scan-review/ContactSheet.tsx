import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';

import { type PieceReviewState, type SheetGuidance } from '../../../lib/scan-review';
import { colors, cutoutScaleFor, editorial, radii, spacing, stroke, surfaces, typography } from '../../../theme';
import { Middot, TextSegment } from './atoms';
import { reviewColumns } from '../../../lib/extraction-review';
import { coverUri, isReviewStage, type ScanReviewPiece, type ScanReviewStage } from './types';

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
  onToggleSelect: (id: string) => void;

};



/**
 * The overview: every piece at once, as a lookbook contact sheet. Triage,
 * bulk edits and removal happen here; a tap opens the piece in the loupe.
 */
export function ContactSheet({
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

}: Props) {
  const { width, fontScale } = useWindowDimensions();
  const columns = reviewColumns(width, fontScale);
  const gap = spacing.md;
  const tileWidth = Math.floor((width - spacing.lg * 2 - gap * (columns - 1)) / columns);
  const review = isReviewStage(stage);
  const selecting = selection !== null;
  const list = useRef<FlatList<ScanReviewPiece>>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => list.current?.scrollToOffset({ offset: scrollOffset.current, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [columns, scrollOffset]);
  return (
    <FlatList
      ref={list}
      key={columns}
      data={pieces}
      numColumns={columns}
      keyExtractor={piece => piece.id}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      columnWrapperStyle={columns > 1 ? { gap } : undefined}
      onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={32}
      extraData={{ selection, states, disabled }}
      ListHeaderComponent={
        <View style={styles.masthead}>
          <Text style={styles.hint}>{selecting ? 'Select pieces to edit their details. Inclusion stays unchanged.' : review ? guidance.hint : 'Uncheck pieces you don’t want. Tap a photo to inspect or add a brand.'}</Text>
          {review && checkCount > 0 && !selecting ? <TextSegment
            options={[{ value: 'all' as const, label: 'All' }, { value: 'check' as const, label: `To check · ${checkCount}` }]}
            value={filter} onChange={onFilterChange} accessibilityLabel="Filter pieces"
          /> : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.hint}>No pieces found. Try another photo or retry the scan.</Text>}
      renderItem={({ item: piece, index }) => (
        <View style={{ width: tileWidth }}>
          <PieceTile piece={piece} index={index} count={pieces.length} stage={stage}
            state={review ? states[piece.id] ?? 'ready' : null} width={tileWidth}
            compact={columns === 3} selected={selection?.has(piece.id) ?? false}
            selecting={selecting} disabled={disabled} reduceMotion={reduceMotion}
            restoreFocus={piece.id === focusId}
            onPress={() => selecting ? onToggleSelect(piece.id) : onOpen(piece.id)}
            onToggle={() => selecting ? onToggleSelect(piece.id) : onToggleIncluded(piece.id)}
          />
        </View>
      )}
    />
  );
}

function PieceTile({ piece, index, count, stage, state, width, compact, selected, selecting, disabled, reduceMotion, restoreFocus, onPress, onToggle }: {
  piece: ScanReviewPiece;
  index: number;
  count: number;
  stage: ScanReviewStage;
  state: PieceReviewState | null;
  width: number;
  compact: boolean;
  selected: boolean;
  selecting: boolean;
  disabled: boolean;
  onPress: () => void;
  onToggle: () => void;
  reduceMotion: boolean;
  restoreFocus: boolean;
}) {
  const uri = coverUri(piece, stage);
  const isCutout = uri !== null && uri === piece.cutout;
  const plateHeight = Math.round(width / editorial.garmentAspectRatio);
  const inset = isCutout ? `${Math.round(cutoutScaleFor(piece.category) * 100)}%` as const : '100%' as const;
  // After extraction the sheet is a lookbook, so crops fill their plate
  // evenly. Before it, the whole crop has to show — judging it is the job.
  const fit = isCutout || !isReviewStage(stage) ? 'contain' : 'cover';
  const stateLabel = state === 'check' ? ', worth a look' : state === 'confirmed' ? ', confirmed' : '';

  const target = useRef<View>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!restoreFocus) return;
    const timer = setTimeout(() => {
      const handle = findNodeHandle(target.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }, 150);
    return () => clearTimeout(timer);
  }, [restoreFocus]);
  const checked = selecting ? selected : piece.included !== false;
  return (
    <View>
      <Pressable ref={target} onPress={onPress} disabled={disabled}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={({ pressed }) => ({ outlineWidth: focused ? 2 : 0, outlineColor: colors.foreground, backgroundColor: pressed ? colors.surfaceSelected : 'transparent' })}
        accessibilityRole="button" accessibilityLabel={`${piece.name || 'Unnamed piece'}, ${index + 1} of ${count}${stateLabel}`}
        accessibilityHint={selecting ? 'Select for metadata editing' : 'Inspect photos, brand and details'}>
        <View>
          <View style={[styles.plate, { height: plateHeight }, selecting && selected && styles.plateSelected]}>
            <Animated.View style={{ width: inset, height: inset, opacity: piece.included === false && !selecting ? 0.45 : 1,
              transitionProperty: 'opacity', transitionDuration: reduceMotion ? 0 : 120, alignItems: 'center', justifyContent: 'center' }}>
              {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit={fit} cachePolicy="memory-disk" recyclingKey={piece.id} />
                : <Ionicons name="shirt-outline" size={28} color={colors.mutedForeground} />}
            </Animated.View>
          </View>
          <View style={styles.caption}>
            {piece.sourceLabel ? <Text style={styles.hint}>{piece.sourceLabel}</Text> : null}
            <Text style={styles.brand}>{piece.brand || 'Add brand'}</Text>
            <Text style={[styles.name, compact && styles.nameCompact]}>{piece.name || 'Unnamed piece'}</Text>
            <Text style={styles.hint}>{piece.included === false ? 'Excluded · ' : ''}{selecting ? 'Edit details' : 'Inspect ›'}</Text>
            {state === 'check' ? <Text style={styles.hint}>Check details</Text> : null}
          </View>
        </View>
      </Pressable>
      <Pressable onPress={onToggle} disabled={disabled} accessibilityRole="checkbox"
        accessibilityLabel={`${selecting ? 'Edit' : 'Keep'} ${piece.name}`}
        accessibilityState={{ checked, disabled }} style={styles.checkTarget}>
        <View style={[styles.selectRing, checked && styles.selectRingOn]}>
          {checked ? <Ionicons name="checkmark" size={14} color={colors.primaryForeground} /> : null}
        </View>
      </Pressable>
    </View>
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
  ruled: { paddingBottom: spacing.md, borderBottomWidth: stroke.hairline, borderBottomColor: colors.hairline },
  title: { ...typography.text.editorialTitle, color: colors.foreground },
  subRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  subCopy: { flex: 1, gap: 2 },
  lead: { ...typography.text.bodySmall, color: colors.foreground },
  hint: { ...typography.text.bodySmall, color: colors.mutedForeground },
  controls: { minHeight: 32, flexDirection: 'row', alignItems: 'center', marginTop: -spacing.sm },
  controlsEnd: { flexDirection: 'row', alignItems: 'center', marginTop: -6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: spacing.xs },
  plate: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.photo,
    backgroundColor: surfaces.plate,
  },
  plateSelected: { outlineWidth: stroke.fine, outlineColor: colors.foreground, outlineOffset: 2 },
  cornerMark: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  markDisc: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.chromeTint,
  },
  checkTarget: { position: 'absolute', top: 0, right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  selectRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.fine,
    borderColor: colors.controlOutline,
    backgroundColor: colors.chromeTint,
  },
  selectRingOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  caption: { paddingTop: spacing.sm, paddingBottom: spacing.md, gap: 1 },
  brand: { ...typography.text.eyebrow, fontSize: 10, color: colors.foreground },
  brandEmpty: { color: colors.tertiary },
  name: { ...typography.text.editorialCard, fontSize: 15, lineHeight: 19, color: colors.foreground },
  nameCompact: { fontSize: 14, lineHeight: 18 },
  pieceLine: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  pieceLineName: { ...typography.text.editorialCard, color: colors.foreground, flexShrink: 1 },
});
