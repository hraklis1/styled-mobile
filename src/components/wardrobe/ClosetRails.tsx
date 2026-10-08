import React, { forwardRef, useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import type { FlashListRef, ListRenderItemInfo } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedClosetList } from './animated-closet-list';
import { GarmentCard } from './GarmentCard';
import { colors, editorial, spacing, typography } from '../../theme';
import { CATEGORY_LABELS, CATEGORY_ORDER, type Item, type ItemCategory } from '../../types/item';

const SIDE_PAD = spacing.page;
const CARD_GAP = spacing.grid;
const CARD_ASPECT_RATIO = editorial.garmentAspectRatio;

export type ClosetRail = { category: ItemCategory | null; items: Item[] };

/** One shelf per category in wardrobe order, each keeping the current sort. */
export function groupIntoRails(items: Item[]): ClosetRail[] {
  const byCategory = new Map<ItemCategory | null, Item[]>();
  for (const item of items) {
    const key = item.category ?? null;
    const shelf = byCategory.get(key);
    if (shelf) shelf.push(item); else byCategory.set(key, [item]);
  }
  const ordered: ClosetRail[] = CATEGORY_ORDER
    .filter(category => byCategory.has(category))
    .map(category => ({ category, items: byCategory.get(category)! }));
  const uncategorised = byCategory.get(null);
  return uncategorised ? [...ordered, { category: null, items: uncategorised }] : ordered;
}

type Props = {
  items: Item[];
  selectedIds: Set<number>;
  selectionMode: boolean;
  onItemPress: (item: Item) => void;
  onItemLongPress: (item: Item) => void;
  onToggleSelect: (id: number) => void;
  onSeeAll: (category: ItemCategory) => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
  onScroll?: (event: any) => void;
  onScrollBeginDrag?: () => void;
  listPaddingTop?: number;
  listPaddingBottom?: number;
  onLoad?: () => void;
};

const ClosetRailsComponent = forwardRef<FlashListRef<ClosetRail>, Props>(function ClosetRailsComponent({
  items, selectedIds, selectionMode, onItemPress, onItemLongPress, onToggleSelect, onSeeAll,
  ListHeaderComponent, ListEmptyComponent, onScroll, onScrollBeginDrag,
  listPaddingTop = 0, listPaddingBottom = spacing.xxxl * 2, onLoad,
}, ref) {
  const { width, fontScale } = useWindowDimensions();
  // A little over two cards per screen so the shelf visibly continues.
  const cardWidth = Math.round((width - SIDE_PAD - CARD_GAP * 2) / 2.35);
  const rails = useMemo(() => groupIntoRails(items), [items]);

  const renderRail = useCallback(({ item: rail }: ListRenderItemInfo<ClosetRail>) => {
    const label = rail.category ? CATEGORY_LABELS[rail.category] : 'Other';
    return (
      <View style={styles.rail}>
        <View style={styles.railHeader}>
          <Text style={styles.railTitle} accessibilityRole="header">
            {label} <Text style={styles.railCount}>{rail.items.length}</Text>
          </Text>
          {rail.category && (
            <TouchableOpacity
              onPress={() => onSeeAll(rail.category!)}
              style={styles.seeAll}
              accessibilityRole="button"
              accessibilityLabel={`See all ${label}`}
            >
              <Text style={styles.seeAllText}>See all</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          horizontal
          data={rail.items}
          keyExtractor={item => String(item.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelf}
          initialNumToRender={4}
          windowSize={5}
          decelerationRate="fast"
          snapToInterval={cardWidth + CARD_GAP}
          renderItem={({ item }) => (
            <GarmentCard
              key={fontScale}
              item={item}
              aspectRatio={CARD_ASPECT_RATIO}
              cardWidth={cardWidth}
              bottomSpacing={0}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(item.id)}
              dimmed={selectedIds.size > 0}
              onPress={() => onItemPress(item)}
              onLongPress={() => onItemLongPress(item)}
              onToggleSelect={() => onToggleSelect(item.id)}
            />
          )}
          extraData={selectedIds}
        />
      </View>
    );
  }, [cardWidth, fontScale, onItemLongPress, onItemPress, onSeeAll, onToggleSelect, selectedIds, selectionMode]);

  return (
    <AnimatedClosetList
      ref={ref}
      data={rails}
      renderItem={renderRail}
      keyExtractor={rail => rail.category ?? 'other'}
      extraData={{ selectedIds, selectionMode, cardWidth }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      onScroll={onScroll}
      onScrollBeginDrag={onScrollBeginDrag}
      scrollEventThrottle={16}
      onLoad={onLoad}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      maintainVisibleContentPosition={{ disabled: true }}
      contentContainerStyle={{ paddingTop: listPaddingTop, paddingBottom: listPaddingBottom }}
    />
  );
});

export const ClosetRails = React.memo(ClosetRailsComponent);

const styles = StyleSheet.create({
  rail: { marginBottom: spacing.xl },
  railHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: SIDE_PAD, paddingRight: SIDE_PAD - spacing.sm, marginBottom: spacing.sm,
  },
  railTitle: { ...typography.text.cardTitle, color: colors.foreground },
  railCount: { ...typography.text.bodySmall, color: colors.mutedForeground },
  seeAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm },
  seeAllText: { ...typography.text.bodySmall, color: colors.mutedForeground },
  shelf: { paddingHorizontal: SIDE_PAD, gap: CARD_GAP },
});
