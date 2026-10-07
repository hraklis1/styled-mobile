import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText } from '../primitives/AppText';
import { colors, motion, spacing, stroke } from '../../theme';
import type { ColorShare } from '../../lib/closetInsights';

/** 0 → 1 once on mount; jumps straight to 1 under Reduce Motion. */
function useReveal(delay = 0) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(delay, withTiming(1, { duration: motion.slow * 2, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress, reduceMotion]);
  return progress;
}

/** The closet's palette as one strip of fabric, widths proportional to count. */
export function ColorBar({ colors: shares, height = 10 }: { colors: ColorShare[]; height?: number }) {
  const progress = useReveal();
  const revealStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  if (shares.length === 0) return null;
  return (
    <View
      style={[styles.colorTrack, { height }]}
      accessibilityRole="image"
      accessibilityLabel={`Closet colors: ${shares.map((c) => `${c.label} ${Math.round(c.share * 100)}%`).join(', ')}`}
    >
      <Animated.View style={[styles.colorReveal, revealStyle]}>
        {shares.map((c) => (
          <View key={c.key} style={{ flex: c.share, backgroundColor: c.hex }} />
        ))}
      </Animated.View>
    </View>
  );
}

export function ColorLegend({ colors: shares }: { colors: ColorShare[] }) {
  return (
    <View style={styles.legend}>
      {shares.map((c) => (
        <View key={c.key} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: c.hex }]} />
          <AppText variant="meta" tone="secondary">
            {c.label} <AppText variant="meta" tone="muted">{Math.round(c.share * 100)}%</AppText>
          </AppText>
        </View>
      ))}
    </View>
  );
}

function HairlineBar({ share, index }: { share: number; index: number }) {
  const progress = useReveal(index * 60);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * share * 100}%` }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

/** Label · count over a 2pt rule, scaled to the largest row so the leader fills the width. */
export function ShareBars({ rows }: { rows: { key: string; label: string; count: number; share: number }[] }) {
  const max = Math.max(...rows.map((r) => r.share), 0.0001);
  return (
    <View style={styles.bars}>
      {rows.map((row, index) => (
        <View key={row.key} style={styles.barRow}>
          <View style={styles.barLabels}>
            <AppText variant="bodySmall" tone="primary">{row.label}</AppText>
            <AppText variant="meta" tone="muted" style={styles.tabular}>
              {row.count} · {Math.round(row.share * 100)}%
            </AppText>
          </View>
          <HairlineBar share={row.share / max} index={index} />
        </View>
      ))}
    </View>
  );
}

/** One soft stroke, no axes: the shape of the habit, not a reading of it. */
export function WearSparkline({ values, width, height = 56 }: { values: number[]; width: number; height?: number }) {
  if (values.length < 2 || width <= 0) return null;
  const max = Math.max(...values, 1);
  const pad = 4;
  const step = (width - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => [pad + i * step, pad + (1 - v / max) * (height - pad * 2)] as const);
  const line = points
    .map(([x, y], i) => {
      if (i === 0) return `M${x},${y}`;
      const [px, py] = points[i - 1];
      const cx = (px + x) / 2;
      return `C${cx},${py} ${cx},${y} ${x},${y}`;
    })
    .join(' ');
  const area = `${line} L${points[points.length - 1][0]},${height} L${points[0][0]},${height} Z`;
  const [lx, ly] = points[points.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={area} fill={colors.accent} opacity={0.45} />
      <Path d={line} stroke={colors.foreground} strokeWidth={1.25} fill="none" strokeLinecap="round" />
      <Circle cx={lx} cy={ly} r={3} fill={colors.accentInk} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  colorTrack: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
  },
  colorReveal: { flexDirection: 'row', height: '100%', overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: stroke.hairline,
    borderColor: colors.ghostStroke,
  },
  bars: { gap: spacing.lg },
  barRow: { gap: spacing.xs + 2 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tabular: { fontVariant: ['tabular-nums'] },
  barTrack: { height: 2, backgroundColor: colors.hairline, borderRadius: 1, overflow: 'hidden' },
  barFill: { height: 2, backgroundColor: colors.foreground, borderRadius: 1 },
});
