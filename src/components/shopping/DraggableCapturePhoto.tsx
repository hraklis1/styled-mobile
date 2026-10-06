import { useMemo, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, type SharedValue } from 'react-native-reanimated';

const LONG_PRESS_MS = 280;

/**
 * One photo in the camera's active-item strip. A tap opens it; press and
 * hold lifts it so it can be dropped on another item (or the "+" tile) in the
 * stack rail. The floating copy is drawn by the screen from `dragX`/`dragY`
 * so it can leave the scroll view that clips this thumbnail.
 */
export function DraggableCapturePhoto({
  photoId, disabled, dragX, dragY, style, accessibilityLabel, accessibilityHint, accessibilityActions,
  onAccessibilityAction, onOpen, onDragStart, onDragMove, onDragEnd, children,
}: {
  photoId: string;
  disabled: boolean;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityActions?: { name: string; label: string }[];
  onAccessibilityAction?: (name: string) => void;
  /** Stable (e.g. a state setter): a new function per render would rebuild
   *  the gesture and cancel a drag in flight. */
  onOpen: (photoId: string) => void;
  onDragStart: (photoId: string) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number, cancelled: boolean) => void;
  children: ReactNode;
}) {
  const gesture = useMemo(() => {
    const tap = Gesture.Tap().enabled(!disabled).onEnd((_event, success) => {
      if (success) runOnJS(onOpen)(photoId);
    });
    const drag = Gesture.Pan().enabled(!disabled).activateAfterLongPress(LONG_PRESS_MS)
      .onStart((event) => {
        dragX.value = event.absoluteX;
        dragY.value = event.absoluteY;
        runOnJS(onDragStart)(photoId);
      })
      .onUpdate((event) => {
        dragX.value = event.absoluteX;
        dragY.value = event.absoluteY;
        runOnJS(onDragMove)(event.absoluteX, event.absoluteY);
      })
      .onEnd((event, success) => {
        runOnJS(onDragEnd)(event.absoluteX, event.absoluteY, !success);
      });
    return Gesture.Exclusive(drag, tap);
  }, [disabled, dragX, dragY, onDragEnd, onDragMove, onDragStart, onOpen, photoId]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style} accessible accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityActions={[{ name: 'activate' }, ...(accessibilityActions ?? [])]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') onOpen(photoId);
          else onAccessibilityAction?.(event.nativeEvent.actionName);
        }}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
