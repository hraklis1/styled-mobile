import { useState, useEffect, type ReactNode } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useAnimatedReaction, runOnJS, type SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { colors, typography, spacing } from '../../theme';

export function ClosetHeader({ scrollY, actionLabel, onAction, summary, overflowAction, children, onMeasure, hideDivider = false }: {
  scrollY: SharedValue<number>; actionLabel: string; onAction: () => void; children: ReactNode;
  summary: string; overflowAction?: ReactNode;
  onMeasure: (height: number, collapseDistance: number) => void;
  hideDivider?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const [titleHeight, setTitleHeight] = useState(64);
  const [height, setHeight] = useState(112);
  const [compact, setCompact] = useState(false);
  const distance = Math.max(1, titleHeight - 44);
  useEffect(() => onMeasure(height, distance), [height, distance, onMeasure]);
  useAnimatedReaction(() => scrollY.value >= distance, (next, previous) => {
    if (next !== previous) runOnJS(setCompact)(next);
  }, [distance]);
  const actionPosition = useAnimatedStyle(() => ({ transform: [{ translateY: -(distance - Math.min(Math.max(scrollY.value, 0), distance)) / 2 }] }));
  const position = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.min(Math.max(scrollY.value, 0), distance) }] }));
  // Text swaps once at the compact boundary: no fades, springs, or duplicate
  // accessible titles, including when Reduce Motion is enabled.
  return (
    <Animated.View style={[styles.header, hideDivider && styles.headerWithoutDivider, position]} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
      <View style={styles.titleRow} onLayout={event => setTitleHeight(event.nativeEvent.layout.height)}>
        {/* Remeasure text after Dynamic Type changes without remounting the header. */}
        <View key={fontScale} style={[styles.titleContent, fontScale > 1.3 && styles.titleContentStacked, { paddingRight: overflowAction ? 88 : 44, opacity: compact ? 0 : 1 }]} accessibilityElementsHidden={compact} importantForAccessibility={compact ? 'no-hide-descendants' : 'auto'}>
          <Text style={styles.largeTitle}>Closet</Text>
          <Text style={styles.summary} accessibilityLiveRegion="polite">{summary}</Text>
        </View>
        {compact && <View style={styles.compactTitle} pointerEvents="none"><Text style={styles.smallTitle} numberOfLines={1} maxFontSizeMultiplier={1.5}>Closet</Text></View>}
        {overflowAction && <Animated.View style={[styles.overflow, compact ? styles.overflowCompact : styles.overflowExpanded, actionPosition]}>{overflowAction}</Animated.View>}
        <Animated.View style={[styles.action, actionPosition]}><PressableScale contentStyle={styles.actionContent} onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Ionicons name="add" size={20} color={colors.foreground} />
        </PressableScale></Animated.View>
      </View>
      {children}
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerWithoutDivider: { borderBottomWidth: 0 },
  titleRow: { minHeight: 64, paddingVertical: 8, justifyContent: 'center', paddingHorizontal: spacing.page },
  titleContent: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  titleContentStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 0 },
  largeTitle: { ...typography.text.editorialHero, color: colors.foreground },
  summary: { ...typography.text.caption, flexShrink: 1, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  compactTitle: { position: 'absolute', bottom: 0, left: 64, right: 64, height: 44, justifyContent: 'center', alignItems: 'center' },
  smallTitle: { ...typography.text.body, fontWeight: typography.weight.medium, color: colors.foreground },
  action: { position: 'absolute', right: spacing.page, bottom: 0 },
  actionContent: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  overflow: { position: 'absolute', bottom: 0 },
  overflowCompact: { left: spacing.page },
  overflowExpanded: { right: spacing.page + 44 },
});
