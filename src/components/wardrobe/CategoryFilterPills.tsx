import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS, CATEGORY_ORDER, type ItemCategory } from '../../types/item';

type Props = {
  selected: ItemCategory | null;
  onSelect: (category: ItemCategory | null) => void;
  counts: Partial<Record<ItemCategory, number>>;
};

export function CategoryFilterPills({ selected, onSelect, counts }: Props) {
  const categories: Array<{ key: ItemCategory | null; label: string; count: number }> = [
    { key: null, label: 'All', count: Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) },
    ...CATEGORY_ORDER
      .filter((c) => (counts[c] ?? 0) > 0)
      .map((c) => ({ key: c, label: CATEGORY_LABELS[c], count: counts[c] ?? 0 })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      {categories.map(({ key, label, count }) => {
        const active = selected === key;
        return (
          <TouchableOpacity
            key={key ?? 'all'}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onSelect(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {label}
            </Text>
            <View style={[styles.badge, active && styles.badgeActive]}>
              <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                {count}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const PILL_HEIGHT = 36;

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    marginRight: spacing.sm,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    marginRight: spacing.xs,
  },
  pillTextActive: {
    color: colors.primaryForeground,
  },
  badge: {
    backgroundColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
  },
  badgeTextActive: {
    color: colors.primaryForeground,
  },
});
