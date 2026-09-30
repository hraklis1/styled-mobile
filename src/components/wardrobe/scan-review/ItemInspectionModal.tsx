import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, Pressable, Text, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
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
import { colors, cutoutScaleFor, radii, spacing, surfaces, typography } from '../../../theme';
import { SpecSheet, type ExpandableRow, type SheetKind } from './SpecSheet';
import { TextSegment } from './atoms';
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
  const { width } = useWindowDimensions();
  const metrics = useMemo(() => reviewCarouselMetrics(width), [width]);
  const heroHeight = metrics.cardWidth * 4 / 3;
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

  useEffect(() => { setExpandedRow(null); }, [activeId]);

  // Parent-driven moves ("Looks right" → next flagged, accessible paging, a
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
    const delta = scrollX.value - activeIndex * metrics.snapInterval;
    const clamped = Math.max(-half, Math.min(half, delta));
    return {
      opacity: 1 - (Math.abs(clamped) / half) * 0.8,
      transform: [{ translateX: -clamped * 0.5 }],
    };
  }, [activeIndex, metrics.snapInterval, reduceMotion]);

  if (!active) return null;
  const hasCutout = review && Boolean(active.cutout);

  return (
    <KeyboardAwareScrollView
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
        {Array.from({ length: Math.min(7, pieces.length) }, (_, offset) => {
          const index = Math.max(0, Math.min(activeIndex - 3, pieces.length - 7)) + offset;
          return <View key={index} style={[styles.dot, index === activeIndex && styles.activeDot]} />;
        })}
      </View> : null}

      <Pressable accessibilityRole="switch" accessibilityLabel="Include this piece"
        accessibilityState={{ checked: active.included !== false, disabled: disabled || paging }}
        disabled={disabled || paging} onPress={() => onToggleIncluded(active.id)} style={styles.status}>
        <Ionicons name={active.included !== false ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={colors.foreground} />
        <Text style={styles.cropText}>{active.included !== false ? 'Included' : 'Skipped'}</Text>
      </Pressable>
      <Animated.View style={[styles.utilities, coupledStyle]}>
        {hasCutout ? (
          <TextSegment
            options={[{ value: 'cutout' as const, label: 'Cutout' }, { value: 'photo' as const, label: 'Original' }]}
            value={active.useCutout ? 'cutout' : 'photo'}
            onChange={() => onToggleCutout(active.id)}
            disabled={disabled || paging}
            accessibilityLabel="Cover image"
          />
        ) : null}
        <View style={styles.spacer} />

      </Animated.View>

      <Animated.View style={coupledStyle}>
        <SpecSheet
          piece={active}
          stage={active.extraction === 'not-started' || active.extraction === 'failed' ? 'pre-extract' : stage}
          // A confirmed piece has been looked at; its field marks retire with it.
          flags={states[active.id] === 'confirmed' ? [] : pieceFlags(active)}
          expandedRow={expandedRow}
          disabled={disabled || paging}
          onExpand={setExpandedRow}
          onUpdate={(patch) => onUpdate(active.id, patch)}
          onOpenSheet={(kind) => onOpenSheet(kind, active.id)}
        />
      </Animated.View>
    </KeyboardAwareScrollView>
  );
}

function LoupeHero({ piece, disabled, onCrop, index, stage, width, height, gap, snapInterval, scrollX, reduceMotion }: {
  piece: ScanReviewPiece;
  disabled: boolean;
  onCrop: () => void;
  index: number;
  stage: ScanReviewStage;
  width: number;
  height: number;
  gap: number;
  snapInterval: number;
  scrollX: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const [opaque, setOpaque] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setOpaque);
    const listener = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setOpaque);
    return () => listener.remove();
  }, []);
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
          contentFit={isCutout ? "contain" : "cover"}
          cachePolicy="memory-disk"
          recyclingKey={`${piece.id}-${isCutout ? 'cutout' : 'photo'}`}
          transition={150}
          accessibilityLabel={`Photo of ${piece.name}`}
        />
      ) : (
        <Ionicons name="shirt-outline" size={54} color={colors.mutedForeground} />
      )}
      {piece.canAdjustCrop && piece.cropSource && piece.cropBbox ? (
        <Pressable onPress={onCrop} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Adjust crop for ${piece.name}`}
          style={({ pressed }) => [styles.crop, { backgroundColor: opaque ? colors.background : 'rgba(246,245,242,0.45)' }, pressed && { backgroundColor: colors.surfaceSelected }]}>
          {!opaque ? <BlurView pointerEvents="none" tint="light" intensity={45} style={StyleSheet.absoluteFill} /> : null}
          <Ionicons name="crop-outline" size={18} color={colors.foreground} />
          <Text style={styles.cropText}>Crop</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dots: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border },
  activeDot: { backgroundColor: colors.foreground, width: 6, height: 6 },
  status: { alignSelf: 'flex-start', marginHorizontal: spacing.lg, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  crop: { overflow: 'hidden', position: 'absolute', bottom: spacing.md, right: spacing.md, minHeight: 44, minWidth: 44, paddingHorizontal: spacing.lg, borderRadius: radii.full, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cropText: { ...typography.text.label, color: colors.foreground },
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
