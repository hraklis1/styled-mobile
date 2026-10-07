import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { scheduleOnRN } from 'react-native-worklets';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { selectionFeedback } from './feedback';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  pieceFlags,
  reviewCarouselMetrics,
  type PieceReviewState,
} from '../../../lib/scan-review';
import { colors, cutoutScaleFor, ingestion, radii, spacing, surfaces, typography } from '../../../theme';
import { SpecSheet, type ExpandableRow, type SheetKind } from './SpecSheet';
import { TextSegment } from './atoms';
import { SelectBadge } from './SelectBadge';
import { coverUri, isReviewStage, type PiecePatch, type ScanReviewPiece, type ScanReviewStage } from './types';

type Props = {
  pieces: ScanReviewPiece[];
  stage: ScanReviewStage;
  states: Readonly<Record<string, PieceReviewState>>;
  activeId: string;
  disabled: boolean;
  reduceMotion: boolean;
  bottomPadding: number;
  onActiveChange: (id: string) => void;
  onUpdate: (id: string, patch: PiecePatch) => void;
  onOpenSheet: (kind: SheetKind, id: string) => void;
  onCrop: (id: string) => void;
  onToggleCutout: (id: string) => void;
  onToggleIncluded: (id: string) => void;
  footerHeight: number;
};

/**
 * Shared inspection content within the workspace modal. Swipe navigation
 * commits metadata targets when the page settles.
 */
export function ItemInspectionModal({
  pieces,
  stage,
  states,
  activeId,
  disabled,
  reduceMotion,
  bottomPadding,
  onActiveChange,
  onUpdate,
  onOpenSheet,
  onCrop,
  onToggleCutout, onToggleIncluded,
  footerHeight,
}: Props) {
  const { width, height: windowHeight } = useWindowDimensions();
  const metrics = useMemo(() => reviewCarouselMetrics(width), [width]);
  // 3:4 where it fits, but never so tall that the brand row falls below the fold.
  const heroHeight = Math.min(metrics.cardWidth * 4 / 3, Math.round(windowHeight * 0.44));
  const scrollRef = useRef<{ scrollTo: (options: { y: number; animated?: boolean }) => void } | null>(null);
  const carouselRef = useRef<FlatList<ScanReviewPiece>>(null);
  const ids = useMemo(() => pieces.map((piece) => piece.id), [pieces]);
  const activeIndex = Math.max(0, ids.indexOf(activeId));
  const active = pieces[activeIndex] ?? null;
  const review = isReviewStage(stage);

  const initialIndex = useRef(activeIndex).current;
  const scrollX = useSharedValue(initialIndex * metrics.snapInterval);
  const trackedIndex = useSharedValue(initialIndex);
  const dragging = useSharedValue(false);
  const dragStartIndex = useSharedValue(initialIndex);
  // Accessible paging jumps directly; automatic review navigation may animate.
  const jumpNext = useRef(false);
  const [paging, setPaging] = useState(false);
  const [expandedRow, setExpandedRow] = useState<ExpandableRow | null>(null);
  // The page under the viewport's centre while swiping. The metadata follows it
  // as soon as the swipe crosses the midpoint (where it is faded furthest), so
  // the next piece's details are ready before the snap settles; the parent only
  // hears about the move once the page comes to rest.
  const [previewIndex, setPreviewIndex] = useState(activeIndex);
  const shownIndex = paging ? Math.min(previewIndex, pieces.length - 1) : activeIndex;
  const shown = pieces[shownIndex] ?? active;

  useEffect(() => { setPreviewIndex(activeIndex); }, [activeIndex]);
  useEffect(() => { setExpandedRow(null); }, [activeId, shownIndex]);

  // A flagged piece opens with its spec rows in view, so the flagged field
  // (often Material or Details, below the hero) is what the eye lands on.
  const activeFlagged = states[activeId] === 'check';
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: activeFlagged ? Math.max(0, heroHeight - 96) : 0, animated: !reduceMotion }), 220);
    return () => clearTimeout(timer);
  }, [activeId, activeFlagged, heroHeight, reduceMotion]);

  // Parent-driven moves ("Confirm & next" → next flagged, accessible paging, a
  // removal): scroll the pager to wherever the active piece now sits.
  useEffect(() => {
    const index = ids.indexOf(activeId);
    if (index < 0 || index === trackedIndex.value) return;
    trackedIndex.value = index;
    dragging.value = false;
    const animated = !reduceMotion && !jumpNext.current;
    jumpNext.current = false;
    carouselRef.current?.scrollToOffset({ offset: index * metrics.snapInterval, animated });
    if (!animated) scrollX.value = index * metrics.snapInterval;
  }, [activeId, dragging, ids, metrics.snapInterval, reduceMotion, scrollX, trackedIndex]);

  const selectIndex = useCallback((index: number, fromDrag: boolean) => {
    const piece = pieces[index];
    if (!piece) return;
    setPaging(false);
    if (fromDrag) selectionFeedback();
    onActiveChange(piece.id);
  }, [onActiveChange, pieces]);

  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => { scheduleOnRN(setPaging, true); dragging.value = true; dragStartIndex.value = trackedIndex.value; },
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      if (metrics.snapInterval <= 0 || pieces.length === 0) return;
      const index = Math.min(pieces.length - 1, Math.max(0, Math.round(event.contentOffset.x / metrics.snapInterval)));
      if (index !== trackedIndex.value) {
        trackedIndex.value = index;
        scheduleOnRN(setPreviewIndex, index);
      }
    },
    onEndDrag: (event) => {
      if (!event.velocity?.x) {
        const index = Math.min(pieces.length - 1, Math.max(0, Math.round(event.contentOffset.x / metrics.snapInterval)));
        scheduleOnRN(selectIndex, index, dragging.value && index !== dragStartIndex.value);
        dragging.value = false;
      }
    },
    onMomentumEnd: (event) => {
      const index = Math.min(pieces.length - 1, Math.max(0, Math.round(event.contentOffset.x / metrics.snapInterval)));
      scheduleOnRN(selectIndex, index, dragging.value && index !== dragStartIndex.value);
      dragging.value = false;
    },
  }, [metrics.snapInterval, pieces.length, selectIndex]);

  const seek = useCallback((index: number) => {
    const piece = pieces[index];
    if (!piece || piece.id === activeId) return;
    selectionFeedback();
    jumpNext.current = true;
    onActiveChange(piece.id);
  }, [activeId, onActiveChange, pieces]);

  // Quiet the metadata while the image moves; editing is disabled until settled.
  const coupledStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1, transform: [{ translateX: 0 }] };
    const half = Math.max(1, metrics.snapInterval / 2);
    const delta = scrollX.value - shownIndex * metrics.snapInterval;
    const clamped = Math.max(-half, Math.min(half, delta));
    return {
      opacity: 1 - (Math.abs(clamped) / half) * 0.8,
      transform: [{ translateX: -clamped * 0.5 }],
    };
  }, [shownIndex, metrics.snapInterval, reduceMotion]);

  if (!active || !shown) return null;

  return (
    <KeyboardAwareScrollView
      ref={scrollRef as never}
      bottomOffset={footerHeight + spacing.md}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <Animated.FlatList
        ref={carouselRef}
        data={pieces}
        keyExtractor={(item) => item.id}
        horizontal
        bounces={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToInterval={metrics.snapInterval}
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        contentContainerStyle={{ paddingHorizontal: metrics.sidePadding }}
        getItemLayout={(_, index) => ({ length: metrics.snapInterval, offset: metrics.snapInterval * index, index })}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollToIndexFailed={({ index }) => {
          carouselRef.current?.scrollToOffset({ offset: index * metrics.snapInterval, animated: false });
        }}
        renderItem={({ item, index }) => (
          <LoupeHero
            piece={item}
            disabled={disabled || paging}
            onCrop={() => onCrop(item.id)}
            onToggleIncluded={() => onToggleIncluded(item.id)}
            onToggleCutout={review && item.cutout ? () => onToggleCutout(item.id) : null}
            index={index}
            stage={stage}
            width={metrics.cardWidth}
            height={heroHeight}
            gap={metrics.gap}
            snapInterval={metrics.snapInterval}
            scrollX={scrollX}
            reduceMotion={reduceMotion}
          />
        )}
      />

      {pieces.length > 1 ? <View style={styles.dots} accessible accessibilityRole="adjustable"
        accessibilityLabel={`Piece ${activeIndex + 1} of ${pieces.length}`}
        accessibilityValue={{ min: 1, max: pieces.length, now: activeIndex + 1 }}
        accessibilityActions={[{ name: 'increment', label: 'Next piece' }, { name: 'decrement', label: 'Previous piece' }]}
        onAccessibilityAction={event => {
          if (!disabled && !paging) seek(Math.max(0, Math.min(pieces.length - 1, activeIndex + (event.nativeEvent.actionName === 'increment' ? 1 : -1))));
        }}>
        {Array.from({ length: Math.min(7, pieces.length) }, (_, slot) => (
          <InspectionPageDot key={slot} slot={slot} count={pieces.length} index={trackedIndex} />
        ))}
      </View> : null}

      <Animated.View style={coupledStyle}>
        <SpecSheet
          piece={shown}
          stage={shown.extraction === 'not-started' || shown.extraction === 'failed' ? 'pre-extract' : stage}
          // A confirmed piece has been looked at; its field marks retire with it.
          flags={states[shown.id] === 'confirmed' ? [] : pieceFlags(shown)}
          expandedRow={expandedRow}
          disabled={disabled || paging}
          onExpand={setExpandedRow}
          onUpdate={(patch) => onUpdate(shown.id, patch)}
          onOpenSheet={(kind) => onOpenSheet(kind, shown.id)}
        />
      </Animated.View>
    </KeyboardAwareScrollView>
  );
}

/** Visual position follows the UI-thread scroll index, independently of editable metadata. */
function InspectionPageDot({ slot, count, index }: { slot: number; count: number; index: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const current = Math.max(0, Math.min(count - 1, index.value));
    const start = Math.max(0, Math.min(current - 3, count - 7));
    const active = start + slot === current;
    return {
      backgroundColor: active ? colors.foreground : colors.border,
      transform: [{ scale: active ? 1 : 5 / 6 }],
    };
  }, [count, slot]);
  return <Animated.View testID={`inspection-page-dot-${slot}`} style={[styles.dot, style]} />;
}

function LoupeHero({ piece, disabled, onCrop, onToggleIncluded, onToggleCutout, index, stage, width, height, gap, snapInterval, scrollX, reduceMotion }: {
  piece: ScanReviewPiece;
  disabled: boolean;
  onCrop: () => void;
  onToggleIncluded: () => void;
  /** Present only once a cutout exists to switch to. */
  onToggleCutout: (() => void) | null;
  index: number;
  stage: ScanReviewStage;
  width: number;
  height: number;
  gap: number;
  snapInterval: number;
  scrollX: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const uri = coverUri(piece, stage);
  const isCutout = uri !== null && uri === piece.cutout;
  const canCrop = Boolean(piece.canAdjustCrop && piece.cropSource && piece.cropBbox);
  const scale = isCutout ? cutoutScaleFor(piece.category) : ingestion.printInset;

  // Neighbours wait a step back — slightly smaller and quieter — and come
  // forward as they slide into the centre.
  const parallax = useAnimatedStyle(() => {
    if (reduceMotion || snapInterval <= 0) return { opacity: 1, transform: [{ scale: 1 }] };
    const distance = Math.min(1, Math.abs(scrollX.value - index * snapInterval) / snapInterval);
    return {
      opacity: interpolate(distance, [0, 1], [1, 0.55]),
      transform: [{ scale: interpolate(distance, [0, 1], [1, 0.94]) }],
    };
  }, [index, reduceMotion, snapInterval]);

  return (
    <Animated.View style={[{ width, marginRight: gap }, parallax]}>
    <View
      style={[
        styles.hero,
        !isReviewStage(stage) && styles.heroPreExtract,
        isCutout && styles.heroCutout,
        { width, height },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: `${scale * 100}%`, height: `${scale * 100}%` }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={`${piece.id}-${isCutout ? 'cutout' : 'photo'}`}
          transition={150}
          accessibilityLabel={`Photo of ${piece.name}`}
        />
      ) : (
        <Ionicons name="shirt-outline" size={54} color={colors.mutedForeground} />
      )}
      <SelectBadge checked={piece.included !== false} onPress={onToggleIncluded} disabled={disabled} reduceMotion={reduceMotion}
        accessibilityLabel={`Include ${piece.name}`} style={styles.badge} />
    </View>
      {/* Image tools sit under the photo, never over the garment. */}
      {canCrop || onToggleCutout ? (
        <View style={styles.capsule}>
          {canCrop ? (
            <Pressable onPress={onCrop} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Adjust crop for ${piece.name}`}
              style={({ pressed }) => [styles.capsuleItem, pressed && { opacity: 0.6 }]}>
              <Ionicons name="crop-outline" size={17} color={colors.foreground} />
              <Text style={styles.capsuleText}>Crop</Text>
            </Pressable>
          ) : null}
          {canCrop && onToggleCutout ? <View style={styles.capsuleRule} /> : null}
          {onToggleCutout ? (
            <View style={styles.capsuleItem}>
              <TextSegment
                options={[{ value: 'cutout' as const, label: 'Cutout' }, { value: 'photo' as const, label: 'Original' }]}
                value={piece.useCutout ? 'cutout' : 'photo'}
                onChange={onToggleCutout}
                disabled={disabled}
                accessibilityLabel="Cover image"
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dots: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  badge: { position: 'absolute', top: spacing.xs, right: spacing.xs },
  capsule: { minHeight: 44, marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  capsuleItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  capsuleRule: { width: 1, height: 16, backgroundColor: colors.controlOutline },
  capsuleText: { ...typography.text.label, color: colors.foreground },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.md, gap: spacing.sm },
  hero: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.photo,
    backgroundColor: surfaces.plate,
  },
  // Before extraction the job is judging the crop, so the plate steps a
  // shade darker and the crop's own edges stay visible against it.
  heroPreExtract: { backgroundColor: colors.surfaceSelected },
  heroCutout: { backgroundColor: colors.card },
});
