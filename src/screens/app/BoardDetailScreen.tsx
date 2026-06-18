import { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GarmentCard } from '../../components/wardrobe/GarmentCard';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { PressableScale } from '../../components/primitives/PressableScale';
import { useBoards, useBoardFeed, flattenBoardFeed, useDeleteBoard, useUpdateBoard } from '../../hooks/useBoards';
import type { BoardFeedItem } from '../../types/board';
import { colors, spacing, typography, radii } from '../../theme';
import type { BoardDetailScreenProps } from '../../navigation/types';
import { BoardAddMenuSheet } from '../../components/boards/BoardAddMenuSheet';
import { BoardItemPickerModal } from '../../components/boards/BoardItemPickerModal';
import { BoardOutfitPickerModal } from '../../components/boards/BoardOutfitPickerModal';
import { BoardWishlistPickerModal } from '../../components/boards/BoardWishlistPickerModal';

const SIDE_PAD = spacing.lg;
const COL_GAP = spacing.sm;
const CARD_ASPECT_RATIO = 0.85;

export function BoardDetailScreen({ route, navigation }: BoardDetailScreenProps) {
  const { boardId } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;

  const { data: boards = [] } = useBoards();
  const board = boards.find((b) => b.id === boardId);

  const feed = useBoardFeed(boardId);
  const items = useMemo(() => flattenBoardFeed(feed.data?.pages), [feed.data?.pages]);

  const { mutate: deleteBoard } = useDeleteBoard();
  const { mutate: updateBoard } = useUpdateBoard();

  const [menuVisible, setMenuVisible] = useState(false);
  const [itemPickerVisible, setItemPickerVisible] = useState(false);
  const [outfitPickerVisible, setOutfitPickerVisible] = useState(false);
  const [wishlistPickerVisible, setWishlistPickerVisible] = useState(false);

  const handleRename = useCallback(() => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Rename board',
        undefined,
        (text) => {
          const name = text?.trim();
          if (name) updateBoard({ id: boardId, name });
        },
        'plain-text',
        board?.name ?? '',
      );
    }
  }, [boardId, board?.name, updateBoard]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete board', `Delete "${board?.name ?? 'this board'}"? Saved items stay in your closet.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteBoard(boardId);
          navigation.goBack();
        },
      },
    ]);
  }, [boardId, board?.name, deleteBoard, navigation]);

  const handleOverflow = useCallback(() => {
    Alert.alert(board?.name ?? 'Board', undefined, [
      { text: 'Rename', onPress: handleRename },
      { text: 'Delete board', style: 'destructive', onPress: handleDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [board?.name, handleRename, handleDelete]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BoardFeedItem>) => {
      if (item.kind === 'item') {
        return (
          <View style={styles.cell}>
            <GarmentCard
              item={item.item}
              aspectRatio={CARD_ASPECT_RATIO}
              cardWidth={cardWidth}
              onPress={() => navigation.navigate('ItemDetail', { itemId: item.item.id })}
            />
          </View>
        );
      }
      if (item.kind === 'outfit') {
        return (
          <View style={styles.cell}>
            <PressableScale onPress={() => navigation.navigate('OutfitDetail', { outfitId: item.outfit.id })}>
              <OutfitCollage outfit={item.outfit} size={cardWidth} />
              <Text style={styles.outfitName} numberOfLines={1}>
                {item.outfit.name}
              </Text>
            </PressableScale>
          </View>
        );
      }
      // wishlist
      const o = item.entry.outfit;
      return (
        <View style={styles.cell}>
          <View style={[styles.wishlistTile, { width: cardWidth, height: cardWidth }]}>
            <Ionicons name="bag-handle-outline" size={26} color={colors.primary} />
            <Text style={styles.wishlistLabel} numberOfLines={1}>
              {o?.city ? `Shop · ${o.city}` : 'Shop outfit'}
            </Text>
            {!!o?.totalBudget && <Text style={styles.wishlistBudget}>{o.totalBudget}</Text>}
          </View>
        </View>
      );
    },
    [cardWidth, navigation],
  );

  const showInitialLoading = feed.isLoading && items.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {board?.name ?? 'Board'}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setMenuVisible(true)} accessibilityLabel="Add to board">
            <Ionicons name="add" size={26} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleOverflow} accessibilityLabel="Board options">
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {showInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="albums-outline" size={30} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptySub}>Save pieces, outfits, and shop finds to this board.</Text>
          <TouchableOpacity 
            style={{ marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2, borderRadius: radii.full }}
            onPress={() => setMenuVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: typography.weight.semibold }}>Add to Board</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: SIDE_PAD - COL_GAP / 2 }}>
          <FlashList
            data={items}
            numColumns={2}
            renderItem={renderItem}
            keyExtractor={(it) => it.key}
            showsVerticalScrollIndicator={false}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
            }}
            ListFooterComponent={
              feed.isFetchingNextPage ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
              ) : null
            }
            contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxxl * 2 }}
          />
        </View>
      )}

      <BoardAddMenuSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onPickItems={() => setItemPickerVisible(true)}
        onPickOutfits={() => setOutfitPickerVisible(true)}
        onPickWishlist={() => setWishlistPickerVisible(true)}
      />
      <BoardItemPickerModal
        board={board ?? null}
        visible={itemPickerVisible}
        onClose={() => setItemPickerVisible(false)}
      />
      <BoardOutfitPickerModal
        board={board ?? null}
        visible={outfitPickerVisible}
        onClose={() => setOutfitPickerVisible(false)}
      />
      <BoardWishlistPickerModal
        board={board ?? null}
        visible={wishlistPickerVisible}
        onClose={() => setWishlistPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  cell: {
    paddingHorizontal: COL_GAP / 2,
    marginBottom: spacing.md,
  },
  outfitName: {
    marginTop: spacing.xs,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  wishlistTile: {
    borderRadius: radii.lg,
    backgroundColor: `${colors.primary}12`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  wishlistLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  wishlistBudget: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  emptySub: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
