import { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme';

const PRESS_DIP_SCALE = 0.92;
const DIP_DURATION_MS = 100;

// Elevated circular center tab for the AI Stylist. Raise kept ≤18px with top
// hitSlop so the protruding half still registers touches on Android, where the
// bar doesn't extend its touchable bounds.
export function StylistTabButton({
  onPress,
  onLongPress,
  accessibilityState,
  accessibilityLabel,
  testID,
}: BottomTabBarButtonProps) {
  const selected = accessibilityState?.selected === true;
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(PRESS_DIP_SCALE, {
      duration: DIP_DURATION_MS,
      easing: Easing.out(Easing.quad),
    });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { mass: 1, damping: 14, stiffness: 250 });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      style={styles.wrap}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={{ top: 16 }}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Animated.View style={[styles.circle, selected && styles.circleSelected, animatedStyle]}>
        <Ionicons name="sparkles" size={24} color={colors.primaryForeground} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.foreground,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  circleSelected: {
    shadowOpacity: 0.22,
  },
});
