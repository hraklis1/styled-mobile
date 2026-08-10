import { useCallback, useEffect, useRef } from 'react';
import type { GestureResponderEvent, MouseEvent as RNMouseEvent } from 'react-native';
import { PlatformPressable } from '@react-navigation/elements';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Pinned to the RN Pressable default so the lift peaks exactly when tabLongPress fires.
const LONG_PRESS_DELAY_MS = 500;
const PRESS_DIP_SCALE = 0.9;
const HOLD_LIFT_SCALE = 1.12;
const DIP_DURATION_MS = 120;
// Pressability cancels its native long-press timer after roughly 10px of
// movement. A mouse-held touch in the simulator can drift farther than that,
// so keep a slightly more forgiving fallback timer for this button.
const FALLBACK_LONG_PRESS_DELAY_MS = LONG_PRESS_DELAY_MS + 40;
const LONG_PRESS_MOVE_TOLERANCE_PX = 32;

// Tab button for tabs with a long-press quick menu. Dips on touch-down, then
// grows while held to hint that keeping the finger down opens something —
// the iOS context-menu affordance. Identical to the default button at rest.
type QuickMenuTabButtonProps = BottomTabBarButtonProps & {
  pulseToken?: number;
};
type TabPressEvent = Parameters<NonNullable<BottomTabBarButtonProps['onPress']>>[0];

export function QuickMenuTabButton({ children, pulseToken = 0, ...props }: QuickMenuTabButtonProps) {
  const scale = useSharedValue(1);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const pressOrigin = useRef<{ pageX: number; pageY: number } | null>(null);
  const { onPress, onPressIn, onPressOut, onPressMove, onLongPress, onResponderTerminate } = props;

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (pulseToken === 0) return;
    scale.value = withSequence(
      withTiming(1.08, { duration: 130, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
    );
  }, [pulseToken, scale]);

  const settleBack = useCallback(() => {
    scale.value = withSpring(1, { mass: 1, damping: 12, stiffness: 250 });
  }, [scale]);

  // The menu opens while the finger is still down; settle here too so the tab
  // isn't left enlarged under the sheet until onPressOut.
  const handleLongPress = useCallback(
    (e: GestureResponderEvent | RNMouseEvent) => {
      clearLongPressTimer();
      longPressTriggered.current = true;
      settleBack();
      onLongPress?.(e as GestureResponderEvent);
    },
    [clearLongPressTimer, settleBack, onLongPress],
  );

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      clearLongPressTimer();
      longPressTriggered.current = false;
      pressOrigin.current = {
        pageX: e.nativeEvent.pageX,
        pageY: e.nativeEvent.pageY,
      };
      e.persist();
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        handleLongPress(e);
      }, FALLBACK_LONG_PRESS_DELAY_MS);

      scale.value = withSequence(
        withTiming(PRESS_DIP_SCALE, { duration: DIP_DURATION_MS, easing: Easing.out(Easing.quad) }),
        withTiming(HOLD_LIFT_SCALE, {
          duration: LONG_PRESS_DELAY_MS - DIP_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
        }),
      );
      onPressIn?.(e);
    },
    [clearLongPressTimer, handleLongPress, scale, onPressIn],
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      clearLongPressTimer();
      pressOrigin.current = null;
      settleBack();
      onPressOut?.(e);
    },
    [clearLongPressTimer, settleBack, onPressOut],
  );

  const handlePressMove = useCallback(
    (e: GestureResponderEvent) => {
      onPressMove?.(e);
      const origin = pressOrigin.current;
      if (!origin) return;

      const movedX = e.nativeEvent.pageX - origin.pageX;
      const movedY = e.nativeEvent.pageY - origin.pageY;
      if (Math.hypot(movedX, movedY) > LONG_PRESS_MOVE_TOLERANCE_PX) {
        clearLongPressTimer();
      }
    },
    [clearLongPressTimer, onPressMove],
  );

  const handleResponderTerminate = useCallback(
    (e: GestureResponderEvent) => {
      clearLongPressTimer();
      pressOrigin.current = null;
      settleBack();
      onResponderTerminate?.(e);
    },
    [clearLongPressTimer, onResponderTerminate, settleBack],
  );

  const handlePress = useCallback(
    (e: TabPressEvent) => {
      if (longPressTriggered.current) {
        longPressTriggered.current = false;
        return;
      }
      onPress?.(e);
    },
    [onPress],
  );

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <PlatformPressable
      {...props}
      delayLongPress={LONG_PRESS_DELAY_MS}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPressMove={handlePressMove}
      onResponderTerminate={handleResponderTerminate}
      onLongPress={handleLongPress}
      accessibilityActions={[{ name: 'show_shortcuts', label: 'Show shortcuts' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'show_shortcuts') {
          handleLongPress({} as GestureResponderEvent);
        }
      }}
    >
      <Animated.View style={[{ alignItems: 'center' }, animatedStyle]}>
        {children}
      </Animated.View>
    </PlatformPressable>
  );
}
