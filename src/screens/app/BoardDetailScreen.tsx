import { useMemo, useCallback, useState, useEffect } from 'react';
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
import { useStoreFindSync } from '../../hooks/useStoreFindSync';
import { enqueueStoreFind } from '../../lib/storeFindQueue';
import { uploadLocalImages } from '../../lib/uploadLocalImages';
import { useAuth } from '../../contexts/AuthContext';
import type { BoardFeedItem } from '../../types/board';
import { colors, spacing, typography, radii } from '../../theme';
import type { BoardDetailScreenProps } from '../../navigation/types';
import { BoardAddMenuSheet } from '../../components/boards/BoardAddMenuSheet';
import { BoardOptionsMenuSheet } from '../../components/boards/BoardOptionsMenuSheet';
import { BoardItemPickerModal } from '../../components/boards/BoardItemPickerModal';
import { BoardOutfitPickerModal } from '../../components/boards/BoardOutfitPickerModal';
import { BoardWishlistPickerModal } from '../../components/boards/BoardWishlistPickerModal';
import { StoreFindFormModal } from '../../components/boards/StoreFindFormModal';
import { BoardStoreFindCard } from '../../components/boards/BoardStoreFindCard';
import { StoreFindDetailSheet } from '../../components/boards/StoreFindDetailSheet';
import type { StoreFind } from '../../types/storeFind';
import { useLibraryLaunch } from '../../hooks/useCameraLaunch';

const SIDE_PAD = spacing.lg;
const COL_GAP = spacing.sm;
const CARD_ASPECT_RATIO = 0.85;

export function BoardDetailScreen({ route, navigation }: BoardDetailScreenProps) {
  const { boardId, autoOpenStoreFindForm } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;

  const { user } = useAuth();
  const { data: boards = [] } = useBoards();
  const board = boards.find((b) => b.id === boardId);

  const feed = useBoardFeed(boardId);

  const items = useMemo(() => {
    return flattenBoardFeed(feed.data?.pages);
  }, [feed.data?.pages]);

  const { mutate: deleteBoard } = useDeleteBoard();
  const { mutate: updateBoard } = useUpdateBoard();
  const { pendingCount, sync: syncStoreFinds } = useStoreFindSync();

  const [menuVisible, setMenuVisible] = useState(false);
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);
  const [itemPickerVisible, setItemPickerVisible] = useState(false);
  const [outfitPickerVisible, setOutfitPickerVisible] = useState(false);
  const [wishlistPickerVisible, setWishlistPickerVisible] = useState(false);
  const [storeFindFormVisible, setStoreFindFormVisible] = useState(false);
  const [detailStoreFind, setDetailStoreFind] = useState<StoreFind | null>(null);
  const [editingStoreFind, setEditingStoreFind] = useState<StoreFind | null>(null);

  // Auto-open the store find form when navigated from the "Daily Finds" home button.
  useEffect(() => {
    if (autoOpenStoreFindForm) setStoreFindFormVisible(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Multiselect ─────────────────────────────────────────────────────────────
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const isMultiselect = selectedKeys.size > 0;

  const enterMultiselect = useCallback((key: string) => {
    setSelectedKeys(new Set([key]));
  }, []);

  const toggleSelectedKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const exitMultiselect = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!board || selectedKeys.size === 0) return;
    const count = selectedKeys.size;
    Alert.alert(
      'Remove from board',
      `Remove ${count} ${count === 1 ? 'item' : 'items'} from this board? They will stay in your closet.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const itemIds = new Set<number>();
            const outfitIds = new Set<number>();
            const wishlistIds = new Set<string>();
            const storeFindIds = new Set<string>();
            for (const key of selectedKeys) {
              if (key.startsWith('sf_')) storeFindIds.add(key.slice(3));
              else if (key.startsWith('i')) itemIds.add(Number(key.slice(1)));
              else if (key.startsWith('o')) outfitIds.add(Number(key.slice(1)));
              else if (key.startsWith('w')) wishlistIds.add(key.slice(1));
            }
            updateBoard({
              id: boardId,
              itemIds: board.itemIds.filter((id) => !itemIds.has(id)),
              outfitIds: board.outfitIds.filter((id) => !outfitIds.has(id)),
              wishlistIds: board.wishlistIds.filter((id) => !wishlistIds.has(id)),
              storeFinds: (board.storeFinds ?? []).filter((sf) => !storeFindIds.has(sf.id)),
            });
            setSelectedKeys(new Set());
          },
        },
      ],
    );
  }, [board, boardId, selectedKeys, updateBoard]);

  const launchLibrary = useLibraryLaunch();

  const handleSaveStoreFind = useCallback(async (data: Omit<StoreFind, 'id' | 'createdAt'>) => {
    const newFind: StoreFind = {
      ...data,
      id: Math.random().toString(36).substring(7),
      createdAt: new Date().toISOString(),
    };

    // Persist to queue first, then sync — the sync hook uploads images to R2
    // before PATCHing the board, so we never send local file:// URIs to the server.
    await enqueueStoreFind(boardId, newFind);
    syncStoreFinds();
  }, [boardId, syncStoreFinds]);

  const handleEditSaveStoreFind = useCallback(async (data: Omit<StoreFind, 'id' | 'createdAt'>) => {
    if (!editingStoreFind) return;
    let updatedFind: StoreFind = { ...editingStoreFind, ...data };

    // Upload any newly-added local photos inline — edits bypass the queue.
    const hasLocal = (updatedFind.imageUrls ?? []).some((u) => u.startsWith('file://'));
    if (hasLocal && user?.id) {
      updatedFind = await uploadLocalImages(updatedFind, user.id);
    }

    const current = board?.storeFinds ?? [];
    const exists = current.some((sf) => sf.id === editingStoreFind.id);
    const updated = exists
      ? current.map((sf) => (sf.id === editingStoreFind.id ? updatedFind : sf))
      : [...current, updatedFind];

    updateBoard({ id: boardId, storeFinds: updated });
  }, [editingStoreFind, board, boardId, updateBoard, user]);

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

  const handleChangeCover = useCallback(async () => {
    const image = await launchLibrary({ allowsEditing: true, maxDim: 800 });
    if (image?.dataUrl) {
      updateBoard(
        { id: boardId, coverImageUrl: image.dataUrl },
        {
          onSuccess: () => {
            Alert.alert('Cover Updated', 'The cover photo for this board was successfully updated.');
          },
        }
      );
    }
  }, [boardId, launchLibrary, updateBoard]);

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
    setOptionsMenuVisible(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BoardFeedItem>) => {
      const key = item.key;
      const isSelected = selectedKeys.has(key);

      const selectionOverlay = isSelected ? (
        <View style={styles.selectionOverlay} pointerEvents="none">
          <View style={styles.selectionCheck}>
            <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
          </View>
        </View>
      ) : null;

      if (item.kind === 'item') {
        return (
          <View style={styles.cell}>
            <GarmentCard
              item={item.item}
              aspectRatio={CARD_ASPECT_RATIO}
              cardWidth={cardWidth}
              onPress={
                isMultiselect
                  ? () => toggleSelectedKey(key)
                  : () => navigation.navigate('ItemDetail', { itemId: item.item.id })
              }
              onLongPress={() => enterMultiselect(key)}
            />
            {selectionOverlay}
          </View>
        );
      }
      if (item.kind === 'outfit') {
        return (
          <View style={styles.cell}>
            <PressableScale
              onPress={
                isMultiselect
                  ? () => toggleSelectedKey(key)
                  : () => navigation.navigate('OutfitDetail', { outfitId: item.outfit.id })
              }
              onLongPress={() => enterMultiselect(key)}
            >
              <OutfitCollage outfit={item.outfit} size={cardWidth} />
              <Text style={styles.outfitName} numberOfLines={1}>
                {item.outfit.name}
              </Text>
            </PressableScale>
            {selectionOverlay}
          </View>
        );
      }
      if (item.kind === 'storeFind') {
        return (
          <View style={styles.cell}>
            <PressableScale
              onPress={
                isMultiselect
                  ? () => toggleSelectedKey(key)
                  : () => setDetailStoreFind(item.storeFind)
              }
              onLongPress={() => enterMultiselect(key)}
            >
              <BoardStoreFindCard storeFind={item.storeFind} cardWidth={cardWidth} />
            </PressableScale>
            {selectionOverlay}
          </View>
        );
      }
      // wishlist
      const o = item.entry.outfit;
      return (
        <View style={styles.cell}>
          <PressableScale
            onLongPress={() => enterMultiselect(key)}
            onPress={isMultiselect ? () => toggleSelectedKey(key) : undefined}
          >
            <View style={[styles.wishlistTile, { width: cardWidth, height: cardWidth }]}>
              <Ionicons name="bag-handle-outline" size={26} color={colors.primary} />
              <Text style={styles.wishlistLabel} numberOfLines={1}>
                {o?.city ? `Shop · ${o.city}` : 'Shop outfit'}
              </Text>
              {!!o?.totalBudget && <Text style={styles.wishlistBudget}>{o.totalBudget}</Text>}
            </View>
          </PressableScale>
          {selectionOverlay}
        </View>
      );
    },
    [cardWidth, navigation, isMultiselect, selectedKeys, enterMultiselect, toggleSelectedKey],
  );

  const showInitialLoading = feed.isLoading && items.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {isMultiselect ? (
          <TouchableOpacity style={styles.headerBtn} onPress={exitMultiselect} accessibilityLabel="Cancel selection">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleWrap}>
          {isMultiselect ? (
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedKeys.size} selected
            </Text>
          ) : (
            <>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {board?.name ?? 'Board'}
              </Text>
              {pendingCount > 0 && (
                <View style={styles.syncDot} accessibilityLabel={`${pendingCount} pending sync`} />
              )}
            </>
          )}
        </View>
        {isMultiselect ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleDeleteSelected}
            disabled={selectedKeys.size === 0}
            accessibilityLabel="Remove selected"
          >
            <Ionicons name="trash-outline" size={22} color={colors.destructive} />
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setMenuVisible(true)} accessibilityLabel="Add to board">
              <Ionicons name="add" size={26} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={handleOverflow} accessibilityLabel="Board options">
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          {board?.name === 'Daily Finds' ? (
            <>
              <TouchableOpacity
                style={styles.emptyCamera}
                onPress={() => setStoreFindFormVisible(true)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Snap a photo to save it here"
              >
                <Ionicons name="camera-outline" size={56} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.emptyTitle}>Spotted something you like?</Text>
              <Text style={styles.emptySub}>Snap a photo to save it here.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setStoreFindFormVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Snap a photo"
              >
                <Ionicons name="camera-outline" size={16} color={colors.primaryForeground} />
                <Text style={styles.emptyBtnText}>Snap a photo</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.emptyIcon}>
                <Ionicons name="albums-outline" size={30} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptySub}>Save pieces, outfits, and shop finds to this board.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setMenuVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Add to board"
              >
                <Text style={styles.emptyBtnText}>Add to Board</Text>
              </TouchableOpacity>
            </>
          )}
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

      {menuVisible && (
        <BoardAddMenuSheet
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onPickItems={() => setItemPickerVisible(true)}
          onPickOutfits={() => setOutfitPickerVisible(true)}
          onPickWishlist={() => setWishlistPickerVisible(true)}
          onSnapStoreFind={() => setStoreFindFormVisible(true)}
        />
      )}
      {optionsMenuVisible && (
        <BoardOptionsMenuSheet
          visible={optionsMenuVisible}
          onClose={() => setOptionsMenuVisible(false)}
          onRename={handleRename}
          onChangeCover={handleChangeCover}
          onDelete={handleDelete}
        />
      )}
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
      <StoreFindFormModal
        visible={storeFindFormVisible || editingStoreFind !== null}
        onClose={() => {
          setStoreFindFormVisible(false);
          setEditingStoreFind(null);
        }}
        onSave={editingStoreFind ? handleEditSaveStoreFind : handleSaveStoreFind}
        initialValues={editingStoreFind ?? undefined}
      />
      <StoreFindDetailSheet
        storeFind={detailStoreFind}
        onClose={() => setDetailStoreFind(null)}
        onEdit={() => {
          if (!detailStoreFind) return;
          setEditingStoreFind(detailStoreFind);
          setDetailStoreFind(null);
        }}
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
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 1,
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
  cancelText: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: `${colors.primary}40`,
    borderRadius: radii.lg,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: spacing.xs,
  },
  selectionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyCamera: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.full,
  },
  emptyBtnText: {
    color: colors.primaryForeground,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.sm,
  },
});
