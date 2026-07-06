import { useCallback } from 'react';
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

// Tab button for tabs with a long-press quick menu. Dips on touch-down, then
// grows while held to hint that keeping the finger down opens something —
// the iOS context-menu affordance. Identical to the default button at rest.
export function QuickMenuTabButton({ children, ...props }: BottomTabBarButtonProps) {
  const scale = useSharedValue(1);
  const { onPressIn, onPressOut, onLongPress } = props;

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      scale.value = withSequence(
        withTiming(PRESS_DIP_SCALE, { duration: DIP_DURATION_MS, easing: Easing.out(Easing.quad) }),
        withTiming(HOLD_LIFT_SCALE, {
          duration: LONG_PRESS_DELAY_MS - DIP_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
        }),
      );
      onPressIn?.(e);
    },
    [scale, onPressIn],
  );

  const settleBack = useCallback(() => {
    scale.value = withSpring(1, { mass: 1, damping: 12, stiffness: 250 });
  }, [scale]);

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      settleBack();
      onPressOut?.(e);
    },
    [settleBack, onPressOut],
  );

  // The menu opens while the finger is still down; settle here too so the tab
  // isn't left enlarged under the sheet until onPressOut.
  const handleLongPress = useCallback(
    (e: GestureResponderEvent | RNMouseEvent) => {
      settleBack();
      onLongPress?.(e as GestureResponderEvent);
    },
    [settleBack, onLongPress],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <PlatformPressable
      {...props}
      delayLongPress={LONG_PRESS_DELAY_MS}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={handleLongPress}
    >
      <Animated.View style={[{ alignItems: 'center' }, animatedStyle]}>
        {children}
      </Animated.View>
    </PlatformPressable>
  );
}
