import React, { forwardRef, useCallback } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { AnimatedClosetList } from './animated-closet-list';
import type { FlashListRef, ListRenderItemInfo, ViewToken } from '@shopify/flash-list';
import { GarmentCard } from './GarmentCard';
import { editorial, spacing } from '../../theme';
import type { Item } from '../../types/item';

const SIDE_PAD = spacing.page;
const COL_GAP  = spacing.grid;

const CARD_ASPECT_RATIO = editorial.garmentAspectRatio;

type ExtraData = {
  selectedIds: Set<number>;
  selectionMode: boolean;
};

type Props = {
  items: Item[];
  numColumns?: 2 | 3;
  selectedIds: Set<number>;
  selectionMode: boolean;
  onItemPress: (item: Item) => void;
  onItemLongPress: (item: Item) => void;
  onToggleSelect: (id: number) => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
  onScroll?: (event: any) => void;
  onScrollBeginDrag?: () => void;
  scrollEventThrottle?: number;
  contentInset?: { top?: number; bottom?: number };
  listPaddingTop?: number;
  initialScrollIndex?: number;
  onLoad?: () => void;
  onViewableItemsChanged?: (info: { viewableItems: ViewToken<Item>[]; changed: ViewToken<Item>[] }) => void;
  viewabilityConfig?: { itemVisiblePercentThreshold?: number };
};

// Overhead reserves two title lines, one metadata line, and the card's spacing.
const CARD_OVERHEAD = 88;

const ClosetGridComponent = forwardRef<FlashListRef<Item>, Props>(function ClosetGridComponent({
  items,
  numColumns = 2,
  selectedIds,
  selectionMode,
  onItemPress,
  onItemLongPress,
  onToggleSelect,
  ListHeaderComponent,
  ListEmptyComponent,
  onScroll,
  onScrollBeginDrag,
  scrollEventThrottle = 16,
  contentInset,
  listPaddingTop = 0,
  initialScrollIndex,
  onLoad,
  onViewableItemsChanged,
  viewabilityConfig,
}, ref) {
  const { width, fontScale } = useWindowDimensions();
  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP * (numColumns - 1)) / numColumns;
  const itemHeight = Math.round(cardWidth / CARD_ASPECT_RATIO) + CARD_OVERHEAD;

  const extraData: ExtraData = { selectedIds, selectionMode };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Item>) => (
      <View style={{ paddingHorizontal: COL_GAP / 2 }}>
      <GarmentCard
        key={fontScale}
        item={item}
        aspectRatio={CARD_ASPECT_RATIO}
        cardWidth={cardWidth}
        selectionMode={selectionMode}
        isSelected={selectedIds.has(item.id)}
        onPress={() => onItemPress(item)}
        onLongPress={() => onItemLongPress(item)}
        onToggleSelect={() => onToggleSelect(item.id)}
      />
      </View>
    ),
    [cardWidth, fontScale, selectionMode, selectedIds, onItemPress, onItemLongPress, onToggleSelect],
  );

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => {
      layout.size = itemHeight;
    },
    [itemHeight],
  );

  return (
    <View style={{ flex: 1, paddingHorizontal: SIDE_PAD - COL_GAP / 2 }}>
      <AnimatedClosetList
        ref={ref}
        data={items}
        numColumns={numColumns}
        renderItem={renderItem}
        keyExtractor={(item: Item) => String(item.id)}
        extraData={extraData}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        scrollEventThrottle={scrollEventThrottle}
        contentInset={contentInset}
        initialScrollIndex={initialScrollIndex}
        onLoad={onLoad}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        maintainVisibleContentPosition={{ disabled: true }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        overrideItemLayout={overrideItemLayout}
        drawDistance={600}
        contentContainerStyle={{
          paddingTop: listPaddingTop,
          paddingBottom: spacing.xxxl * 2,
        }}
      />
    </View>
  );
});

export const ClosetGrid = React.memo(ClosetGridComponent);
