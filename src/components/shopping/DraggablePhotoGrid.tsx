import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Dimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function triggerHaptic() {
  void Haptics.selectionAsync();
}

/**
 * A flex-wrap-style photo grid where tiles can be picked up with a long
 * press and dragged to a new slot. Positions are computed in JS (not
 * flexbox) so a tile's rest position can be animated independently while
 * it's being dragged. `onTap` and drag are arbitrated with Gesture.Race so
 * a quick tap still selects while a held-and-moved tile reorders.
 */
export function DraggablePhotoGrid({
  ids,
  onReorder,
  onTap,
  renderPhoto,
  renderChip,
  disabled,
  tileWidth,
  tileHeight,
  photoHeight,
  innerGap,
  gap,
}: {
  ids: string[];
  onReorder: (nextIds: string[]) => void;
  onTap?: (id: string) => void;
  renderPhoto: (id: string) => ReactNode;
  renderChip: (id: string) => ReactNode;
  disabled?: boolean;
  tileWidth: number;
  tileHeight: number;
  photoHeight: number;
  innerGap: number;
  gap: number;
}) {
  const [containerWidth, setContainerWidth] = useState(
    () => Math.max(tileWidth, Dimensions.get('window').width - 96),
  );
  const columns = Math.max(1, Math.floor((containerWidth + gap) / (tileWidth + gap)));
  const rows = Math.max(1, Math.ceil(ids.length / columns));

  const handleMove = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      onReorder(arrayMove(ids, from, to));
    },
    [ids, onReorder],
  );

  return (
    <View style={{ width: '100%' }} onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
      <View style={{ height: rows * tileHeight + (rows - 1) * gap }}>
        {ids.map((id, index) => (
          <DraggableTile
            key={id}
            id={id}
            index={index}
            count={ids.length}
            columns={columns}
            tileWidth={tileWidth}
            tileHeight={tileHeight}
            photoHeight={photoHeight}
            innerGap={innerGap}
            gap={gap}
            disabled={Boolean(disabled)}
            onMove={handleMove}
            onTap={onTap}
            photo={renderPhoto(id)}
            chip={renderChip(id)}
          />
        ))}
      </View>
    </View>
  );
}

function DraggableTile({
  id,
  index,
  count,
  columns,
  tileWidth,
  tileHeight,
  photoHeight,
  innerGap,
  gap,
  disabled,
  onMove,
  onTap,
  photo,
  chip,
}: {
  id: string;
  index: number;
  count: number;
  columns: number;
  tileWidth: number;
  tileHeight: number;
  photoHeight: number;
  innerGap: number;
  gap: number;
  disabled: boolean;
  onMove: (from: number, to: number) => void;
  onTap?: (id: string) => void;
  photo: ReactNode;
  chip: ReactNode;
}) {
  const restX = (index % columns) * (tileWidth + gap);
  const restY = Math.floor(index / columns) * (tileHeight + gap);

  const translateX = useSharedValue(restX);
  const translateY = useSharedValue(restY);
  const scale = useSharedValue(1);
  const isActive = useSharedValue(false);
  const startX = useSharedValue(restX);
  const startY = useSharedValue(restY);
  const currentIndex = useSharedValue(index);

  useEffect(() => {
    currentIndex.value = index;
    if (!isActive.value) {
      translateX.value = withTiming((index % columns) * (tileWidth + gap), { duration: 220 });
      translateY.value = withTiming(Math.floor(index / columns) * (tileHeight + gap), { duration: 220 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, columns, tileWidth, tileHeight, gap]);

  const tap = Gesture.Tap()
    .enabled(!disabled && Boolean(onTap))
    .maxDuration(200)
    .onEnd((_event, success) => {
      if (success && onTap) runOnJS(onTap)(id);
    });

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(250)
    .onStart(() => {
      isActive.value = true;
      startX.value = translateX.value;
      startY.value = translateY.value;
      scale.value = withTiming(1.06, { duration: 120 });
      runOnJS(triggerHaptic)();
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;

      const col = Math.min(columns - 1, Math.max(0, Math.round(translateX.value / (tileWidth + gap))));
      const row = Math.max(0, Math.round(translateY.value / (tileHeight + gap)));
      const targetIndex = Math.min(count - 1, row * columns + col);

      if (targetIndex !== currentIndex.value) {
        const from = currentIndex.value;
        currentIndex.value = targetIndex;
        runOnJS(onMove)(from, targetIndex);
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd(() => {
      isActive.value = false;
      scale.value = withTiming(1, { duration: 150 });
      const col = currentIndex.value % columns;
      const row = Math.floor(currentIndex.value / columns);
      translateX.value = withTiming(col * (tileWidth + gap), { duration: 180 });
      translateY.value = withTiming(row * (tileHeight + gap), { duration: 180 });
    });

  const composed = Gesture.Race(pan, tap);

  const wrapStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: tileWidth,
    gap: innerGap,
    zIndex: isActive.value ? 10 : 0,
    elevation: isActive.value ? 6 : 0,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={wrapStyle}>
      <GestureDetector gesture={composed}>
        <Animated.View style={{ width: tileWidth, height: photoHeight }}>{photo}</Animated.View>
      </GestureDetector>
      {chip}
    </Animated.View>
  );
}
