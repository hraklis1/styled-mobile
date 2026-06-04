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
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

type Props = Omit<PressableProps, 'children'> & {
  children?: React.ReactNode;
  /** Visual styles (bg, border, radius) applied to the inner Animated.View that scales.
   *  Keep layout props (flex, margin, width) on the outer `style` to avoid reflow mid-animation. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Scale target on press. Defaults to 0.96. */
  scaleTo?: number;
  /** Fire a light haptic on press-in. Defaults to true. No-op on web. */
  haptic?: boolean;
  /** Reanimated layout transition. If not provided, it won't animate layout changes automatically. */
  layout?: any;
};

export function PressableScale({
  children,
  style,
  contentStyle,
  scaleTo = 0.96,
  haptic = true,
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
      scale.value = withSpring(scaleTo, {
        mass: 1,
        damping: 15,
        stiffness: 300,
        overshootClamping: false,
      });
      onPressInProp?.(e);
    },
    [haptic, scale, scaleTo, onPressInProp],
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      scale.value = withSpring(1, {
        mass: 1,
        damping: 12,
        stiffness: 250,
      });
      onPressOutProp?.(e);
    },
    [scale, onPressOutProp],
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Pressable
      style={style}
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
