import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, radii } from '../../../theme';

const BAR_MAX_HEIGHTS = [10, 16, 22, 16, 10];
const BAR_MIN_HEIGHT = 4;

type Props = {
  /** Normalized input volume, 0..1. */
  level: SharedValue<number>;
};

function Bar({ level, maxHeight, phaseDelay }: { level: SharedValue<number>; maxHeight: number; phaseDelay: number }) {
  // Slow breathing offset so the bars stay alive during silence.
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 900 + phaseDelay }), -1, true);
    return () => cancelAnimation(breathe);
  }, [breathe, phaseDelay]);

  const animatedStyle = useAnimatedStyle(() => {
    const idle = interpolate(breathe.value, [0, 1], [0, 0.14]);
    const height = BAR_MIN_HEIGHT + (maxHeight - BAR_MIN_HEIGHT) * Math.min(1, level.value + idle);
    return { height };
  });

  return <Animated.View style={[styles.bar, animatedStyle]} />;
}

export function DictationLevelBars({ level }: Props) {
  return (
    <View style={styles.row} pointerEvents="none">
      {BAR_MAX_HEIGHTS.map((maxHeight, i) => (
        <Bar key={i} level={level} maxHeight={maxHeight} phaseDelay={i * 140} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 22,
  },
  bar: {
    width: 3,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
});
