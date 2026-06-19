import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';

import { GarmentCard } from '../../components/wardrobe/GarmentCard';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { PressableScale } from '../../components/primitives/PressableScale';
import { useBoards, useBoardFeed, flattenBoardFeed, useDeleteBoard, useUpdateBoard } from '../../hooks/useBoards';
import { useStoreFindSync } from '../../hooks/useStoreFindSync';
import { uploadLocalImages } from '../../lib/uploadLocalImages';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateItem } from '../../hooks/useItems';
import type { BoardFeedItem } from '../../types/board';
import { colors, spacing, typography, radii } from '../../theme';
import type { BoardDetailScreenProps } from '../../navigation/types';
import { BoardOptionsMenuSheet } from '../../components/boards/BoardOptionsMenuSheet';
import { BoardContentPickerModal } from '../../components/boards/BoardContentPickerModal';
import { BoardCoverPickerModal } from '../../components/boards/BoardCoverPickerModal';
import { StoreFindFormModal } from '../../components/boards/StoreFindFormModal';
import { DailyFindCaptureModal } from '../../components/boards/DailyFindCaptureModal';
import { BoardStoreFindCard } from '../../components/boards/BoardStoreFindCard';
import { StoreFindDetailSheet } from '../../components/boards/StoreFindDetailSheet';
import { ShopWishlistDetailSheet } from '../../components/outfits/ShopWishlistDetailSheet';
import { WishlistOutfitPreview } from '../../components/outfits/WishlistOutfitPreview';
import type { StoreFind } from '../../types/storeFind';
import type { WishlistEntry } from '../../lib/wishlist';
import {
  getWishlistAccessibilityLabel,
  getWishlistContext,
  getWishlistMeta,
  getWishlistTitle,
} from '../../lib/wishlistPresentation';
import { useLibraryLaunch } from '../../hooks/useCameraLaunch';
import type { CapturedLocation } from '../../lib/photoLocation';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import {
  buildBoardStylistPrompt,
  filterBoardFeed,
  getBoardInsights,
  type BoardAIIntent,
  type BoardFilter,
} from '../../lib/boardPresentation';

const SIDE_PAD = spacing.lg;
const COL_GAP = spacing.sm;
const CARD_ASPECT_RATIO = 0.85;
const BOARD_WISHLIST_REMOVAL_COPY = {
  title: 'Remove from board?',
  message: 'This outfit will stay in your Shop Wishlist.',
  confirmLabel: 'Remove',
  accessibilityLabel: 'Remove outfit from board',
};
const BOARD_FILTERS: { key: BoardFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'item', label: 'Pieces' },
  { key: 'outfit', label: 'Outfits' },
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'storeFind', label: 'Finds' },
];

const NAMED_SWATCHES: Record<string, string> = {
  black: '#28231F', white: '#FAF8F5', grey: '#8B8580', navy: '#25324A', blue: '#4C6F91',
  green: '#62775A', olive: '#77734D', red: '#9C4A45', burgundy: '#6B3540', pink: '#C98E9D',
  orange: '#C47842', yellow: '#D4B95D', brown: '#7B5B46', tan: '#B89A78', beige: '#D8C7AF',
  cream: '#F3EBDD', purple: '#735E7D', lavender: '#A79AB8', gold: '#B28A45', silver: '#A5A5A2',
};

function swatchColor(value: string): string {
  return /^#[0-9A-F]{6}$/i.test(value) ? value : NAMED_SWATCHES[value.toLowerCase()] ?? colors.secondary;
}

export function BoardDetailScreen({ route, navigation }: BoardDetailScreenProps) {
  const { boardId, autoOpenStoreFindForm } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;

  const { user } = useAuth();
  const { openStylist } = useGlobalAIStylist();
  const { data: boards = [] } = useBoards();
  const board = boards.find((b) => b.id === boardId);
  const isDailyFinds = board?.name === 'Daily Finds';
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [findSearch, setFindSearch] = useState('');
  const [findSort, setFindSort] = useState<'newest' | 'oldest' | 'priceAsc' | 'priceDesc'>('newest');
  const [findFiltersOpen, setFindFiltersOpen] = useState(false);
  const [findStoreFilter, setFindStoreFilter] = useState<string | null>(null);
  const [findSizeFilter, setFindSizeFilter] = useState<string | null>(null);
  const [findDateFilter, setFindDateFilter] = useState<'all' | 'today' | 'week'>('all');
  const [findPricedOnly, setFindPricedOnly] = useState(false);

  const feed = useBoardFeed(boardId);

  const remoteItems = useMemo(() => {
    return flattenBoardFeed(feed.data?.pages);
  }, [feed.data?.pages]);

  const {
    pendingFinds,
    pendingCount,
    queueFind,
    retry: retryStoreFinds,
    updateLocalFind,
    discardLocalFind,
  } = useStoreFindSync(boardId);

  const items = useMemo(() => {
    const pendingIds = new Set(pendingFinds.map((find) => find.id));
    const withoutDuplicateFinds = remoteItems.filter(
      (entry) => entry.kind !== 'storeFind' || !pendingIds.has(entry.storeFind.id),
    );
    return [
      ...pendingFinds.map((storeFind): BoardFeedItem => ({
        kind: 'storeFind',
        key: `sf_${storeFind.id}`,
        storeFind,
      })),
      ...withoutDuplicateFinds,
    ];
  }, [pendingFinds, remoteItems]);

  const dailyFinds = useMemo(
    () => items.filter((entry): entry is Extract<BoardFeedItem, { kind: 'storeFind' }> => entry.kind === 'storeFind'),
    [items],
  );
  const findStoreOptions = useMemo(
    () => Array.from(new Set(dailyFinds.map(({ storeFind }) => storeFind.store).filter((value): value is string => !!value))).slice(0, 8),
    [dailyFinds],
  );
  const findSizeOptions = useMemo(
    () => Array.from(new Set(dailyFinds.map(({ storeFind }) => storeFind.size).filter((value): value is string => !!value))).slice(0, 8),
    [dailyFinds],
  );

  const visibleItems = useMemo(() => {
    if (!isDailyFinds) return filterBoardFeed(items, filter);
    const query = findSearch.trim().toLowerCase();
    const finds = items
      .filter((entry): entry is Extract<BoardFeedItem, { kind: 'storeFind' }> => entry.kind === 'storeFind')
      .filter(({ storeFind }) => storeFind.status !== 'archived')
      .filter(({ storeFind }) => !findStoreFilter || storeFind.store === findStoreFilter)
      .filter(({ storeFind }) => !findSizeFilter || storeFind.size === findSizeFilter)
      .filter(({ storeFind }) => !findPricedOnly || storeFind.price != null)
      .filter(({ storeFind }) => {
        if (findDateFilter === 'all') return true;
        const age = Date.now() - new Date(storeFind.createdAt).getTime();
        return age <= (findDateFilter === 'today' ? 86_400_000 : 7 * 86_400_000);
      })
      .filter(({ storeFind }) => !query || [storeFind.store, storeFind.brand, storeFind.description, storeFind.notes]
        .some((value) => value?.toLowerCase().includes(query)));
    return finds.sort((a, b) => {
      if (findSort === 'oldest') return a.storeFind.createdAt.localeCompare(b.storeFind.createdAt);
      if (findSort === 'priceAsc') return (a.storeFind.price ?? Number.MAX_SAFE_INTEGER) - (b.storeFind.price ?? Number.MAX_SAFE_INTEGER);
      if (findSort === 'priceDesc') return (b.storeFind.price ?? -1) - (a.storeFind.price ?? -1);
      return b.storeFind.createdAt.localeCompare(a.storeFind.createdAt);
    });
  }, [filter, findDateFilter, findPricedOnly, findSearch, findSizeFilter, findSort, findStoreFilter, isDailyFinds, items]);

  const boardInsights = useMemo(() => getBoardInsights(items), [items]);

  const { mutate: deleteBoard } = useDeleteBoard();
  const { mutate: updateBoard } = useUpdateBoard();
  const createClosetItem = useCreateItem();
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);
  const [contentPickerVisible, setContentPickerVisible] = useState(false);
  const [coverPickerVisible, setCoverPickerVisible] = useState(route.params.editCover === true);
  const [storeFindFormVisible, setStoreFindFormVisible] = useState(false);
  const [detailStoreFind, setDetailStoreFind] = useState<StoreFind | null>(null);
  const [detailWishlistEntry, setDetailWishlistEntry] = useState<WishlistEntry | null>(null);
  const [editingStoreFind, setEditingStoreFind] = useState<StoreFind | null>(null);
  const [findCaptureVisible, setFindCaptureVisible] = useState(false);
  const [capturedFindImages, setCapturedFindImages] = useState<string[]>([]);
  const [capturedFindLocation, setCapturedFindLocation] = useState<CapturedLocation | null>(null);
  const [organizeMode, setOrganizeMode] = useState(route.params.organize === true);
  const [lastRemoval, setLastRemoval] = useState<{
    count: number;
    itemIds: number[];
    outfitIds: number[];
    wishlistIds: string[];
    storeFinds: StoreFind[];
  } | null>(null);

  // Auto-open the store find form when navigated from the "Daily Finds" home button.
  useEffect(() => {
    if (autoOpenStoreFindForm) setStoreFindFormVisible(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lastRemoval) return;
    const timeout = setTimeout(() => setLastRemoval(null), 7000);
    return () => clearTimeout(timeout);
  }, [lastRemoval]);

  // ── Multiselect ─────────────────────────────────────────────────────────────
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const isMultiselect = organizeMode;

  const enterMultiselect = useCallback((key: string) => {
    setOrganizeMode(true);
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
    setOrganizeMode(false);
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
            setLastRemoval({
              count,
              itemIds: board.itemIds,
              outfitIds: board.outfitIds,
              wishlistIds: board.wishlistIds,
              storeFinds: board.storeFinds ?? [],
            });
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

  const undoRemoval = useCallback(() => {
    if (!lastRemoval) return;
    updateBoard({
      id: boardId,
      itemIds: lastRemoval.itemIds,
      outfitIds: lastRemoval.outfitIds,
      wishlistIds: lastRemoval.wishlistIds,
      storeFinds: lastRemoval.storeFinds,
    });
    setLastRemoval(null);
  }, [boardId, lastRemoval, updateBoard]);

  const launchLibrary = useLibraryLaunch();

  const startFindCapture = useCallback(async () => {
    setFindCaptureVisible(true);
  }, []);

  const handleFindCaptured = useCallback((imageUris: string[], location: CapturedLocation | null) => {
    setCapturedFindImages(imageUris);
    setCapturedFindLocation(location);
    setStoreFindFormVisible(true);
  }, []);

  const handleSaveStoreFind = useCallback(async (data: Omit<StoreFind, 'id' | 'createdAt'>) => {
    const newFind: StoreFind = {
      ...data,
      id: Crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
      status: data.status ?? 'saved',
    };
    await queueFind(newFind, boardId, board?.name ?? 'Daily Finds');
  }, [board?.name, boardId, queueFind]);

  const handleEditSaveStoreFind = useCallback(async (data: Omit<StoreFind, 'id' | 'createdAt'>) => {
    if (!editingStoreFind) return;
    let updatedFind: StoreFind = { ...editingStoreFind, ...data };

    if (await updateLocalFind(updatedFind)) return;

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
  }, [editingStoreFind, board, boardId, updateBoard, updateLocalFind, user]);

  const handleDeleteStoreFind = useCallback((find: StoreFind) => {
    Alert.alert('Delete this find?', 'The saved photos and details will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void discardLocalFind(find.id).then((removedLocally) => {
            if (!removedLocally && board) {
              updateBoard({
                id: boardId,
                storeFinds: (board.storeFinds ?? []).filter((candidate) => candidate.id !== find.id),
              });
            }
            setDetailStoreFind(null);
          });
        },
      },
    ]);
  }, [board, boardId, discardLocalFind, updateBoard]);

  const handleMarkPurchased = useCallback(async (find: StoreFind) => {
    const imageUrl = find.imageUrls?.[0] ?? find.imageUrl;
    if (!imageUrl || imageUrl.startsWith('file://') || find.syncStatus !== 'synced') {
      Alert.alert('Waiting to sync', 'This find is safely stored. Add it to your closet after its photo finishes syncing.');
      return;
    }
    try {
      await createClosetItem.mutateAsync({
        name: find.description || find.brand || find.store || 'Purchased find',
        brand: find.brand,
        imageUrl,
        purchasePrice: find.price,
        purchaseDate: new Date().toISOString().slice(0, 10),
        purchaseLocation: find.store || find.location,
        notes: find.notes,
        needsDetails: true,
      });
      if (board) {
        const updated: StoreFind = { ...find, status: 'purchased' };
        updateBoard({
          id: boardId,
          storeFinds: (board.storeFinds ?? []).map((candidate) => candidate.id === find.id ? updated : candidate),
        });
      }
      setDetailStoreFind(null);
      Alert.alert('Added to closet', 'Your find is now ready for closet details.');
    } catch {
      // useCreateItem already presents the actionable error.
    }
  }, [board, boardId, createClosetItem, updateBoard]);

  const handleArchiveStoreFind = useCallback(async (find: StoreFind) => {
    const archived = { ...find, status: 'archived' as const };
    if (!(await updateLocalFind(archived)) && board) {
      updateBoard({
        id: boardId,
        storeFinds: (board.storeFinds ?? []).map((candidate) => candidate.id === find.id ? archived : candidate),
      });
    }
    setDetailStoreFind(null);
  }, [board, boardId, updateBoard, updateLocalFind]);

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

  const handleUploadCover = useCallback(async () => {
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

  const handleSelectCover = useCallback((coverImageUrl: string | null) => {
    updateBoard({ id: boardId, coverImageUrl });
    setCoverPickerVisible(false);
  }, [boardId, updateBoard]);

  const openBoardStylist = useCallback((intent: BoardAIIntent) => {
    if (!board) return;
    openStylist({
      source: 'board_detail',
      destination: board.name,
      initialQuery: buildBoardStylistPrompt(board.name, items, intent),
    });
  }, [board, items, openStylist]);

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

  const removeDetailWishlistFromBoard = useCallback(() => {
    if (!board || !detailWishlistEntry) return;
    updateBoard(
      { id: boardId, wishlistIds: board.wishlistIds.filter((id) => id !== detailWishlistEntry.id) },
      { onSuccess: () => setDetailWishlistEntry(null) },
    );
  }, [board, boardId, detailWishlistEntry, updateBoard]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BoardFeedItem>) => {
      const key = item.key;
      const isSelected = selectedKeys.has(key);

      const selectionOverlay = isMultiselect ? (
        <View style={[styles.selectionOverlay, !isSelected && styles.selectionOverlayIdle]} pointerEvents="none">
          <View style={[styles.selectionCheck, !isSelected && styles.selectionCheckIdle]}>
            {isSelected && <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />}
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
      const wishlistContext = getWishlistContext(item.entry);
      return (
        <View style={styles.cell}>
          <PressableScale
            onLongPress={() => enterMultiselect(key)}
            onPress={isMultiselect ? () => toggleSelectedKey(key) : () => setDetailWishlistEntry(item.entry)}
            accessibilityRole="button"
            accessibilityLabel={getWishlistAccessibilityLabel(item.entry)}
            accessibilityHint={isMultiselect ? 'Selects this outfit' : 'Opens outfit details'}
          >
            <View style={[styles.wishlistTile, { width: cardWidth, height: cardWidth }]}>
              <WishlistOutfitPreview entry={item.entry} style={styles.wishlistPreview} />
              <View style={styles.wishlistInfo}>
                {!!wishlistContext && <Text style={styles.wishlistContext} numberOfLines={1}>{wishlistContext}</Text>}
                <Text style={styles.wishlistLabel} numberOfLines={2}>{getWishlistTitle(item.entry)}</Text>
                <Text style={styles.wishlistBudget} numberOfLines={1}>{getWishlistMeta(item.entry)}</Text>
              </View>
            </View>
          </PressableScale>
          {selectionOverlay}
        </View>
      );
    },
    [cardWidth, navigation, isMultiselect, selectedKeys, enterMultiselect, toggleSelectedKey],
  );

  const showInitialLoading = feed.isLoading && items.length === 0;

  const dailyFindTools = !organizeMode ? (
    <View style={styles.dailyFindTools}>
      <View style={styles.dailyFindSearch}>
        <Ionicons name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          style={styles.dailyFindSearchInput}
          value={findSearch}
          onChangeText={setFindSearch}
          placeholder="Search store, brand or notes"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          accessibilityLabel="Search Daily Finds"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dailySortRow}>
        {([
          ['newest', 'Newest'],
          ['oldest', 'Oldest'],
          ['priceAsc', 'Price ↑'],
          ['priceDesc', 'Price ↓'],
        ] as const).map(([value, label]) => (
          <TouchableOpacity
            key={value}
            style={[styles.dailySortChip, findSort === value && styles.dailySortChipActive]}
            onPress={() => setFindSort(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: findSort === value }}
          >
            <Text style={[styles.dailySortText, findSort === value && styles.dailySortTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
        {pendingCount > 0 && (
          <TouchableOpacity style={styles.syncStatusChip} onPress={() => { void retryStoreFinds(); }}>
            <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} />
            <Text style={styles.syncStatusText}>{pendingCount} waiting · Retry</Text>
          </TouchableOpacity>
        )}
        {dailyFinds.length >= 8 && (
          <TouchableOpacity
            style={[styles.syncStatusChip, findFiltersOpen && styles.dailySortChipActive]}
            onPress={() => setFindFiltersOpen((open) => !open)}
          >
            <Ionicons name="options-outline" size={14} color={findFiltersOpen ? colors.primaryForeground : colors.primary} />
            <Text style={[styles.syncStatusText, findFiltersOpen && styles.dailySortTextActive]}>Filters</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      {findFiltersOpen && dailyFinds.length >= 8 && (
        <View style={styles.findFilterPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dailySortRow}>
            <TouchableOpacity style={[styles.dailySortChip, findDateFilter === 'today' && styles.dailySortChipActive]} onPress={() => setFindDateFilter(findDateFilter === 'today' ? 'all' : 'today')}>
              <Text style={[styles.dailySortText, findDateFilter === 'today' && styles.dailySortTextActive]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dailySortChip, findDateFilter === 'week' && styles.dailySortChipActive]} onPress={() => setFindDateFilter(findDateFilter === 'week' ? 'all' : 'week')}>
              <Text style={[styles.dailySortText, findDateFilter === 'week' && styles.dailySortTextActive]}>This week</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dailySortChip, findPricedOnly && styles.dailySortChipActive]} onPress={() => setFindPricedOnly((value) => !value)}>
              <Text style={[styles.dailySortText, findPricedOnly && styles.dailySortTextActive]}>Has price</Text>
            </TouchableOpacity>
            {findStoreOptions.map((store) => (
              <TouchableOpacity key={store} style={[styles.dailySortChip, findStoreFilter === store && styles.dailySortChipActive]} onPress={() => setFindStoreFilter(findStoreFilter === store ? null : store)}>
                <Text style={[styles.dailySortText, findStoreFilter === store && styles.dailySortTextActive]}>{store}</Text>
              </TouchableOpacity>
            ))}
            {findSizeOptions.map((size) => (
              <TouchableOpacity key={`size-${size}`} style={[styles.dailySortChip, findSizeFilter === size && styles.dailySortChipActive]} onPress={() => setFindSizeFilter(findSizeFilter === size ? null : size)}>
                <Text style={[styles.dailySortText, findSizeFilter === size && styles.dailySortTextActive]}>Size {size}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  ) : null;

  const boardTools = !organizeMode ? (
    <View style={styles.tools}>
      {items.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {BOARD_FILTERS.map((option) => {
            const count = option.key === 'all' ? items.length : items.filter((entry) => entry.kind === option.key).length;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.filterChip, filter === option.key && styles.filterChipActive]}
                onPress={() => setFilter(option.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === option.key }}
              >
                <Text style={[styles.filterText, filter === option.key && styles.filterTextActive]}>{option.label} · {count}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {(boardInsights.colors.length > 0 || boardInsights.categories.length > 0) && (
        <View style={styles.insightRow}>
          {boardInsights.colors.length > 0 && (
            <View style={styles.palette} accessibilityLabel={`Board palette: ${boardInsights.colors.join(', ')}`}>
              {boardInsights.colors.map((color, index) => <View key={`${color}-${index}`} style={[styles.swatch, { backgroundColor: swatchColor(color) }]} />)}
            </View>
          )}
          {boardInsights.categories.length > 0 && (
            <Text style={styles.insightText} numberOfLines={1}>
              {boardInsights.categories.map(([name, count]) => `${name} ${count}`).join(' · ')}
            </Text>
          )}
        </View>
      )}

      <View style={styles.aiCard}>
        <View style={styles.aiHeading}>
          <View style={styles.aiIcon}><Ionicons name="sparkles" size={16} color={colors.primary} /></View>
          <View style={styles.aiHeadingText}>
            <Text style={styles.aiTitle}>Style this board</Text>
            <Text style={styles.aiSubtitle}>AI suggestions only—nothing is saved without you.</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aiActions}>
          <TouchableOpacity style={styles.aiAction} onPress={() => openBoardStylist('outfit')}><Ionicons name="shirt-outline" size={16} color={colors.primary} /><Text style={styles.aiActionText}>Create outfit</Text></TouchableOpacity>
          <TouchableOpacity style={styles.aiAction} onPress={() => openBoardStylist('complete')}><Ionicons name="add-circle-outline" size={16} color={colors.primary} /><Text style={styles.aiActionText}>Complete board</Text></TouchableOpacity>
          <TouchableOpacity style={styles.aiAction} onPress={() => openBoardStylist('capsule')}><Ionicons name="briefcase-outline" size={16} color={colors.primary} /><Text style={styles.aiActionText}>Capsule plan</Text></TouchableOpacity>
          <TouchableOpacity style={styles.aiAction} onPress={() => openBoardStylist('theme')}><Ionicons name="color-palette-outline" size={16} color={colors.primary} /><Text style={styles.aiActionText}>Theme & palette</Text></TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  ) : (
    <View style={styles.organizeBanner}>
      <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
      <Text style={styles.organizeText}>Tap anything you want to remove. Your closet stays unchanged.</Text>
    </View>
  );

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
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => { if (isDailyFinds) void startFindCapture(); else setContentPickerVisible(true); }}
              accessibilityLabel={isDailyFinds ? 'Snap a Daily Find' : 'Add to board'}
            >
              <Ionicons name={isDailyFinds ? 'camera-outline' : 'add'} size={isDailyFinds ? 23 : 26} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={handleOverflow} accessibilityLabel="Board options">
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isDailyFinds ? dailyFindTools : boardTools}

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
                onPress={() => { void startFindCapture(); }}
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
                onPress={() => { void startFindCapture(); }}
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
                onPress={() => setContentPickerVisible(true)}
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
            data={visibleItems}
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
            ListEmptyComponent={
              <View style={styles.filteredEmpty}>
                <Text style={styles.emptyTitle}>Nothing in this section</Text>
                <Text style={styles.emptySub}>Try another filter or add something new.</Text>
              </View>
            }
          />
        </View>
      )}

      {optionsMenuVisible && (
        <BoardOptionsMenuSheet
          visible={optionsMenuVisible}
          onClose={() => setOptionsMenuVisible(false)}
          onRename={handleRename}
          onChangeCover={() => setCoverPickerVisible(true)}
          onOrganize={() => setOrganizeMode(true)}
          onDelete={handleDelete}
        />
      )}
      <BoardContentPickerModal
        board={board ?? null}
        visible={contentPickerVisible}
        onClose={() => setContentPickerVisible(false)}
        onAddStoreFind={() => { void startFindCapture(); }}
      />
      <BoardCoverPickerModal
        visible={coverPickerVisible}
        items={items}
        onClose={() => setCoverPickerVisible(false)}
        onSelect={handleSelectCover}
        onUpload={() => { setCoverPickerVisible(false); setTimeout(handleUploadCover, 300); }}
      />
      <StoreFindFormModal
        visible={storeFindFormVisible || editingStoreFind !== null}
        onClose={() => {
          setStoreFindFormVisible(false);
          setEditingStoreFind(null);
          setCapturedFindImages([]);
          setCapturedFindLocation(null);
        }}
        onSave={editingStoreFind ? handleEditSaveStoreFind : handleSaveStoreFind}
        initialValues={editingStoreFind ?? undefined}
        initialImageUris={capturedFindImages}
        initialLocation={capturedFindLocation}
        onSaveAndAddAnother={editingStoreFind ? undefined : async (data) => {
          await handleSaveStoreFind(data);
          setTimeout(() => { void startFindCapture(); }, 350);
        }}
      />
      <DailyFindCaptureModal
        visible={findCaptureVisible}
        onClose={() => setFindCaptureVisible(false)}
        onCaptured={handleFindCaptured}
      />
      <StoreFindDetailSheet
        storeFind={detailStoreFind}
        onClose={() => setDetailStoreFind(null)}
        onEdit={() => {
          if (!detailStoreFind) return;
          setEditingStoreFind(detailStoreFind);
          setDetailStoreFind(null);
        }}
        onRetry={detailStoreFind?.syncStatus === 'failed' || detailStoreFind?.syncStatus === 'pending'
          ? () => { void retryStoreFinds(detailStoreFind.id); }
          : undefined}
        onDelete={detailStoreFind ? () => handleDeleteStoreFind(detailStoreFind) : undefined}
        onMarkPurchased={detailStoreFind ? () => { void handleMarkPurchased(detailStoreFind); } : undefined}
        onArchive={detailStoreFind ? () => { void handleArchiveStoreFind(detailStoreFind); } : undefined}
      />
      {detailWishlistEntry && (
        <ShopWishlistDetailSheet
          entry={detailWishlistEntry}
          onClose={() => setDetailWishlistEntry(null)}
          onRemove={removeDetailWishlistFromBoard}
          removalCopy={BOARD_WISHLIST_REMOVAL_COPY}
        />
      )}
      {lastRemoval && (
        <View style={[styles.undoToast, { bottom: insets.bottom + spacing.lg }]} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.undoToastText}>{lastRemoval.count} removed from board</Text>
          <TouchableOpacity style={styles.undoToastButton} onPress={undoRemoval} accessibilityRole="button">
            <Text style={styles.undoToastAction}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
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
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  wishlistPreview: { width: '100%', height: '52%', borderRadius: 0 },
  wishlistInfo: { flex: 1, justifyContent: 'center', gap: 2, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  wishlistContext: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primary },
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
  selectionOverlayIdle: { backgroundColor: 'transparent' },
  selectionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCheckIdle: { backgroundColor: colors.surfaceElevated, borderWidth: 2, borderColor: colors.border },
  tools: { gap: spacing.sm, paddingBottom: spacing.sm },
  dailyFindTools: { gap: spacing.sm, paddingBottom: spacing.sm },
  dailyFindSearch: {
    minHeight: 44,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dailyFindSearchInput: { flex: 1, color: colors.foreground, fontSize: typography.size.sm, paddingVertical: 0 },
  dailySortRow: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  dailySortChip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
  },
  dailySortChipActive: { backgroundColor: colors.primary },
  dailySortText: { color: colors.mutedForeground, fontSize: typography.size.xs, fontWeight: typography.weight.medium },
  dailySortTextActive: { color: colors.primaryForeground, fontWeight: typography.weight.semibold },
  syncStatusChip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  syncStatusText: { color: colors.primary, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  findFilterPanel: { paddingTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  filterRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterText: { color: colors.mutedForeground, fontSize: typography.size.xs, fontWeight: typography.weight.medium, fontVariant: ['tabular-nums'] },
  filterTextActive: { color: colors.primaryForeground, fontWeight: typography.weight.semibold },
  insightRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  palette: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 22, height: 22, borderRadius: 11, marginRight: -4, borderWidth: 2, borderColor: colors.background },
  insightText: { flex: 1, color: colors.mutedForeground, fontSize: typography.size.xs },
  aiCard: { marginHorizontal: spacing.lg, padding: spacing.md, gap: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  aiHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  aiHeadingText: { flex: 1 },
  aiTitle: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  aiSubtitle: { color: colors.mutedForeground, fontSize: typography.size.xs },
  aiActions: { gap: spacing.sm },
  aiAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: colors.accent },
  aiActionText: { color: colors.secondaryForeground, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  organizeBanner: { minHeight: 48, marginHorizontal: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.accent },
  organizeText: { flex: 1, color: colors.secondaryForeground, fontSize: typography.size.xs },
  filteredEmpty: { paddingTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs },
  undoToast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    minHeight: 52,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  undoToastText: { flex: 1, color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  undoToastButton: { minWidth: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  undoToastAction: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
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
