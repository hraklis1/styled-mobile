import React, { useCallback } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { GarmentCard } from './GarmentCard';
import { spacing } from '../../theme';
import type { Item } from '../../types/item';

const NUM_COLS = 2;
const SIDE_PAD = spacing.lg;
const COL_GAP  = spacing.sm;

const CARD_ASPECT_RATIO = 0.85;

type ExtraData = {
  selectedIds: Set<number>;
  selectionMode: boolean;
};

type Props = {
  items: Item[];
  selectedIds: Set<number>;
  selectionMode: boolean;
  onItemPress: (item: Item) => void;
  onItemLongPress: (item: Item) => void;
  onToggleSelect: (id: number) => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
  onScroll?: (event: any) => void;
  scrollEventThrottle?: number;
  contentInset?: { top?: number; bottom?: number };
};

function ClosetGridComponent({
  items,
  selectedIds,
  selectionMode,
  onItemPress,
  onItemLongPress,
  onToggleSelect,
  ListHeaderComponent,
  ListEmptyComponent,
  onScroll,
  scrollEventThrottle = 16,
  contentInset,
}: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / NUM_COLS;

  const extraData: ExtraData = { selectedIds, selectionMode };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Item>) => (
      <GarmentCard
        item={item}
        aspectRatio={CARD_ASPECT_RATIO}
        cardWidth={cardWidth}
        selectionMode={selectionMode}
        isSelected={selectedIds.has(item.id)}
        onPress={() => onItemPress(item)}
        onLongPress={() => onItemLongPress(item)}
        onToggleSelect={() => onToggleSelect(item.id)}
      />
    ),
    [cardWidth, selectionMode, selectedIds, onItemPress, onItemLongPress, onToggleSelect],
  );

  return (
    <View style={{ flex: 1, paddingHorizontal: SIDE_PAD - COL_GAP / 2 }}>
      <FlashList
        data={items}
        numColumns={NUM_COLS}
        renderItem={renderItem}
        keyExtractor={(item: Item) => String(item.id)}
        extraData={extraData}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        contentInset={contentInset}
        contentContainerStyle={{
          paddingBottom: spacing.xxxl * 2,
        }}
      />
    </View>
  );
}

export const ClosetGrid = React.memo(ClosetGridComponent);
