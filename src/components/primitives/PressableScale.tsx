import { useCallback } from 'react';
import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

type Props = Omit<PressableProps, 'children'> & {
  children?: React.ReactNode;
  /** Visual styles (bg, border, radius) applied to the inner Animated.View that scales.
   *  Keep layout props (flex, margin, width) on the outer `style` to avoid reflow mid-animation. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Scale target on press. Defaults to 0.96. */
  scaleTo?: number;
  /** 'spring' (default) has a soft overshoot as it settles. 'crisp' eases in and
   *  out with none — for dense controls like filter chips, where several
   *  wobbling at once reads as noise rather than life. */
  motion?: 'spring' | 'crisp';
  /** Fire a light haptic on press-in. Defaults to true. No-op on web. */
  haptic?: boolean;
  /** Expand the effective touch target without changing the visual layout. */
  hitSlop?: PressableProps['hitSlop'];
  /** Reanimated layout transition. If not provided, it won't animate layout changes automatically. */
  layout?: any;
};

export function PressableScale({
  children,
  style,
  contentStyle,
  scaleTo = 0.96,
  motion = 'spring',
  haptic = true,
  hitSlop,
  layout,
  onPressIn: onPressInProp,
  onPressOut: onPressOutProp,
  ...rest
}: Props) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      if (haptic && Platform.OS !== 'web') {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { /* ignore */ }
      }
      scale.value = motion === 'crisp'
        ? withTiming(scaleTo, { duration: 90, easing: Easing.out(Easing.quad) })
        : withSpring(scaleTo, {
          mass: 1,
          damping: 15,
          stiffness: 300,
          overshootClamping: false,
        });
      onPressInProp?.(e);
    },
    [haptic, motion, scale, scaleTo, onPressInProp],
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      scale.value = motion === 'crisp'
        ? withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) })
        : withSpring(1, {
          mass: 1,
          damping: 12,
          stiffness: 250,
        });
      onPressOutProp?.(e);
    },
    [motion, scale, onPressOutProp],
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Pressable
      style={style}
      hitSlop={hitSlop}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      <Animated.View style={[contentStyle, animatedStyle]} layout={layout}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
