import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '../primitives/AppText';
import { PressableScale } from '../primitives/PressableScale';
import { STORE_FILTER_ALL, type ShoppingStoreOption } from '../../lib/shoppingStoreFilters';
import { colors, radii, spacing } from '../../theme';

export type ShortlistFilterOption<T extends string> = {
  value: T;
  label: string;
  /** Omitted on the "everything" option, which has nothing to count. */
  count?: number;
};

/**
 * The shortlist's whole filter surface, in one scrolling row.
 *
 * It used to be two stacked rails. Read together they were a band of chrome
 * tall enough to push the first photograph off the first screen, which is the
 * wrong trade in an app whose subject is the photographs. Merged, they cost one
 * row, and a hairline between the two groups keeps them legible as two
 * different questions — what still needs doing, and where it was found.
 *
 * Two contracts carry over from the rails and must not drift:
 *
 * - Solid fill means "this filter is narrowing the list", on either side of the
 *   divider. The resting option gets an outline only, so a page at rest never
 *   looks like it is already filtered.
 * - Counts are taken from the *unfiltered* set. A badge that re-counted the
 *   filtered list would zero itself the moment you used it.
 *
 * The store group stays deliberately quieter than the attention group —
 * shorter chips, smaller type, a lighter resting border, a storefront mark —
 * because identical styling made the two questions read as one wrapped row.
 */
export function ShortlistFilterBar<T extends string>({
  attentionOptions,
  attentionValue,
  attentionRestingValue,
  onSelectAttention,
  storeOptions,
  storeFilter,
  storeActiveLabel,
  storeActiveValue,
  onSelectStore,
  onBrowseStores,
}: {
  attentionOptions: ShortlistFilterOption<T>[];
  attentionValue: T;
  /** The "no filter applied" option. */
  attentionRestingValue?: T;
  onSelectAttention: (value: T) => void;
  storeOptions: ShoppingStoreOption[];
  storeFilter: string;
  /** Full label of the current store selection, including a location when one is picked. */
  storeActiveLabel: string;
  /** The store chip to scroll into view, or null when showing everything. */
  storeActiveValue: string | null;
  onSelectStore: (value: string) => void;
  onBrowseStores: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetsRef = useRef<Record<string, number>>({});

  // A store picked in the sheet may sit off-screen in the bar — bring it into
  // view. The offsets now include the attention chips ahead of it, which is
  // exactly what an absolute scrollTo wants.
  useEffect(() => {
    if (!storeActiveValue) {
      scrollRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }
    const offset = offsetsRef.current[storeActiveValue];
    if (offset === undefined) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, offset - spacing.lg), animated: true });
  }, [storeActiveValue]);

  const showingAllStores = storeFilter === STORE_FILTER_ALL;

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="Filter the shortlist"
    >
      {attentionOptions.map((option) => {
        const isCurrent = option.value === attentionValue;
        const isFiltering = isCurrent && option.value !== attentionRestingValue;
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
            onPress={() => onSelectAttention(option.value)}
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

      {/* Two questions, one row. */}
      <View style={styles.divider} />

      <PressableScale
        motion="crisp"
        scaleTo={0.98}
        contentStyle={[styles.storeChip, showingAllStores && styles.chipCurrent]}
        onPress={() => onSelectStore(STORE_FILTER_ALL)}
        accessibilityRole="button"
        accessibilityState={{ selected: showingAllStores }}
      >
        <Ionicons name="storefront-outline" size={13} color={colors.mutedForeground} />
        <AppText variant="caption" tone={showingAllStores ? 'primary' : 'secondary'}>All stores</AppText>
      </PressableScale>

      {storeOptions.map((store) => {
        const isFiltering = storeFilter === store.value
          || store.locations.some((location) => location.value === storeFilter);
        return (
          <PressableScale
            key={store.value}
            motion="crisp"
            scaleTo={0.98}
            contentStyle={[styles.storeChip, isFiltering && styles.chipActive]}
            onLayout={(event) => {
              offsetsRef.current[store.value] = event.nativeEvent.layout.x;
            }}
            onPress={() => onSelectStore(storeFilter === store.value ? STORE_FILTER_ALL : store.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isFiltering }}
          >
            <Ionicons
              name="storefront-outline"
              size={13}
              color={isFiltering ? colors.primaryForeground : colors.mutedForeground}
            />
            <AppText variant="caption" tone={isFiltering ? 'inverse' : 'secondary'} numberOfLines={1}>
              {isFiltering ? storeActiveLabel : store.label}
            </AppText>
          </PressableScale>
        );
      })}

      {/* The only other way into store filtering, and visible rather than
          hidden behind a long-press. Never latches — it opens a sheet. */}
      <PressableScale
        motion="crisp"
        scaleTo={0.98}
        contentStyle={styles.storeChip}
        onPress={onBrowseStores}
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
  row: { gap: spacing.sm, alignItems: 'center', paddingHorizontal: spacing.lg },
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
  storeChip: {
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
  divider: { width: StyleSheet.hairlineWidth, height: 20, marginHorizontal: spacing.xs, backgroundColor: colors.border },
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
