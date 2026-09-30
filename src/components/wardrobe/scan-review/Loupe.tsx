import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  loupeHeroHeight,
  pieceFlags,
  reviewCarouselIndex,
  reviewCarouselMetrics,
  type PieceReviewState,
} from '../../../lib/scan-review';
import { colors, cutoutScaleFor, radii, spacing, surfaces } from '../../../theme';
import { IndexScrubber } from './IndexScrubber';
import { SpecSheet, type ExpandableRow, type SheetKind } from './SpecSheet';
import { Middot, TextLink, TextSegment } from './atoms';
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
};

/**
 * One piece at a time, large. Two ways to travel — swipe the plate or drag
 * the tick rail — and both drive the same offset, so there is nothing to keep
 * in sync.
 */
export function Loupe({
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
  onToggleCutout,
  onToggleIncluded,
}: Props) {
  const { width, height } = useWindowDimensions();
  const metrics = useMemo(() => reviewCarouselMetrics(width), [width]);
  const heroHeight = loupeHeroHeight(height);
  const carouselRef = useRef<FlatList<ScanReviewPiece>>(null);
  const scrollRef = useRef<ScrollView>(null);
  const ids = useMemo(() => pieces.map((piece) => piece.id), [pieces]);
  const activeIndex = Math.max(0, ids.indexOf(activeId));
  const active = pieces[activeIndex] ?? null;
  const review = isReviewStage(stage);

  const initialIndex = useRef(activeIndex).current;
  const scrollX = useSharedValue(initialIndex * metrics.snapInterval);
  const trackedIndex = useSharedValue(initialIndex);
  const dragging = useSharedValue(false);
  // The next programmatic move should jump, not glide — set by the scrubber,
  // where the finger is already doing the travelling.
  const jumpNext = useRef(false);
  const [expandedRow, setExpandedRow] = useState<ExpandableRow | null>(null);

  useEffect(() => { setExpandedRow(null); }, [activeId]);

  // Parent-driven moves ("Looks right" → next flagged, the scrubber, a
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
    if (fromDrag) void Haptics.selectionAsync();
    onActiveChange(piece.id);
  }, [onActiveChange, pieces]);

  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => { dragging.value = true; },
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      if (metrics.snapInterval <= 0 || pieces.length === 0) return;
      const index = Math.min(pieces.length - 1, Math.max(0, Math.round(event.contentOffset.x / metrics.snapInterval)));
      if (index !== trackedIndex.value) {
        trackedIndex.value = index;
        runOnJS(selectIndex)(index, dragging.value);
      }
    },
    onMomentumEnd: () => { dragging.value = false; },
  }, [metrics.snapInterval, pieces.length, selectIndex]);

  // Backstop for a short drag that springs back without a halfway crossing.
  const onMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = reviewCarouselIndex(event.nativeEvent.contentOffset.x, metrics.snapInterval, pieces.length);
    const piece = pieces[index];
    if (piece && piece.id !== activeId) onActiveChange(piece.id);
  }, [activeId, metrics.snapInterval, onActiveChange, pieces]);

  const seek = useCallback((index: number) => {
    const piece = pieces[index];
    if (!piece || piece.id === activeId) return;
    void Haptics.selectionAsync();
    jumpNext.current = true;
    onActiveChange(piece.id);
  }, [activeId, onActiveChange, pieces]);

  // The panel leaves with the outgoing plate, swaps at the halfway point
  // where it is nearly invisible, and settles under the incoming one.
  const coupledStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1, transform: [{ translateX: 0 }] };
    const half = Math.max(1, metrics.snapInterval / 2);
    const delta = scrollX.value - trackedIndex.value * metrics.snapInterval;
    const clamped = Math.max(-half, Math.min(half, delta));
    return {
      opacity: 1 - (Math.abs(clamped) / half) * 0.8,
      transform: [{ translateX: -clamped * 0.5 }],
    };
  }, [metrics.snapInterval, reduceMotion]);

  const scrubberStates = useMemo(() => pieces.map((piece) => (review ? states[piece.id] ?? 'ready' : null)), [pieces, review, states]);
  const thumbs = useMemo(() => pieces.map((piece) => coverUri(piece, stage)), [pieces, stage]);

  if (!active) return null;
  const canCrop = active.canAdjustCrop && Boolean(active.cropSource && active.cropBbox);
  const hasCutout = review && Boolean(active.cutout);

  return (
    <ScrollView
      ref={scrollRef}
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
        onMomentumScrollEnd={onMomentumEnd}
        onScrollToIndexFailed={({ index }) => {
          carouselRef.current?.scrollToOffset({ offset: index * metrics.snapInterval, animated: false });
        }}
        renderItem={({ item, index }) => (
          <LoupeHero
            piece={item}
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

      {pieces.length > 1 ? (
        <IndexScrubber
          count={pieces.length}
          activeIndex={activeIndex}
          states={scrubberStates}
          thumbs={thumbs}
          onSeek={seek}
          disabled={disabled}
        />
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg }}>
        <TextLink label="Previous" disabled={disabled || activeIndex === 0} onPress={() => seek(activeIndex - 1)} />
        <TextLink label="Next" disabled={disabled || activeIndex === pieces.length - 1} onPress={() => seek(activeIndex + 1)} />
      </View>
      <Animated.View style={[styles.utilities, coupledStyle]}>
        {canCrop ? <TextLink label="Crop" onPress={() => onCrop(active.id)} disabled={disabled} accessibilityLabel={`Adjust crop for ${active.name}`} /> : null}
        {canCrop && hasCutout ? <Middot /> : null}
        {hasCutout ? (
          <TextSegment
            options={[{ value: 'cutout' as const, label: 'Cutout' }, { value: 'photo' as const, label: 'Original' }]}
            value={active.useCutout ? 'cutout' : 'photo'}
            onChange={() => onToggleCutout(active.id)}
            disabled={disabled}
            accessibilityLabel="Cover image"
          />
        ) : null}
        <View style={styles.spacer} />
        <Pressable style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} onPress={() => onToggleIncluded(active.id)} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: active.included !== false, disabled }} accessibilityLabel="Include this piece">
          <Ionicons name={active.included !== false ? 'checkbox' : 'square-outline'} size={22} color={colors.foreground} /><Text>Include this piece</Text>
        </Pressable>
      </Animated.View>

      <Animated.View style={coupledStyle}>
        <SpecSheet
          piece={active}
          stage={active.extraction === 'not-started' || active.extraction === 'failed' ? 'pre-extract' : stage}
          // A confirmed piece has been looked at; its field marks retire with it.
          flags={states[active.id] === 'confirmed' ? [] : pieceFlags(active)}
          expandedRow={expandedRow}
          disabled={disabled}
          onExpand={(row) => {
            setExpandedRow(row);
            // The expandable rows sit at the foot of the sheet; bring what
            // just opened into view instead of leaving it under the bar.
            if (row) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: !reduceMotion }), 220);
          }}
          onUpdate={(patch) => onUpdate(active.id, patch)}
          onOpenSheet={(kind) => onOpenSheet(kind, active.id)}
          onNameFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: heroHeight * 0.6, animated: !reduceMotion }), 120)}
        />
      </Animated.View>
    </ScrollView>
  );
}

function LoupeHero({ piece, index, stage, width, height, gap, snapInterval, scrollX, reduceMotion }: {
  piece: ScanReviewPiece;
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
  const scale = isCutout ? cutoutScaleFor(piece.category) : 1;

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
    <Animated.View
      style={[
        styles.hero,
        !isReviewStage(stage) && styles.heroPreExtract,
        isCutout && styles.heroCutout,
        { width, height, marginRight: gap },
        parallax,
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  utilities: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, minHeight: 36 },
  spacer: { flex: 1 },
});
