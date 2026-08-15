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
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GarmentCard } from '../../components/wardrobe/GarmentCard';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { PressableScale } from '../../components/primitives/PressableScale';
import { useBoards, useBoardFeed, flattenBoardFeed, useDeleteBoard, useUpdateBoard, useBoardEvent } from '../../hooks/useBoards';
import { formatCountdown, formatDayLabel } from '../../components/calendar/calendarUtils';
import type { BoardFeedItem } from '../../types/board';
import { colors, spacing, typography, radii } from '../../theme';
import type { BoardDetailScreenProps } from '../../navigation/types';
import { BoardOptionsMenuSheet } from '../../components/boards/BoardOptionsMenuSheet';
import { BoardContentPickerModal } from '../../components/boards/BoardContentPickerModal';
import { BoardCoverPickerModal } from '../../components/boards/BoardCoverPickerModal';
import { ShopWishlistDetailSheet } from '../../components/outfits/ShopWishlistDetailSheet';
import { WishlistOutfitPreview } from '../../components/outfits/WishlistOutfitPreview';
import type { WishlistEntry } from '../../lib/wishlist';
import {
  getWishlistAccessibilityLabel,
  getWishlistContext,
  getWishlistMeta,
  getWishlistTitle,
} from '../../lib/wishlistPresentation';
import { useLibraryLaunch } from '../../hooks/useCameraLaunch';
import {
  canComposeOutfit,
  filterBoardFeed,
  getBoardGap,
  getBoardInsights,
  type BoardFilter,
} from '../../lib/boardPresentation';
import { isLegacyDailyFindsBoard } from '../../lib/legacyBoards';
import { BoardCapsuleSheet } from '../../components/boards/BoardCapsuleSheet';
import { ensureEntitled } from '../../lib/entitlementGate';
import { useEntitlement } from '../../hooks/useEntitlement';
import { track } from '../../lib/analytics';

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
  const { boardId } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;

  const { isPremium } = useEntitlement();
  const { data: boards = [] } = useBoards();
  const board = boards.find((b) => b.id === boardId);
  const isDailyFinds = isLegacyDailyFindsBoard(board);
  const [filter, setFilter] = useState<BoardFilter>('all');

  const feed = useBoardFeed(boardId);

  const remoteItems = useMemo(() => {
    return flattenBoardFeed(feed.data?.pages);
  }, [feed.data?.pages]);

  const items = useMemo(() => {
    return remoteItems;
  }, [remoteItems]);

  const visibleItems = useMemo(() => {
    return filterBoardFeed(items, filter);
  }, [filter, items]);

  const boardInsights = useMemo(() => getBoardInsights(items), [items]);
  const boardGap = useMemo(() => getBoardGap(items), [items]);
  const canStyle = useMemo(() => canComposeOutfit(items), [items]);
  const boardEvent = useBoardEvent(boardId);

  // A past event gets a worn-date phrasing rather than a negative countdown;
  // formatCountdown returns null inside its own 1-day window too.
  const boardEventWhen = useMemo(() => {
    if (!boardEvent) return '';
    const date = new Date(boardEvent.date);
    if (date.getTime() < Date.now()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return formatCountdown(date) ?? formatDayLabel(date);
  }, [boardEvent]);

  const { mutate: deleteBoard } = useDeleteBoard();
  const { mutate: updateBoard } = useUpdateBoard();
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);
  const [contentPickerVisible, setContentPickerVisible] = useState(false);
  const [coverPickerVisible, setCoverPickerVisible] = useState(route.params.editCover === true);
  const [detailWishlistEntry, setDetailWishlistEntry] = useState<WishlistEntry | null>(null);
  const [organizeMode, setOrganizeMode] = useState(route.params.organize === true);
  const [capsuleVisible, setCapsuleVisible] = useState(false);
  const [lastRemoval, setLastRemoval] = useState<{
    count: number;
    itemIds: number[];
    outfitIds: number[];
    wishlistIds: string[];
  } | null>(null);

  useEffect(() => {
    if (!isDailyFinds) return;
    navigation.getParent()?.navigate('Shop', {
      screen: 'ShoppingGallery',
      params: { returnTo: 'Closet' },
    });
  }, [isDailyFinds, navigation]);

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
            });
            const itemIds = new Set<number>();
            const outfitIds = new Set<number>();
            const wishlistIds = new Set<string>();
            for (const key of selectedKeys) {
              if (key.startsWith('i')) itemIds.add(Number(key.slice(1)));
              else if (key.startsWith('o')) outfitIds.add(Number(key.slice(1)));
              else if (key.startsWith('w')) wishlistIds.add(key.slice(1));
            }
            updateBoard({
              id: boardId,
              itemIds: board.itemIds.filter((id) => !itemIds.has(id)),
              outfitIds: board.outfitIds.filter((id) => !outfitIds.has(id)),
              wishlistIds: board.wishlistIds.filter((id) => !wishlistIds.has(id)),
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
    });
    setLastRemoval(null);
  }, [boardId, lastRemoval, updateBoard]);

  const launchLibrary = useLibraryLaunch();

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

  /**
   * The chat gates itself on ensureEntitled inside openStylist; this path never
   * opens the chat, so it has to gate explicitly or free users would reach the
   * stylist route through a side door.
   */
  const handleStyleBoard = useCallback(async () => {
    const entitled = await ensureEntitled(isPremium, {
      title: 'Unlock your AI Stylist',
      message: 'Turn the pieces you have saved here into complete looks.',
    });
    if (!entitled) return;
    track('board_capsule_opened', { boardId });
    setCapsuleVisible(true);
  }, [boardId, isPremium]);

  const handleEventPress = useCallback(() => {
    if (!boardEvent) return;
    navigation.getParent()?.navigate('Calendar', { eventId: boardEvent.id });
  }, [boardEvent, navigation]);

  const handleGapPress = useCallback(() => {
    if (!boardGap) return;
    navigation.navigate('ClosetMain', { segment: 'pieces', category: boardGap.missing });
  }, [boardGap, navigation]);

  const handleDelete = useCallback(() => {
    // The FK is ON DELETE SET NULL, so a linked event survives but quietly
    // loses its board. Say so rather than letting it vanish unannounced.
    const eventNote = boardEvent ? ` "${boardEvent.title}" will no longer link to it.` : '';
    Alert.alert('Delete board', `Delete "${board?.name ?? 'this board'}"? Saved items stay in your closet.${eventNote}`, [
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
  }, [boardId, board?.name, boardEvent, deleteBoard, navigation]);

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

      {boardEvent && (
        <TouchableOpacity
          style={styles.eventStrip}
          onPress={handleEventPress}
          accessibilityRole="button"
          accessibilityLabel={`Planned for ${boardEvent.title}`}
          accessibilityHint="Opens this event in your calendar"
        >
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={styles.eventTitle} numberOfLines={1}>{boardEvent.title}</Text>
          <Text style={styles.eventWhen}>{boardEventWhen}</Text>
        </TouchableOpacity>
      )}

      {/* Mutually exclusive: a board either still needs something (say what),
          or it can compose a look (offer to). Never both. */}
      {boardGap ? (
        <TouchableOpacity
          style={styles.gapRow}
          onPress={handleGapPress}
          accessibilityRole="button"
          accessibilityLabel={boardGap.text}
          accessibilityHint="Opens your closet filtered to that category"
        >
          <Text style={styles.gapText} numberOfLines={2}>{boardGap.text}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      ) : canStyle ? (
        <TouchableOpacity
          style={styles.styleBoardBtn}
          onPress={handleStyleBoard}
          accessibilityRole="button"
          accessibilityLabel={`Style ${board?.name ?? 'this board'}`}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles" size={16} color={colors.primaryForeground} />
          <Text style={styles.styleBoardText}>Style this board</Text>
        </TouchableOpacity>
      ) : null}
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
              onPress={() => setContentPickerVisible(true)}
              accessibilityLabel="Add to board"
            >
              <Ionicons name="add" size={26} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={handleOverflow} accessibilityLabel="Board options">
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {boardTools}

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
          <Text style={styles.emptySub}>Save pieces, outfits, and wishlist looks to this board.</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => setContentPickerVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add to board"
          >
            <Text style={styles.emptyBtnText}>Add to Board</Text>
          </TouchableOpacity>
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
          boardName={board?.name ?? 'Board'}
          canRename={Platform.OS === 'ios'}
          onClose={() => setOptionsMenuVisible(false)}
          onRename={handleRename}
          onChangeCover={() => setCoverPickerVisible(true)}
          onUploadCover={handleUploadCover}
          onOrganize={() => setOrganizeMode(true)}
          onDelete={handleDelete}
        />
      )}
      <BoardContentPickerModal
        board={board ?? null}
        visible={contentPickerVisible}
        onClose={() => setContentPickerVisible(false)}
      />
      <BoardCoverPickerModal
        visible={coverPickerVisible}
        items={items}
        onClose={() => setCoverPickerVisible(false)}
        onSelect={handleSelectCover}
        onUpload={() => { setCoverPickerVisible(false); setTimeout(handleUploadCover, 300); }}
      />
      {detailWishlistEntry && (
        <ShopWishlistDetailSheet
          entry={detailWishlistEntry}
          onClose={() => setDetailWishlistEntry(null)}
          onRemove={removeDetailWishlistFromBoard}
          removalCopy={BOARD_WISHLIST_REMOVAL_COPY}
        />
      )}
      {capsuleVisible && board && (
        <BoardCapsuleSheet
          board={board}
          items={items.flatMap((entry) => (entry.kind === 'item' ? [entry.item] : []))}
          onClose={() => setCapsuleVisible(false)}
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
  gapRow: {
    minHeight: 44,
    marginHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gapText: { flex: 1, color: colors.mutedForeground, fontSize: typography.size.sm },
  eventStrip: {
    marginHorizontal: spacing.lg,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
  },
  eventTitle: { flex: 1, color: colors.secondaryForeground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  eventWhen: { color: colors.secondaryForeground, fontSize: typography.size.xs },
  styleBoardBtn: {
    marginHorizontal: spacing.lg,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  styleBoardText: {
    color: colors.primaryForeground,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
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
