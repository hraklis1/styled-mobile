import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, radii, spacing, typography } from '../../../theme';

/**
 * A single 2pt line that grows, plus a "2 / 4" counter. Replaces the segmented
 * bar: one continuous line reads as progress through a piece, segments read as
 * a form's page count.
 */
export function HairlineProgress({ index, total }: { index: number; total: number }) {
  const fraction = useSharedValue((index + 1) / total);

  useEffect(() => {
    fraction.value = withSpring((index + 1) / total, { damping: 20, stiffness: 160, reduceMotion: ReduceMotion.System });
  }, [fraction, index, total]);

  const fill = useAnimatedStyle(() => ({ width: `${fraction.value * 100}%` }));

  return (
    <View style={s.row} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: index + 1 }}>
      <View style={s.track}>
        <Animated.View style={[s.fill, fill]} />
      </View>
      <Text style={s.counter}>
        {index + 1} / {total}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: { flex: 1, height: 2, borderRadius: radii.full, backgroundColor: colors.hairline, overflow: 'hidden' },
  fill: { height: 2, borderRadius: radii.full, backgroundColor: colors.foreground },
  counter: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'right',
  },
});
