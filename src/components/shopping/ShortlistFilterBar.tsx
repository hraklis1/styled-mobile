import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '../primitives/AppText';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, spacing } from '../../theme';

export type ShortlistAppliedFilter = {
  key: string;
  label: string;
  onRemove: () => void;
};

/**
 * A state indicator, not a second filter interface. At rest it renders
 * nothing, letting the photographs begin immediately. Once Refine narrows the
 * shortlist, each active choice appears as a removable capsule.
 */
export function ShortlistFilterBar({ filters }: { filters: ShortlistAppliedFilter[] }) {
  const reduceMotion = useReducedMotion();

  if (filters.length === 0) return null;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(140)}
      exiting={reduceMotion ? undefined : FadeOut.duration(90)}
      style={styles.container}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityLabel="Applied shortlist filters"
      >
        {filters.map((filter) => (
          <PressableScale
            key={filter.key}
            motion="crisp"
            scaleTo={0.98}
            contentStyle={styles.chip}
            onPress={filter.onRemove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${filter.label} filter`}
          >
            <AppText variant="caption" tone="primary" numberOfLines={1}>{filter.label}</AppText>
            <View style={styles.removeIcon}>
              <Ionicons name="close" size={12} color={colors.mutedForeground} />
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.lg },
  row: { gap: spacing.sm, alignItems: 'center', paddingHorizontal: spacing.lg },
  chip: {
    maxWidth: 200,
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  removeIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.muted,
  },
});
