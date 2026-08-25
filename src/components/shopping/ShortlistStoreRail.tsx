import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '../primitives/AppText';
import { PressableScale } from '../primitives/PressableScale';
import { STORE_FILTER_ALL, type ShoppingStoreOption } from '../../lib/shoppingStoreFilters';
import { colors, radii, spacing } from '../../theme';

/**
 * The second filter axis, deliberately quieter than the attention rail above
 * it: shorter, smaller type, a lighter resting border, and a storefront mark on
 * every chip. Identical styling on both rails made them read as one row that
 * happened to wrap rather than two different questions.
 *
 * Solid fill still means "this is narrowing the list" — that much is shared, so
 * an active filter looks the same wherever it lives.
 */
export function ShortlistStoreRail({
  options,
  storeFilter,
  activeLabel,
  activeValue,
  onSelect,
  onBrowseAll,
}: {
  options: ShoppingStoreOption[];
  storeFilter: string;
  /** Full label of the current selection, including a location when one is picked. */
  activeLabel: string;
  /** The chip to scroll into view, or null when showing everything. */
  activeValue: string | null;
  onSelect: (value: string) => void;
  onBrowseAll: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetsRef = useRef<Record<string, number>>({});

  // A store picked in the sheet may sit off-screen in the rail — bring it into view.
  useEffect(() => {
    if (!activeValue) {
      scrollRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }
    const offset = offsetsRef.current[activeValue];
    if (offset === undefined) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, offset - spacing.lg), animated: true });
  }, [activeValue]);

  const showingAll = storeFilter === STORE_FILTER_ALL;

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="Filter by store"
    >
      <PressableScale
        motion="crisp"
        scaleTo={0.98}
        contentStyle={[styles.chip, showingAll && styles.chipCurrent]}
        onPress={() => onSelect(STORE_FILTER_ALL)}
        accessibilityRole="button"
        accessibilityState={{ selected: showingAll }}
      >
        <Ionicons name="storefront-outline" size={13} color={colors.mutedForeground} />
        <AppText variant="caption" tone={showingAll ? 'primary' : 'secondary'}>All stores</AppText>
      </PressableScale>

      {options.map((store) => {
        const isFiltering = storeFilter === store.value
          || store.locations.some((location) => location.value === storeFilter);
        return (
          <PressableScale
            key={store.value}
            motion="crisp"
            scaleTo={0.98}
            contentStyle={[styles.chip, isFiltering && styles.chipActive]}
            onLayout={(event) => {
              offsetsRef.current[store.value] = event.nativeEvent.layout.x;
            }}
            onPress={() => onSelect(storeFilter === store.value ? STORE_FILTER_ALL : store.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isFiltering }}
          >
            <Ionicons
              name="storefront-outline"
              size={13}
              color={isFiltering ? colors.primaryForeground : colors.mutedForeground}
            />
            <AppText variant="caption" tone={isFiltering ? 'inverse' : 'secondary'} numberOfLines={1}>
              {isFiltering ? activeLabel : store.label}
            </AppText>
          </PressableScale>
        );
      })}

      {/* The only other way into store filtering, and visible rather than
          hidden behind a long-press. Never latches — it opens a sheet. */}
      <PressableScale
        motion="crisp"
        scaleTo={0.98}
        contentStyle={styles.chip}
        onPress={onBrowseAll}
        accessibilityRole="button"
        accessibilityLabel="Browse all stores"
      >
        <AppText variant="caption" tone="secondary">More stores</AppText>
        <Ionicons name="chevron-forward" size={12} color={colors.mutedForeground} />
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    maxWidth: 200,
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.background,
  },
  chipCurrent: { borderColor: colors.foreground },
  chipActive: { borderColor: colors.foreground, backgroundColor: colors.foreground },
});
