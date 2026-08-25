import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../primitives/AppText';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, spacing } from '../../theme';

export type ShortlistFilterOption<T extends string> = {
  value: T;
  label: string;
  /** Omitted on the "everything" option, which has nothing to count. */
  count?: number;
};

/**
 * The attention rail: what still needs doing, as chips you can actually latch.
 *
 * This replaces a strip of four unlabelled metric tiles that silently mutated
 * filters when tapped. Counts are deliberately taken from the *unfiltered* set
 * — a count badge that re-counted the filtered list would zero itself the
 * moment you used it.
 */
export function ShortlistFilterRail<T extends string>({
  options,
  value,
  onSelect,
  restingValue,
  accessibilityLabel,
}: {
  options: ShortlistFilterOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  /** The "no filter applied" option. It reads as chosen but never as active,
   *  so a page at rest doesn't look like it is already filtered. */
  restingValue?: T;
  accessibilityLabel?: string;
}) {
  if (options.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const isCurrent = option.value === value;
        // Solid fill is reserved for a filter that is actually narrowing the
        // list; the resting option only gets an outline.
        const isFiltering = isCurrent && option.value !== restingValue;
        return (
          <PressableScale
            key={option.value}
            motion="crisp"
            scaleTo={0.98}
            contentStyle={[
              styles.chip,
              isCurrent && !isFiltering && styles.chipCurrent,
              isFiltering && styles.chipActive,
            ]}
            onPress={() => onSelect(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isCurrent }}
            accessibilityLabel={option.count === undefined ? option.label : `${option.label}, ${option.count}`}
          >
            <AppText
              variant="bodySmall"
              tone={isFiltering ? 'inverse' : isCurrent ? 'primary' : 'secondary'}
              numberOfLines={1}
            >
              {option.label}
            </AppText>
            {option.count === undefined ? null : (
              <View style={[styles.count, isFiltering && styles.countActive]}>
                <AppText variant="caption" tone={isFiltering ? 'inverse' : 'muted'} style={styles.countText}>
                  {option.count}
                </AppText>
              </View>
            )}
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    maxWidth: 200,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipCurrent: { borderColor: colors.foreground },
  chipActive: { borderColor: colors.foreground, backgroundColor: colors.foreground },
  count: {
    minWidth: 18,
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
  },
  countActive: { backgroundColor: 'rgba(255, 252, 247, 0.22)' },
  countText: { fontVariant: ['tabular-nums'] },
});
