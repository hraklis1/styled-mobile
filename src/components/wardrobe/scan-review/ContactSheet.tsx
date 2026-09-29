import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { PressableScale } from '../../primitives/PressableScale';
import { contactSheetColumns, type PieceReviewState, type SheetGuidance } from '../../../lib/scan-review';
import { colors, cutoutScaleFor, editorial, radii, spacing, stroke, surfaces, typography } from '../../../theme';
import { FlagDot, Middot, TextLink, TextSegment } from './atoms';
import { coverUri, isReviewStage, pieceCountLabel, type ScanReviewPiece, type ScanReviewStage } from './types';

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
  onStartSelect: (id?: string) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onEndSelect: () => void;
};

const GAP = { 2: spacing.md, 3: spacing.sm + 2 } as const;

/**
 * The overview: every piece at once, as a lookbook contact sheet. Triage,
 * bulk edits and removal happen here; a tap opens the piece in the loupe.
 */
export function ContactSheet({
  pieces,
  totalCount,
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
  onStartSelect,
  onToggleSelect,
  onSelectAll,
  onEndSelect,
}: Props) {
  const { width } = useWindowDimensions();
  const columns = contactSheetColumns(totalCount);
  const gap = GAP[columns];
  const tileWidth = Math.floor((width - spacing.lg * 2 - gap * (columns - 1)) / columns);
  const review = isReviewStage(stage);
  const selecting = selection !== null;
  const layout = reduceMotion ? undefined : LinearTransition.duration(220);
  const showFilter = review && checkCount > 0 && !selecting;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.masthead, !showFilter && styles.ruled]}>
        <Text style={styles.title} accessibilityRole="header">
          {selecting ? (selection.size === 0 ? 'Select pieces' : `${pieceCountLabel(selection.size)} selected`) : pieceCountLabel(totalCount)}
        </Text>
        {/* One line of state, one of guidance — never a tip card. The hint's
            real job is saying that opening every piece is optional. */}
        <View style={styles.subRow}>
          <View style={styles.subCopy}>
            {selecting ? (
              <Text style={styles.hint}>Tap pieces to add them to the selection.</Text>
            ) : (
              <>
                {guidance.lead ? <Text style={styles.lead}>{guidance.lead}</Text> : null}
                <Text style={styles.hint}>{guidance.hint}</Text>
              </>
            )}
          </View>
          <View style={styles.controlsEnd}>
            {selecting ? (
              <>
                <TextLink label="Select all" onPress={onSelectAll} disabled={disabled} />
                <Middot />
                <TextLink label="Done" onPress={onEndSelect} />
              </>
            ) : (
              <TextLink label="Select" onPress={() => onStartSelect()} disabled={disabled} />
            )}
          </View>
        </View>
      </View>

      {showFilter ? (
        <View style={[styles.controls, styles.ruled]}>
          <TextSegment
            options={[
              { value: 'all' as const, label: 'All' },
              { value: 'check' as const, label: `To check · ${checkCount}` },
            ]}
            value={filter}
            onChange={onFilterChange}
            accessibilityLabel="Filter pieces"
          />
        </View>
      ) : null}

      <View style={[styles.grid, { gap }]}>
        {pieces.map((piece, index) => (
          <Animated.View
            key={piece.id}
            layout={layout}
            entering={reduceMotion ? undefined : FadeIn.duration(180)}
            exiting={reduceMotion ? undefined : FadeOut.duration(160)}
            style={{ width: tileWidth }}
          >
            <PieceTile
              piece={piece}
              index={index}
              count={pieces.length}
              stage={stage}
              state={review ? states[piece.id] ?? 'ready' : null}
              width={tileWidth}
              compact={columns === 3}
              selected={selection?.has(piece.id) ?? false}
              selecting={selecting}
              disabled={disabled}
              onPress={() => (selecting ? onToggleSelect(piece.id) : onOpen(piece.id))}
              onLongPress={() => (selecting ? onToggleSelect(piece.id) : onStartSelect(piece.id))}
            />
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

function PieceTile({ piece, index, count, stage, state, width, compact, selected, selecting, disabled, onPress, onLongPress }: {
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
  onLongPress: () => void;
}) {
  const uri = coverUri(piece, stage);
  const isCutout = uri !== null && uri === piece.cutout;
  const plateHeight = Math.round(width / editorial.garmentAspectRatio);
  const inset = isCutout ? `${Math.round(cutoutScaleFor(piece.category) * 100)}%` as const : '100%' as const;
  // After extraction the sheet is a lookbook, so crops fill their plate
  // evenly. Before it, the whole crop has to show — judging it is the job.
  const fit = isCutout || !isReviewStage(stage) ? 'contain' : 'cover';
  const stateLabel = state === 'check' ? ', worth a look' : state === 'confirmed' ? ', confirmed' : '';

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      disabled={disabled}
      scaleTo={0.97}
      motion="crisp"
      haptic={false}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
      accessibilityLabel={`${piece.brand ? `${piece.brand}, ` : ''}${piece.name || 'Unnamed piece'}, ${index + 1} of ${count}${stateLabel}`}
      accessibilityHint={selecting ? undefined : 'Opens the piece. Long press to select several.'}
    >
      <View style={[styles.plate, { height: plateHeight }, selected && styles.plateSelected]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: inset, height: inset }}
            contentFit={fit}
            cachePolicy="memory-disk"
            recyclingKey={`tile-${piece.id}-${isCutout ? 'c' : 'p'}`}
            transition={120}
          />
        ) : (
          <Ionicons name="shirt-outline" size={28} color={colors.mutedForeground} />
        )}
        {/* Marks sit on a small canvas-coloured disc so they read on a navy
            tie as well as on a cream knit. */}
        {state === 'check' ? <View style={[styles.cornerMark, styles.markDisc]}><FlagDot size={7} /></View> : null}
        {state === 'confirmed' ? (
          <View style={[styles.cornerMark, styles.markDisc]}><Ionicons name="checkmark" size={12} color={colors.foreground} /></View>
        ) : null}
        {selecting ? (
          <View style={[styles.selectRing, selected && styles.selectRingOn]}>
            {selected ? <Ionicons name="checkmark" size={12} color={colors.primaryForeground} /> : null}
          </View>
        ) : null}
      </View>
      <View style={styles.caption}>
        <Text style={[styles.brand, !piece.brand && styles.brandEmpty]} numberOfLines={1}>
          {piece.brand || '—'}
        </Text>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={compact ? 2 : 1}>
          {piece.name || 'Unnamed piece'}
        </Text>
      </View>
    </PressableScale>
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
  selectRing: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
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
