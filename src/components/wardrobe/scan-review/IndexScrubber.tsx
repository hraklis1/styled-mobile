import { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { scrubberIndex, type PieceReviewState } from '../../../lib/scan-review';
import { colors, radii, spacing, stroke, surfaces } from '../../../theme';

const RAIL_HEIGHT = 44;
const PREVIEW = 56;

/**
 * A rule of hairline ticks, one per piece: the scan's table of contents at a
 * glance, and a way to travel it by dragging. It replaces the thumbnail strip
 * that used to sit between the hero and the form — the same job in a fifth
 * of the height, and one navigation model instead of two.
 */
export function IndexScrubber({ count, activeIndex, states, thumbs, onSeek, disabled }: {
  count: number;
  activeIndex: number;
  /** Per index; null outside review, where nothing is flagged yet. */
  states: (PieceReviewState | null)[];
  thumbs: (string | null)[];
  onSeek: (index: number) => void;
  disabled?: boolean;
}) {
  const [railWidth, setRailWidth] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const lastIndex = useSharedValue(activeIndex);
  const fingerX = useSharedValue(0);
  const width = useSharedValue(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setRailWidth(next);
    width.value = next;
  }, [width]);

  const seek = useCallback((index: number) => {
    setPreview(index);
    onSeek(index);
  }, [onSeek]);

  const pan = Gesture.Pan()
    .enabled(!disabled && count > 1)
    .minDistance(0)
    .hitSlop({ vertical: 10 })
    .onBegin((event) => {
      fingerX.value = event.x;
      const index = scrubberIndex(event.x, width.value, count);
      lastIndex.value = index;
      runOnJS(seek)(index);
    })
    .onUpdate((event) => {
      fingerX.value = event.x;
      const index = scrubberIndex(event.x, width.value, count);
      if (index !== lastIndex.value) {
        lastIndex.value = index;
        runOnJS(seek)(index);
      }
    })
    .onFinalize(() => {
      runOnJS(setPreview)(null);
    });

  const previewStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(0, Math.min(width.value - PREVIEW, fingerX.value - PREVIEW / 2)) }],
  }));

  const slot = count > 0 ? railWidth / count : 0;
  const previewUri = preview !== null ? thumbs[preview] ?? null : null;

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Piece"
      accessibilityValue={{ min: 1, max: count, now: activeIndex + 1, text: `${activeIndex + 1} of ${count}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') onSeek(Math.min(count - 1, activeIndex + 1));
        if (event.nativeEvent.actionName === 'decrement') onSeek(Math.max(0, activeIndex - 1));
      }}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.rail} onLayout={onLayout}>
          {railWidth > 0 ? Array.from({ length: count }, (_, index) => {
            const active = index === activeIndex;
            const state = states[index];
            return (
              <View key={index} style={[styles.slot, { left: index * slot, width: slot }]}>
                <View style={[styles.tick, active && styles.tickActive, state === 'confirmed' && !active && styles.tickConfirmed]} />
                {state === 'check' ? <View style={styles.tickFlag} /> : null}
              </View>
            );
          }) : null}
        </View>
      </GestureDetector>
      {preview !== null ? (
        <Animated.View style={[styles.preview, previewStyle]} pointerEvents="none">
          {previewUri ? <Image source={{ uri: previewUri }} style={styles.previewImage} contentFit="contain" cachePolicy="memory-disk" /> : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.lg, height: RAIL_HEIGHT, justifyContent: 'center' },
  rail: { height: RAIL_HEIGHT },
  slot: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  tick: { width: stroke.fine, height: 10, backgroundColor: colors.controlOutline, opacity: 0.55 },
  tickConfirmed: { opacity: 1 },
  tickActive: { width: 2, height: 18, opacity: 1, backgroundColor: colors.foreground },
  tickFlag: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentInk,
  },
  preview: {
    position: 'absolute',
    left: 0,
    bottom: RAIL_HEIGHT + spacing.xs,
    width: PREVIEW,
    height: Math.round(PREVIEW * 4 / 3),
    borderRadius: radii.photo,
    backgroundColor: surfaces.plate,
    borderWidth: stroke.hairline,
    borderColor: colors.hairline,
    boxShadow: '0 6px 18px rgba(36,36,34,0.14)',
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
});
