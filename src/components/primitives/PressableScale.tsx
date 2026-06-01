import { useCallback, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
};

export function PressableScale({
  children,
  style,
  contentStyle,
  scaleTo = 0.96,
  haptic = true,
  onPressIn: onPressInProp,
  onPressOut: onPressOutProp,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      if (haptic && Platform.OS !== 'web') {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { /* ignore */ }
      }
      Animated.spring(scale, {
        toValue: scaleTo,
        useNativeDriver: true,
        speed: 50,
        bounciness: 2,
      }).start();
      onPressInProp?.(e);
    },
    [haptic, scale, scaleTo, onPressInProp],
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
        bounciness: 4,
      }).start();
      onPressOutProp?.(e);
    },
    [scale, onPressOutProp],
  );

  return (
    <Pressable
      style={style}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      <Animated.View style={[contentStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
