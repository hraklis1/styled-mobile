import { confirmSheet } from '../../components/primitives/ConfirmSheet';
import { itemThumbUri } from '../../lib/itemImage';
import { useAuth } from '../../contexts/AuthContext';
import { useClosetSearchHistory } from '../../hooks/useClosetSearchHistory';
import { ClosetSearchFilters } from '../../components/wardrobe/closet-search-filters';
import { addSearchFilter, combineSearchFilters, matchesSearch, searchRecord } from '../../lib/closet-search';
import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type FlashListRef } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, ReduceMotion, useSharedValue, useAnimatedScrollHandler, runOnJS } from 'react-native-reanimated';
import { ClosetHeader } from '../../components/wardrobe/closet-header';
import { useSelection } from '../../features/closet-selection/useSelection';
import { useHideTabBar } from '../../features/closet-selection/useHideTabBar';
import { SelectionActionBar, selectionBarClearance } from '../../features/closet-selection/SelectionActionBar';
import { SelectionCheck } from '../../features/closet-selection/SelectionCheck';
import { UndoToast } from '../../components/primitives/UndoToast';
import { TAB_BAR_CLEARANCE } from '../../components/primitives/FloatingTray';
import * as Haptics from '../../lib/haptics';
import { ClosetNavigation } from '../../components/wardrobe/closet-navigation';
import { ClosetViewMenu } from '../../components/wardrobe/closet-view-menu';
import { AnimatedClosetList } from '../../components/wardrobe/animated-closet-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useItems, useUpdateItem, useDeleteItem, useMarkItemWorn } from '../../hooks/useItems';
import { useOutfits, useMarkOutfitWorn, useDeleteOutfit, useUpdateOutfit } from '../../hooks/useOutfits';
import { useEvents } from '../../hooks/useEvents';
import { useClosetFilters, type SortKey, type OutfitSortKey } from '../../hooks/useClosetFilters';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { OutfitBuilderSheet } from '../../components/outfits/OutfitBuilderSheet';
import { FilterPanel } from '../../components/wardrobe/FilterPanel';
import { OutfitFilterPanel } from '../../components/outfits/OutfitFilterPanel';
import { ClosetGrid } from '../../components/wardrobe/ClosetGrid';
import { ClosetRails, type ClosetRail } from '../../components/wardrobe/ClosetRails';
import { ListScrubber, buildScrubberEntries, nameInitial } from '../../components/wardrobe/ListScrubber';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BoardCard } from '../../components/boards/BoardCard';
import { BoardOptionsMenuSheet } from '../../components/boards/BoardOptionsMenuSheet';
import { BoardNameSheet } from '../../components/boards/BoardNameSheet';
import { SaveToBoardSheet } from '../../components/boards/SaveToBoardSheet';
import { useBoards, useCreateBoard, useDeleteBoard, useUpdateBoard, type BoardEntryRef } from '../../hooks/useBoards';
import { filterVisibleBoards } from '../../lib/legacyBoards';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { parseEventDate } from '../../lib/outfitAssignments';
import { CATEGORY_LABELS, OCCASION_LABELS, SLEEVE_LENGTH_LABELS, type Item, type ItemCategory } from '../../types/item';
import { colors, editorial, shadows, spacing, surfaces, typography, radii } from '../../theme';
import { useGlobalScan } from '../../contexts/GlobalScanContext';
import { useGlobalAddSheet } from '../../contexts/GlobalAddSheetContext';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { useFabScroll } from '../../contexts/FabScrollContext';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { PressableScale } from '../../components/primitives/PressableScale';
import { SearchField } from '../../components/primitives/SearchField';
import { GarmentCardSkeleton } from '../../components/primitives/GarmentCardSkeleton';
import { SkeletonBlock } from '../../components/primitives/SkeletonLoader';
import { ErrorState } from '../../components/primitives/ErrorState';
import type { ClosetScreenProps } from '../../navigation/types';
import { useLibraryLaunch } from '../../hooks/useCameraLaunch';
import type { Board } from '../../types/board';
import { GarmentImage } from '../../components/wardrobe/garment-image';
import { PolishingBadge } from '../../components/wardrobe/PolishingBadge';
import {
  getItemCardAccessibilityLabel,
  hasActivePieceFilters,
  shouldClearActiveSubcategory,
  wearHistoryLabel, resolveClosetAnchor, closetAnchorViewOffset, closetOffsetForLayout, type ClosetAnchor,
} from '../../lib/closet-presentation';
import { shouldShowBoardSearch } from '../../lib/boardPresentation';
import {
  loadPiecesViewMode,
  gridColumns,
  pinchViewMode,
  savePiecesViewMode,
  type PiecesViewMode,
} from '../../lib/closet-preferences';
import { ItemSecondaryMeta } from '../../components/wardrobe/item-secondary-meta';

type ViewMode = PiecesViewMode;
type Segment = 'pieces' | 'outfits' | 'boards';
type BoardNameMode =
  | { kind: 'new' }
  | { kind: 'rename'; board: Board };

const OUTFIT_SORT_OPTIONS: { key: OutfitSortKey; label: string }[] = [
  { key: 'newest',        label: 'Newest first' },
  { key: 'oldest',        label: 'Oldest first' },
  { key: 'most_worn',     label: 'Most worn' },
  { key: 'recently_worn', label: 'Recently worn' },
  { key: 'name_asc',      label: 'Name A → Z' },
];

const SIDE_PAD = spacing.page;
/** Matches the 12 piece names handleStyleSelected spells out for the stylist. */
const MAX_STYLIST_SELECTION = 12;

function pluralCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
const COL_GAP  = spacing.grid;
const STARTER_BOARD_NAMES = ['Workwear', 'Vacation', 'Never Worn', 'Seasonal Rotation'];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest',        label: 'Newest first' },
  { key: 'oldest',        label: 'Oldest first' },
  { key: 'name_asc',      label: 'Name A → Z' },
  { key: 'name_desc',     label: 'Name Z → A' },
  { key: 'most_worn',     label: 'Most worn' },
  { key: 'least_worn',    label: 'Least worn' },
  { key: 'recently_worn', label: 'Recently worn' },
  { key: 'cost_per_wear', label: 'Cost per wear' },
];

function FadedPillScroll({ children }: { children: ReactNode }) {
  const viewportWidth = useRef(0);
  const contentWidth = useRef(0);
  const offsetX = useRef(0);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const syncFades = useCallback(() => {
    setShowLeftFade(offsetX.current > 4);
    setShowRightFade(
      contentWidth.current > viewportWidth.current
      && offsetX.current + viewportWidth.current < contentWidth.current - 4,
    );
  }, []);

  return (
    <View style={styles.pillScrollWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={styles.pillContent}
        onLayout={(event) => {
          viewportWidth.current = event.nativeEvent.layout.width;
          syncFades();
        }}
        onContentSizeChange={(width) => {
          contentWidth.current = width;
          syncFades();
        }}
        onScroll={(event) => {
          offsetX.current = event.nativeEvent.contentOffset.x;
          syncFades();
        }}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
      {showLeftFade ? (
        <LinearGradient
          pointerEvents="none"
          colors={[colors.background, 'rgba(251,250,247,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.pillFade, styles.pillFadeLeft]}
        />
      ) : null}
      {showRightFade ? (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(251,250,247,0)', colors.background]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.pillFade, styles.pillFadeRight]}
        />
      ) : null}
    </View>
  );
}

export function ClosetScreen({ navigation, route }: ClosetScreenProps) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { openScanItem, openFromPhotos } = useGlobalScan();
  const { openAddSheet } = useGlobalAddSheet();
  const { openStylist } = useGlobalAIStylist();
  const { fabCollapsed } = useFabScroll();

  const [segment, setSegment]               = useState<Segment>('pieces');
  const { user } = useAuth();
  const [searchAccount, setSearchAccount] = useState(user?.id ?? null);
  const history = useClosetSearchHistory(user?.id ?? null, segment);
  const [piecesSearch, setPiecesSearch] = useState('');
  const [outfitsSearch, setOutfitsSearch] = useState('');
  const [boardSearch, setBoardSearch]       = useState('');
  const [searchFilters, setSearchFilters] = useState<Record<Segment, string[]>>({ pieces: [], outfits: [], boards: [] });
  const [searchVisibility, setSearchVisibility] = useState<Record<Segment, boolean>>({ pieces: false, outfits: false, boards: false });
  const [categoryScrollReset, setCategoryScrollReset] = useState(0);
  const [searchFocusRequest, setSearchFocusRequest] = useState<Segment | null>(null);
  // Reset before rendering another account's query or recent searches.
  if (searchAccount !== (user?.id ?? null)) {
    setSearchAccount(user?.id ?? null);
    setPiecesSearch(''); setOutfitsSearch(''); setBoardSearch('');
    setSearchFilters({ pieces: [], outfits: [], boards: [] });
    setSearchVisibility({ pieces: false, outfits: false, boards: false });
    setSearchFocusRequest(null);
  }
  const activeQuery = segment === 'pieces' ? piecesSearch : segment === 'outfits' ? outfitsSearch : boardSearch;
  const setActiveQuery = segment === 'pieces' ? setPiecesSearch : segment === 'outfits' ? setOutfitsSearch : setBoardSearch;
  const activeSearchFilters = searchFilters[segment];
  const effectiveSearch = combineSearchFilters(activeSearchFilters, activeQuery);
  const setActiveSearchFilters = (next: string[]) => setSearchFilters(current => ({ ...current, [segment]: next }));

  const pendingHeaderAnchor = useRef<Segment | null>(null);
  const [piecesViewMode, setPiecesViewMode] = useState<PiecesViewMode>('grid');
  const [outfitViewMode, setOutfitViewMode] = useState<ViewMode>('grid');
  const piecesViewTouched = useRef(false);
  const piecesGridRef = useRef<FlashListRef<Item>>(null);
  const piecesListRef = useRef<FlashListRef<Item>>(null);
  const piecesRailsRef = useRef<FlashListRef<ClosetRail>>(null);
  const outfitListRef = useRef<FlashListRef<(typeof outfits)[number]>>(null);
  const boardListRef = useRef<FlashListRef<Board>>(null);

  const [outfitBuilderVisible, setOutfitBuilderVisible] = useState(false);
  const [outfitBuilderItems, setOutfitBuilderItems]     = useState<typeof items>([]);

  useEffect(() => {
    let cancelled = false;
    void loadPiecesViewMode().then((storedViewMode) => {
      if (!cancelled && !piecesViewTouched.current) setPiecesViewMode(storedViewMode);
    });
    return () => { cancelled = true; };
  }, []);

  const { data: items = [], isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useItems();
  const { data: outfits = [] } = useOutfits();
  const { data: events = [] } = useEvents();
  const { data: boards = [], isLoading: boardsLoading } = useBoards();

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const outfitMap = useMemo(() => new Map(outfits.map((o) => [o.id, o])), [outfits]);
  const boardRecords = useMemo(() => new Map(boards.map(b => [b.id, searchRecord([b.name])])), [boards]);
  const sortedBoards = useMemo(() => {
      return filterVisibleBoards(boards)
      .filter((board) => matchesSearch(boardRecords.get(board.id) ?? '', combineSearchFilters(searchFilters.boards, boardSearch)))
    }, [boardSearch, boards, boardRecords, searchFilters.boards]);
  const showBoardSearch = shouldShowBoardSearch(boards) || searchVisibility.boards || !!boardSearch.trim() || searchFilters.boards.length > 0;
  const visibleBoardCount = filterVisibleBoards(boards).length;
  const createBoard = useCreateBoard();
  const updateBoard = useUpdateBoard();
  const deleteBoard = useDeleteBoard();
  const launchLibrary = useLibraryLaunch();

  // SaveToBoardSheet target for the bulk "Add to Board" action.
  const [saveSheetTarget, setSaveSheetTarget] = useState<BoardEntryRef[] | null>(null);
  const [boardOptionsTarget, setBoardOptionsTarget] = useState<Board | null>(null);
  const [boardNameMode, setBoardNameMode] = useState<BoardNameMode | null>(null);
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const markWorn = useMarkItemWorn();
  const markOutfitWorn = useMarkOutfitWorn();
  const deleteOutfit = useDeleteOutfit();
  const updateOutfit = useUpdateOutfit();
  const {
    sortKey, setSortKey,
    filterSheetOpen, setFilterSheetOpen,
    selectedColors, setSelectedColors,
    selectedBrands, setSelectedBrands,
    selectedSeasons, setSelectedSeasons,
    selectedConditions, setSelectedConditions,
    selectedWarmth, setSelectedWarmth,
    selectedCategories, setSelectedCategories,
    selectedOccasions, setSelectedOccasions,
    selectedStatuses, setSelectedStatuses,
    selectedMaterials, setSelectedMaterials,
    selectedSleeveLengths, setSelectedSleeveLengths,
    activeSubcategory, setActiveSubcategory,
    outfitSortKey, setOutfitSortKey,
    outfitFilterSheetOpen, setOutfitFilterSheetOpen,
    outfitSelectedTags, setOutfitSelectedTags,
    outfitShowAssigned, setOutfitShowAssigned,
    outfitShowNeverWorn, setOutfitShowNeverWorn,
    outfitShowFavorites, setOutfitShowFavorites,
    allColors, allBrands, allSeasons, allMaterials, allSleeveLengths,
    activeFilterCount,
    allOutfitTags, upcomingAssignmentSummaries,
    outfitActiveFilterCount,
    availableCategories, availableSubcategories,
    filteredItems, filteredOutfits, categoryRecoveryCount,
    clearSheetFilters, clearOutfitFilters, clearPieceFilters, clearOutfitFiltersOnly, canResetPieces, canResetOutfits,
  } = useClosetFilters({ items, outfits, events,
    piecesSearch: combineSearchFilters(searchFilters.pieces, piecesSearch),
    outfitsSearch: combineSearchFilters(searchFilters.outfits, outfitsSearch),
  });


  const clearPieceFiltersAndResetCategories = () => {
    clearPieceFilters();
    setCategoryScrollReset(value => value + 1);
  };

  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;
  const outfitColumns = outfitViewMode === 'grid3' ? 3 : 2;
  const outfitCardWidth = (width - SIDE_PAD * 2 - COL_GAP * (outfitColumns - 1)) / outfitColumns;
  const outfitTileHeight = Math.round(outfitCardWidth / editorial.outfitAspectRatio);

  const hasCategoryPills = segment === 'pieces' && availableCategories.length > 0;
  const [headerHeight, setHeaderHeight] = useState(112);
  const [collapseDistance, setCollapseDistance] = useState(32);
  const scrollY = useSharedValue(0);
  const listPaddingTop = headerHeight;
  const anchors = useRef<Record<Segment, ClosetAnchor | null>>({ pieces: null, outfits: null, boards: null });
  const restoring = useRef(false);
  const restorationGeneration = useRef(0);
  const resettingResults = useRef(false);
  const getActiveList = useCallback(() => segment === 'pieces'
    ? (piecesViewMode === 'rails' ? piecesRailsRef.current as unknown as FlashListRef<Item> | null : piecesViewMode !== 'list' ? piecesGridRef.current : piecesListRef.current)
    : segment === 'outfits' ? outfitListRef.current : boardListRef.current,
  [segment, piecesViewMode]);
  // Re-tapping the Closet tab scrolls whichever segment is showing back to the top.
  const getActiveListRef = useRef(getActiveList);
  getActiveListRef.current = getActiveList;
  const scrollToTopTarget = useRef({
    scrollToTop: () => getActiveListRef.current()?.scrollToOffset({ offset: 0, animated: true }),
  });
  useScrollToTop(scrollToTopTarget);
  const pieceSelection = useSelection(filteredItems);
  const outfitSelection = useSelection(filteredOutfits);
  const { active: selectionMode, ids: selectedIds, toggle: toggleSelect, exit: exitSelectionMode, enter: enterPieceSelection } = pieceSelection;
  const { active: outfitSelectionMode, ids: selectedOutfitIds, toggle: toggleOutfitSelect, exit: exitOutfitSelectionMode, enter: enterOutfitSelection } = outfitSelection;
  useHideTabBar(selectionMode || outfitSelectionMode, navigation);
  const listPaddingBottom = selectionMode || outfitSelectionMode
    ? Math.max(spacing.xxxl * 2, selectionBarClearance(insets.bottom, selectionMode))
    : spacing.xxxl * 2;
  const [selectionToast, setSelectionToast] = useState<string | null>(null);
  useEffect(() => {
    if (!selectionToast) return;
    const timer = setTimeout(() => setSelectionToast(null), 2600);
    return () => clearTimeout(timer);
  }, [selectionToast]);
  const finishBulkAction = useCallback((message: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectionToast(message);
  }, []);

  const activeItems = segment === 'pieces' ? filteredItems : segment === 'outfits' ? filteredOutfits : sortedBoards;
  // Rails hold shelves, not pieces: item anchors don't apply, so they restore to the top.
  const anchorable = !(segment === 'pieces' && piecesViewMode === 'rails');
  const columns = segment === 'pieces' ? gridColumns(piecesViewMode) : segment === 'outfits' ? (outfitViewMode === 'list' ? 1 : outfitViewMode === 'grid3' ? 3 : 2) : 2;

  const capturePosition = useCallback(() => {
    const list = getActiveList();
    if (!list || !anchorable || resettingResults.current || restoring.current || !activeItems.length) return;
    const y = Math.max(0, list.getAbsoluteLastScrollOffset());
    const visibleTop = y + headerHeight - Math.min(y, collapseDistance);
    let index = Math.min(activeItems.length - 1, Math.max(0, list.getFirstVisibleIndex()));
    // Account for the pinned overlay: FlashList itself sees the full viewport.
    while (index < activeItems.length - 1) {
      const layout = list.getLayout(index);
      if (!layout || layout.y + list.getFirstItemOffset() + layout.height > visibleTop) break;
      index++;
    }
    index -= index % columns;
    const layout = list.getLayout(index);
    anchors.current[segment] = {
      id: activeItems[index].id, index, scrollY: y, columns,
      offset: layout ? layout.y + list.getFirstItemOffset() - visibleTop : 0,
    };
  }, [activeItems, anchorable, collapseDistance, columns, getActiveList, headerHeight, segment]);

  const restorePosition = useCallback(async () => {
    const list = getActiveList();
    if (!list) return;
    const anchor = anchorable ? resolveClosetAnchor(activeItems, anchors.current[segment], columns) : null;
    restoring.current = true;
    const generation = ++restorationGeneration.current;
    try {
      if (!anchor || anchor.scrollY < collapseDistance) {
        // A partially collapsed header is never a resting state: restore to the top.
        const offset = 0;
        list.scrollToOffset({ offset, animated: false });
        scrollY.value = offset;
      } else {
        const offset = closetOffsetForLayout(anchor.offset, anchors.current[segment]?.columns, columns, list.getLayout(anchor.index)?.height ?? 44);
        await list.scrollToIndex({ index: anchor.index, viewOffset: closetAnchorViewOffset(headerHeight - collapseDistance, offset), animated: false });
        if (generation === restorationGeneration.current) scrollY.value = Math.max(0, list.getAbsoluteLastScrollOffset());
      }
    } finally { if (generation === restorationGeneration.current) restoring.current = false; }
  }, [activeItems, anchorable, collapseDistance, columns, getActiveList, headerHeight, scrollY, segment]);

  // Like iOS large titles, the header rests fully expanded or fully collapsed so
  // every segment shares the same title position.
  const snapHeader = useCallback((y: number) => {
    if (y <= 0 || y >= collapseDistance) return;
    getActiveList()?.scrollToOffset({ offset: y < collapseDistance / 2 ? 0 : collapseDistance, animated: true });
  }, [collapseDistance, getActiveList]);

  const handleScroll = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = Math.max(0, event.contentOffset.y);
      fabCollapsed.value = event.contentOffset.y > collapseDistance ? 1 : 0;
    },
    onEndDrag: event => {
      if (event.velocity && Math.abs(event.velocity.y) > 0.05) return;
      runOnJS(snapHeader)(event.contentOffset.y);
    },
    onMomentumEnd: event => { runOnJS(snapHeader)(event.contentOffset.y); },
  }, [collapseDistance, snapHeader]);

  const browsingSignature = JSON.stringify(segment === 'pieces'
    ? [combineSearchFilters(searchFilters.pieces, piecesSearch), sortKey, selectedColors, selectedBrands, selectedSeasons, selectedConditions, selectedWarmth, selectedCategories, selectedOccasions, selectedMaterials, selectedSleeveLengths, activeSubcategory]
    : segment === 'outfits' ? [combineSearchFilters(searchFilters.outfits, outfitsSearch), outfitSortKey, outfitSelectedTags, outfitShowAssigned, outfitShowNeverWorn, outfitShowFavorites] : [combineSearchFilters(searchFilters.boards, boardSearch)]);
  const signatures = useRef<Partial<Record<Segment, string>>>({});
  useEffect(() => {
    const previous = signatures.current[segment];
    signatures.current[segment] = browsingSignature;
    if (previous !== undefined && previous !== browsingSignature) {
      restorationGeneration.current++;
      resettingResults.current = true;
      restoring.current = false;
      anchors.current[segment] = null;
      getActiveList()?.scrollToOffset({ offset: 0, animated: false });
      scrollY.value = 0;
      // FlashList may report the old offset while header padding is being measured.
      // Keep the new result set at the top throughout that layout transaction.
      let secondFrame: number | undefined;
      const firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          getActiveList()?.scrollToOffset({ offset: 0, animated: false });
          scrollY.value = 0;
          resettingResults.current = false;
        });
      });
      return () => { cancelAnimationFrame(firstFrame); if (secondFrame !== undefined) cancelAnimationFrame(secondFrame); resettingResults.current = false; };
    }
  }, [browsingSignature, getActiveList, scrollY, segment]);

  const positionCallbacks = useRef({ capturePosition, restorePosition });
  positionCallbacks.current = { capturePosition, restorePosition };
  useFocusEffect(useCallback(() => {
    void positionCallbacks.current.restorePosition();
    return () => positionCallbacks.current.capturePosition();
  }, []));
  const measureHeader = useCallback((height: number, distance: number) => {
    if (height === headerHeight && distance === collapseDistance) return;
    if (pendingHeaderAnchor.current !== segment) capturePosition();
    pendingHeaderAnchor.current = segment;
    setHeaderHeight(height);
    setCollapseDistance(distance);
  }, [capturePosition, collapseDistance, headerHeight, segment]);
  useEffect(() => {
    if (pendingHeaderAnchor.current !== segment) return;
    // Wait until FlashList has received the new content padding before restoring.
    const frame = requestAnimationFrame(() => {
      pendingHeaderAnchor.current = null;
      void positionCallbacks.current.restorePosition();
    });
    return () => cancelAnimationFrame(frame);
  }, [headerHeight, collapseDistance, segment]);

  const toggleSearch = useCallback(() => {
    capturePosition();
    pendingHeaderAnchor.current = segment;
    const opening = true;
    setSearchFocusRequest(opening ? segment : null);
    if (!opening) Keyboard.dismiss();
    setSearchVisibility(current => ({ ...current, [segment]: opening }));
  }, [capturePosition, searchVisibility, segment]);

  function finishSearch(close = true, query = activeQuery) {
    const next = addSearchFilter(activeSearchFilters, query);
    if (next !== activeSearchFilters) {
      setActiveSearchFilters(next);
      history.record(query);
    }
    setActiveQuery('');
    if (close) {
      Keyboard.dismiss(); setSearchFocusRequest(null);
      capturePosition(); pendingHeaderAnchor.current = segment;
      setSearchVisibility(current => ({ ...current, [segment]: false }));
    }
  }
  function removeSearchFilter(index: number) {
    setActiveSearchFilters(activeSearchFilters.filter((_, current) => current !== index));
  }

  // ── Segment switch ─────────────────────────────────────────────────────────

  const handleSegmentChange = useCallback(
    (next: Segment) => {
      if (next === segment) return;
      capturePosition();
      restorationGeneration.current++;
      restoring.current = false;
      Keyboard.dismiss();
      exitSelectionMode();
      exitOutfitSelectionMode();
      pendingHeaderAnchor.current = next;
      setSearchFocusRequest(null);
      setSegment(next);
      const nextScrollY = anchors.current[next]?.scrollY ?? 0;
      scrollY.value = nextScrollY < collapseDistance ? 0 : nextScrollY;
    },
    [segment, capturePosition, collapseDistance, scrollY, exitSelectionMode, exitOutfitSelectionMode],
  );

  useEffect(() => {
    const requestedSegment = route.params?.segment;
    if (!requestedSegment) return;
    if (requestedSegment !== segment) handleSegmentChange(requestedSegment);
    navigation.setParams({ segment: undefined });
  }, [handleSegmentChange, navigation, route.params?.segment, segment]);

  const applySelectedCategories = useCallback((next: string[]) => {
    if (shouldClearActiveSubcategory(selectedCategories, next)) setActiveSubcategory(null);
    setSelectedCategories(next);
  }, [selectedCategories, setActiveSubcategory, setSelectedCategories]);

  // Arriving from a board's gap line: land on Pieces filtered to the one
  // category that board is missing. Cleared immediately so a later manual
  // filter change isn't undone by a stale param on the next render.
  useEffect(() => {
    const requestedCategory = route.params?.category;
    if (!requestedCategory) return;
    if (segment !== 'pieces') handleSegmentChange('pieces');
    setSelectedCategories([requestedCategory]);
    setActiveSubcategory(null);
    navigation.setParams({ category: undefined });
  }, [
    handleSegmentChange, navigation, route.params?.category, segment,
    setActiveSubcategory, setSelectedCategories,
  ]);

  const handleCategoryPress = useCallback((cat: ItemCategory) => {
    applySelectedCategories(
      selectedCategories.includes(cat)
        ? selectedCategories.filter(current => current !== cat)
        : [...selectedCategories, cat],
    );
  }, [applySelectedCategories, selectedCategories]);

  const handlePiecesViewModeChange = useCallback((next: PiecesViewMode) => {
    if (next === piecesViewMode) return;
    capturePosition();
    piecesViewTouched.current = true;
    setPiecesViewMode(next);
    void savePiecesViewMode(next);
  }, [piecesViewMode, capturePosition]);

  // Photos-style density: pinch in for more per row, out for fewer. The menu stays the fallback.
  const handlePiecesPinch = useCallback((direction: 'in' | 'out') => {
    const next = pinchViewMode(piecesViewMode, direction);
    if (next === piecesViewMode) return;
    void Haptics.selectionAsync();
    handlePiecesViewModeChange(next);
  }, [handlePiecesViewModeChange, piecesViewMode]);
  const piecesPinch = useMemo(() => Gesture.Pinch()
    .enabled(piecesViewMode !== 'rails' && !selectionMode)
    .onEnd(event => {
      if (event.scale < 0.85) runOnJS(handlePiecesPinch)('in');
      else if (event.scale > 1.18) runOnJS(handlePiecesPinch)('out');
    }), [handlePiecesPinch, piecesViewMode, selectionMode]);

  // A shelf's "See all" opens that category as a grid without changing the saved view.
  const handleRailSeeAll = useCallback((category: ItemCategory) => {
    capturePosition();
    applySelectedCategories([category]);
    setPiecesViewMode('grid');
  }, [applySelectedCategories, capturePosition]);

  const nameSorted = sortKey === 'name_asc' || sortKey === 'name_desc';
  const scrubberEntries = useMemo(() => (
    piecesViewMode === 'list' && filteredItems.length >= 100
      ? buildScrubberEntries(filteredItems, item => nameSorted ? nameInitial(item.name) : (item.category ? CATEGORY_LABELS[item.category] : 'Other'))
      : []
  ), [filteredItems, nameSorted, piecesViewMode]);
  const jumpToPiece = useCallback((index: number) => {
    piecesListRef.current?.scrollToIndex({ index, animated: false, viewOffset: headerHeight - collapseDistance });
  }, [collapseDistance, headerHeight]);

  // ── Subtitle ───────────────────────────────────────────────────────────────

  const totalPieces = items.filter(item => !item.isArchived).length;
  const resultCount = segment === 'pieces' ? filteredItems.length : segment === 'outfits' ? filteredOutfits.length : sortedBoards.length;
  const totalCount = segment === 'pieces' ? totalPieces : segment === 'outfits' ? outfits.length : visibleBoardCount;
  const noun = segment === 'pieces' ? 'piece' : segment === 'outfits' ? 'outfit' : 'board';
  const subtitle = `${resultCount < totalCount ? `${resultCount} of ${totalCount}` : resultCount} ${resultCount === 1 && resultCount === totalCount ? noun : `${noun}s`}`;

  // ── Render helpers ─────────────────────────────────────────────────────────

  const handleItemPress = useCallback(
    (item: (typeof items)[number]) => {
      history.record(piecesSearch); navigation.navigate('ItemDetail', { itemId: item.id });
    },
    [navigation, history, piecesSearch],
  );

  const handleLongPress = useCallback((item: (typeof items)[number]) => enterPieceSelection(item.id), [enterPieceSelection]);
  const handleOutfitLongPress = useCallback((outfit: (typeof outfits)[number]) => enterOutfitSelection(outfit.id), [enterOutfitSelection]);


  const handleBulkDeleteOutfits = useCallback(() => {
    const count = selectedOutfitIds.size;
    if (count === 0) return;
    const itemsById = new Map(items.map((item) => [item.id, item]));
    confirmSheet({
      title: `Delete ${count} outfit${count !== 1 ? 's' : ''}?`,
      message: 'The pieces stay in your closet. This can’t be undone.',
      images: outfits
        .filter((outfit) => selectedOutfitIds.has(outfit.id))
        .map((outfit) => outfit.aiGeneratedImageUrl ?? itemThumbUri(itemsById.get(outfit.itemIds[0]?.id ?? -1)))
        .filter((uri): uri is string => Boolean(uri)),
      confirmLabel: count === 1 ? 'Delete outfit' : 'Delete outfits',
      destructive: true,
      onConfirm: () => {
        selectedOutfitIds.forEach(id => deleteOutfit.mutate(id));
        exitOutfitSelectionMode();
      },
    });
  }, [items, outfits, selectedOutfitIds, deleteOutfit, exitOutfitSelectionMode]);

  const handleBulkMarkOutfitsWorn = useCallback(() => {
    if (selectedOutfitIds.size === 0) return;
    selectedOutfitIds.forEach(id => markOutfitWorn.mutate(id));
    exitOutfitSelectionMode();
    finishBulkAction(`${pluralCount(selectedOutfitIds.size, 'outfit')} marked worn today`);
  }, [selectedOutfitIds, markOutfitWorn, exitOutfitSelectionMode, finishBulkAction]);

  const allSelectedOutfitsFavorite = outfitSelection.selected.length > 0 && outfitSelection.selected.every(outfit => outfit.isFavorite);
  const handleBulkFavoriteOutfits = useCallback(() => {
    const targets = outfitSelection.selected;
    if (targets.length === 0) return;
    const next = !targets.every(outfit => outfit.isFavorite);
    targets.forEach(outfit => { if (outfit.isFavorite !== next) updateOutfit.mutate({ id: outfit.id, isFavorite: next }); });
    exitOutfitSelectionMode();
    finishBulkAction(`${pluralCount(targets.length, 'outfit')} ${next ? 'added to favourites' : 'removed from favourites'}`);
  }, [outfitSelection.selected, updateOutfit, exitOutfitSelectionMode, finishBulkAction]);

  const handleBulkDelete = useCallback(() => {
    const count = selectedIds.size;
    if (count === 0) return;
    confirmSheet({
      title: `Delete ${count} item${count !== 1 ? 's' : ''}?`,
      message: 'They will be removed from your wardrobe. This can’t be undone.',
      images: items.filter((item) => selectedIds.has(item.id)).map((item) => itemThumbUri(item)).filter((uri): uri is string => Boolean(uri)),
      confirmLabel: count === 1 ? 'Delete item' : 'Delete items',
      destructive: true,
      onConfirm: () => {
        selectedIds.forEach(id => deleteItem.mutate(id));
        exitSelectionMode();
      },
    });
  }, [items, selectedIds, deleteItem, exitSelectionMode]);

  const allSelectedPiecesFavorite = pieceSelection.selected.length > 0 && pieceSelection.selected.every(item => item.isFavorite);
  const handleBulkFavorite = useCallback(() => {
    const targets = pieceSelection.selected;
    if (targets.length === 0) return;
    // One direction for the whole selection: mixed favourites all become favourites.
    const next = !targets.every(item => item.isFavorite);
    targets.forEach(item => { if (item.isFavorite !== next) updateItem.mutate({ id: item.id, isFavorite: next }); });
    exitSelectionMode();
    finishBulkAction(`${pluralCount(targets.length, 'piece')} ${next ? 'added to favourites' : 'removed from favourites'}`);
  }, [pieceSelection.selected, updateItem, exitSelectionMode, finishBulkAction]);

  const handleBulkMarkWorn = useCallback(() => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach(id => markWorn.mutate(id));
    exitSelectionMode();
    finishBulkAction(`${pluralCount(selectedIds.size, 'piece')} marked worn today`);
  }, [selectedIds, markWorn, exitSelectionMode, finishBulkAction]);

  const handleCreateOutfit = useCallback(() => {
    if (selectedIds.size === 0) return;
    const selected = items.filter(i => selectedIds.has(i.id));
    setOutfitBuilderItems(selected);
    setOutfitBuilderVisible(true);
  }, [selectedIds, items]);

  const handleAddPieces = useCallback(() => {
    openAddSheet({
      onTakePhoto: () => openScanItem('camera'),
      onFromPhotos: () => openFromPhotos(),
    });
  }, [openAddSheet, openFromPhotos, openScanItem]);

  const handleNewBoard = useCallback(() => {
    setBoardNameMode({ kind: 'new' });
  }, []);

  const renameBoard = useCallback((board: Board) => {
    setBoardNameMode({ kind: 'rename', board });
  }, []);

  const submitBoardName = useCallback((name: string) => {
    if (!boardNameMode) return;
    setBoardNameMode(null);
    if (boardNameMode.kind === 'new') {
      createBoard.mutate({ name });
    } else {
      updateBoard.mutate({ id: boardNameMode.board.id, name });
    }
  }, [boardNameMode, createBoard, updateBoard]);

  const uploadBoardCover = useCallback(async (board: Board) => {
    const image = await launchLibrary({ allowsEditing: true, maxDim: 800 });
    if (image?.dataUrl) updateBoard.mutate({ id: board.id, coverImageUrl: image.dataUrl });
  }, [launchLibrary, updateBoard]);

  const confirmDeleteBoard = useCallback((board: Board) => {
    confirmSheet({
      title: `Delete “${board.name}”?`,
      message: 'Everything saved here will stay in your closet.',
      images: board.coverImageUrl ? [board.coverImageUrl] : undefined,
      confirmLabel: 'Delete board',
      destructive: true,
      onConfirm: () => deleteBoard.mutate(board.id),
    });
  }, [deleteBoard]);

  const handleBoardOptions = useCallback((board: Board) => {
    setBoardOptionsTarget(board);
  }, []);


  const handleBulkAddToBoard = useCallback(() => {
    if (selectedIds.size === 0) return;
    setSaveSheetTarget([...selectedIds].map((id) => ({ type: 'item', id })));
  }, [selectedIds]);

  const handleBulkAddOutfitsToBoard = useCallback(() => {
    if (selectedOutfitIds.size === 0) return;
    setSaveSheetTarget([...selectedOutfitIds].map((id) => ({ type: 'outfit', id })));
  }, [selectedOutfitIds]);

  const handlePrimaryAction = useCallback(() => {
    if (segment === 'pieces') {
      handleAddPieces();
      return;
    }
    if (segment === 'boards') {
      handleNewBoard();
      return;
    }
    setOutfitBuilderItems([]);
    setOutfitBuilderVisible(true);
  }, [handleAddPieces, handleNewBoard, segment]);


  const handleStyleSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const names = items.filter((item) => selectedIds.has(item.id)).map((item) => item.name);
    const namedPieces = names.slice(0, 12).join(', ');
    const remainingCount = Math.max(0, names.length - 12);
    openStylist({
      initialQuery: `Build an outfit using these pieces from my closet: ${namedPieces}${remainingCount ? `, plus ${remainingCount} more selected pieces` : ''}`,
      source: 'closet_selection',
      onNavigateToCloset: (outfitId) => navigation.navigate('OutfitDetail', { outfitId }),
      context: {
        kind: 'closet_selection',
        itemIds: Array.from(selectedIds),
        label: 'Selected closet pieces',
      },
    });
  }, [items, navigation, openStylist, selectedIds]);

  const renderItemRow = useCallback(
    ({ item }: { item: (typeof items)[number] }) => {
      const isSelected = selectedIds.has(item.id);
      return (
        <PressableScale
          contentStyle={[styles.itemRow, selectionMode && isSelected && styles.itemRowSelected]}
          onPress={selectionMode ? () => toggleSelect(item.id) : () => { history.record(piecesSearch); navigation.navigate('ItemDetail', { itemId: item.id }); }}
          onLongPress={selectionMode ? undefined : () => handleLongPress(item)}
          delayLongPress={450}
          accessibilityRole="button"
          accessibilityLabel={getItemCardAccessibilityLabel(item)}
          accessibilityState={selectionMode ? { selected: isSelected } : undefined}
        >
          {selectionMode && (
            <View style={styles.itemRowCheck}>
              <SelectionCheck selected={isSelected} />
            </View>
          )}
          <View>
            <GarmentImage
              item={item}
              width={64}
              height={64}
              borderRadius={radii.md}
              placeholderIconSize={20}
            />
            {!selectionMode && <PolishingBadge itemId={item.id} size="thumb" />}
          </View>
          <View key={fontScale} style={styles.itemRowInfo}>
            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
            <ItemSecondaryMeta item={item} />
            <Text style={styles.wearHistory}>{wearHistoryLabel(item.wearCount)}</Text>
          </View>
          {!selectionMode && item.isFavorite && (
            <Ionicons name="heart" size={16} color={colors.primary} />
          )}
        </PressableScale>
      );
    },
    [history, piecesSearch, navigation, selectionMode, selectedIds, toggleSelect, handleLongPress, fontScale],
  );

  const renderOutfitCard = useCallback(
    ({ item: outfit }: { item: (typeof outfits)[number] }) => {
      const isSelected = selectedOutfitIds.has(outfit.id);
      const assignment = upcomingAssignmentSummaries.get(outfit.id);
      const eventDate = assignment
        ? parseEventDate(assignment.nextEvent.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : null;
      const additionalEventCount = assignment ? assignment.count - 1 : 0;
      const assignmentLabel = assignment
        ? `, assigned to ${assignment.nextEvent.title} on ${eventDate}${additionalEventCount > 0 ? ` and ${additionalEventCount} more upcoming event${additionalEventCount === 1 ? '' : 's'}` : ''}`
        : '';
      if (outfitViewMode === 'list') {
        const thumbSize = 72;
        return (
          <PressableScale
            contentStyle={[styles.outfitRow, outfitSelectionMode && isSelected && styles.itemRowSelected]}
            onPress={
              outfitSelectionMode
                ? () => toggleOutfitSelect(outfit.id)
                : () => { history.record(outfitsSearch); navigation.navigate('OutfitDetail', { outfitId: outfit.id }); }
            }
            onLongPress={outfitSelectionMode ? undefined : () => handleOutfitLongPress(outfit)}
            delayLongPress={450}
            accessibilityRole="button"
            accessibilityLabel={`${outfit.name}${assignmentLabel}`}
            accessibilityState={outfitSelectionMode ? { selected: isSelected } : undefined}
          >
            {outfitSelectionMode && (
              <View style={styles.itemRowCheck}>
                <SelectionCheck selected={isSelected} />
              </View>
            )}
            <View style={[styles.outfitRowThumb, { width: thumbSize, height: thumbSize }]}>
              <OutfitCollage outfit={outfit} size={thumbSize} />
            </View>
            <View key={fontScale} style={styles.outfitRowInfo}>
              <Text style={styles.outfitName} numberOfLines={1}>{outfit.name}</Text>
              {outfit.wearCount > 0 ? (
                <Text style={styles.outfitWorn}>Worn {outfit.wearCount}×</Text>
              ) : null}
            </View>
            {!outfitSelectionMode && outfit.isFavorite && (
              <Ionicons name="heart" size={16} color={colors.primary} />
            )}
            {!outfitSelectionMode && assignment && eventDate && (
              <View style={styles.outfitRowAssignment}>
                <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
                <Text style={styles.outfitRowAssignmentText}>
                  {eventDate}{additionalEventCount > 0 ? ` +${additionalEventCount}` : ''}
                </Text>
              </View>
            )}
            {!outfitSelectionMode && (
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            )}
          </PressableScale>
        );
      }
      return (
        <View style={styles.outfitGridItem}>
          <PressableScale
            contentStyle={[styles.outfitCard, { width: outfitCardWidth }]}
            onPress={
              outfitSelectionMode
                ? () => toggleOutfitSelect(outfit.id)
                : () => { history.record(outfitsSearch); navigation.navigate('OutfitDetail', { outfitId: outfit.id }); }
            }
            onLongPress={outfitSelectionMode ? undefined : () => handleOutfitLongPress(outfit)}
            delayLongPress={450}
            accessibilityRole="button"
            accessibilityLabel={`${outfit.name}${assignmentLabel}`}
            accessibilityState={outfitSelectionMode ? { selected: isSelected } : undefined}
          >
            <View style={[styles.collageWrapper, outfitSelectionMode && selectedOutfitIds.size > 0 && !isSelected && styles.selectionDimmed]}>
              <OutfitCollage outfit={outfit} size={outfitCardWidth} height={outfitTileHeight} borderRadius={radii.photo} />
              {outfitSelectionMode && isSelected && <View style={styles.selectedOverlay} />}
              {outfitSelectionMode && <SelectionCheck selected={isSelected} onPhoto style={styles.selectionBadge} />}
              {!outfitSelectionMode && outfit.isFavorite && (
                <View style={styles.outfitBadgeStack}>
                  <View style={styles.outfitFavBadge}>
                    <Ionicons name="heart" size={12} color={colors.primary} />
                  </View>
                </View>
              )}
            </View>
            <View key={fontScale} style={styles.outfitInfo}>
              <Text style={styles.outfitName} numberOfLines={2}>{outfit.name}</Text>
              {(outfit.wearCount > 0 || (assignment && eventDate) || outfit.isDraft) && (
                <Text style={styles.outfitMeta} numberOfLines={1}>
                  {[
                    assignment && eventDate
                      ? `${eventDate}${additionalEventCount > 0 ? ` +${additionalEventCount}` : ''}`
                      : null,
                    outfit.wearCount > 0 ? `Worn ${outfit.wearCount}×` : null,
                  ].filter(Boolean).join(' · ')}
                  {outfit.isDraft ? (
                    <Text style={styles.outfitDraftText}>{outfit.wearCount > 0 || (assignment && eventDate) ? ' · Draft' : 'Draft'}</Text>
                  ) : null}
                </Text>
              )}
            </View>
          </PressableScale>
        </View>
      );
    },
    [history, outfitsSearch, outfitCardWidth, outfitTileHeight, navigation, outfitViewMode, outfitSelectionMode, selectedOutfitIds, toggleOutfitSelect, handleOutfitLongPress, upcomingAssignmentSummaries, fontScale],
  );

  // ── Empty states ───────────────────────────────────────────────────────────

  const piecesQuery = combineSearchFilters(searchFilters.pieces, piecesSearch);
  const outfitsQuery = combineSearchFilters(searchFilters.outfits, outfitsSearch);
  const boardQuery = combineSearchFilters(searchFilters.boards, boardSearch);
  const hasActivePiecesFilters = items.some(i => !i.isArchived) && hasActivePieceFilters(piecesQuery, activeFilterCount);

  const emptyPieces = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="shirt-outline" size={32} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyTitle}>
        {hasActivePiecesFilters ? (piecesQuery.trim() ? 'No matching pieces' : 'No pieces match') : 'Your wardrobe is empty'}
      </Text>
      <Text style={styles.emptySub}>
        {hasActivePiecesFilters
          ? (piecesQuery.trim() ? 'Try removing a search term' : 'Try adjusting your filters')
          : 'Start by adding your first item'}
      </Text>
      {hasActivePiecesFilters && <>
        {(selectedCategories.length > 0 || activeSubcategory) && categoryRecoveryCount > 0 && <TouchableOpacity style={styles.emptyBtn} onPress={() => { setSelectedCategories([]); setActiveSubcategory(null); }} accessibilityRole="button" accessibilityLabel="Search all categories"><Text style={styles.emptyBtnText}>Search all categories</Text></TouchableOpacity>}
        {activeFilterCount > 0 && <TouchableOpacity style={styles.emptyBtn} onPress={clearPieceFilters} accessibilityRole="button" accessibilityLabel="Clear filters"><Text style={styles.emptyBtnText}>Clear filters</Text></TouchableOpacity>}
      </>}
      {!!piecesQuery.trim() && <TouchableOpacity style={[styles.emptyBtn, styles.emptySearchBtn]} onPress={() => { setPiecesSearch(''); setActiveSearchFilters([]); }} accessibilityRole="button" accessibilityLabel="Clear search"><Text style={[styles.emptyBtnText, styles.emptySearchBtnText]}>Clear search</Text></TouchableOpacity>}
      {!hasActivePiecesFilters && (
        <TouchableOpacity style={styles.emptyBtn} onPress={handleAddPieces} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Add your first item">
          <Ionicons name="add" size={16} color={colors.primaryForeground} />
          <Text style={styles.emptyBtnText}>Add your first item</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const hasActiveOutfitFilters = outfits.length > 0 && (outfitsQuery.trim().length > 0 || outfitActiveFilterCount > 0);

  const emptyOutfits = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="layers-outline" size={32} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyTitle}>
        {hasActiveOutfitFilters ? (outfitsQuery.trim() ? 'No matching outfits' : 'No outfits match') : 'No outfits yet'}
      </Text>
      <Text style={styles.emptySub}>
        {hasActiveOutfitFilters ? (outfitsQuery.trim() ? 'Try removing a search term' : 'Try adjusting your filters') : 'Build outfits from your pieces'}
      </Text>
      {hasActiveOutfitFilters && outfitActiveFilterCount > 0 && <TouchableOpacity style={styles.emptyBtn} onPress={clearOutfitFiltersOnly} accessibilityRole="button" accessibilityLabel="Clear filters"><Text style={styles.emptyBtnText}>Clear filters</Text></TouchableOpacity>}
      {!!outfitsQuery.trim() && <TouchableOpacity style={[styles.emptyBtn, styles.emptySearchBtn]} onPress={() => { setOutfitsSearch(''); setActiveSearchFilters([]); }} accessibilityRole="button" accessibilityLabel="Clear search"><Text style={[styles.emptyBtnText, styles.emptySearchBtnText]}>Clear search</Text></TouchableOpacity>}
      {!hasActiveOutfitFilters && (
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={handlePrimaryAction}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Create your first outfit"
        >
          <Ionicons name="add" size={16} color={colors.primaryForeground} />
          <Text style={styles.emptyBtnText}>Create your first outfit</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const emptyBoards = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="albums-outline" size={32} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyTitle}>No boards yet</Text>
      <Text style={styles.emptySub}>Create your first board to start curating your style.</Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={handleNewBoard}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Create your first board"
      >
        <Ionicons name="add" size={16} color={colors.primaryForeground} />
        <Text style={styles.emptyBtnText}>Create board</Text>
      </TouchableOpacity>
    </View>
  );

  const boardLoadingSkeleton = (
    <View style={styles.boardSkeletonGrid}>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={{ width: cardWidth, marginBottom: spacing.md }}>
          <SkeletonBlock width={cardWidth} height={cardWidth} borderRadius={radii.lg} />
          <SkeletonBlock width="72%" height={16} borderRadius={radii.sm} style={styles.boardSkeletonTitle} />
          <SkeletonBlock width="42%" height={12} borderRadius={radii.sm} style={styles.boardSkeletonSubtitle} />
        </View>
      ))}
    </View>
  );

  const pretty = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const filterTokens: { key: string; label: string; remove: () => void }[] = [];
  const addTokens = <T extends string | number,>(group: string, values: T[], setter: (values: T[]) => void, label: (value: T) => string = value => pretty(String(value))) => {
    values.forEach(value => filterTokens.push({ key: `${group}:${value}`, label: `${group}: ${label(value)}`, remove: () => setter(values.filter(v => v !== value)) }));
  };
  if (segment === 'pieces') {
    addTokens('Colour', selectedColors, setSelectedColors);
    addTokens('Brand', selectedBrands, setSelectedBrands, value => value);
    addTokens('Season', selectedSeasons, setSelectedSeasons);
    addTokens('Occasion', selectedOccasions, setSelectedOccasions, value => OCCASION_LABELS[value as keyof typeof OCCASION_LABELS] ?? pretty(value));
    addTokens('Material', selectedMaterials, setSelectedMaterials);
    addTokens('Sleeve', selectedSleeveLengths, setSelectedSleeveLengths, value => SLEEVE_LENGTH_LABELS[value as keyof typeof SLEEVE_LENGTH_LABELS] ?? pretty(value));
    addTokens('Condition', selectedConditions, setSelectedConditions);
    addTokens('Warmth', selectedWarmth, setSelectedWarmth, value => ['Very light', 'Light', 'Medium', 'Warm', 'Very warm'][value - 1] ?? String(value));
    if (activeSubcategory) filterTokens.push({ key: 'subcategory', label: activeSubcategory, remove: () => setActiveSubcategory(null) });
  } else if (segment === 'outfits') {
    addTokens('Tag', outfitSelectedTags, setOutfitSelectedTags, value => value);
    if (outfitShowAssigned) filterTokens.push({ key: 'assigned', label: 'Assigned', remove: () => setOutfitShowAssigned(false) });
    if (outfitShowNeverWorn) filterTokens.push({ key: 'never', label: 'Never worn', remove: () => setOutfitShowNeverWorn(false) });
    if (outfitShowFavorites) filterTokens.push({ key: 'favorites', label: 'Favourites', remove: () => setOutfitShowFavorites(false) });
  }
  const browseHeader = (
    <View style={[styles.browseHeader, (segment === 'pieces' ? piecesViewMode !== 'list' && piecesViewMode !== 'rails' : segment === 'outfits' ? outfitViewMode !== 'list' : false) && { paddingHorizontal: COL_GAP / 2 }, segment === 'pieces' && piecesViewMode === 'rails' && { paddingHorizontal: SIDE_PAD }]}>
          {/* Category pills — pieces only */}
          {hasCategoryPills && (
            <View style={styles.pillRow}>
            <FadedPillScroll key={`${fontScale}-${categoryScrollReset}`}>
              <PressableScale
                hitSlop={{ top: 6, bottom: 6 }}
                contentStyle={[styles.pill, selectedCategories.length === 0 && styles.pillActive]}
                onPress={() => applySelectedCategories([])}
                accessibilityRole="checkbox"
                accessibilityLabel="All categories"
                accessibilityState={{ checked: selectedCategories.length === 0 }}
              >
                <Text style={[styles.pillLabel, selectedCategories.length === 0 && styles.pillLabelActive]}>
                  All{selectedCategories.length === 0 && <Text style={styles.pillCount}>  {filteredItems.length}</Text>}
                </Text>
              </PressableScale>
              {availableCategories.map(cat => {
                const active = selectedCategories.includes(cat);
                return (
                  <PressableScale
                    key={cat}
                    hitSlop={{ top: 6, bottom: 6 }}
                contentStyle={[styles.pill, active && styles.pillActive]}
                    onPress={() => handleCategoryPress(cat)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={CATEGORY_LABELS[cat]}
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
                      {CATEGORY_LABELS[cat]}
                      {active && <Text style={styles.pillCount}>  {filteredItems.filter(item => item.category === cat).length}</Text>}
                    </Text>
                  </PressableScale>
                );
              })}
            </FadedPillScroll>
            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={clearPieceFiltersAndResetCategories} style={[styles.clearFilters, styles.clearFiltersInPillRow]} hitSlop={{ top: 6, bottom: 6 }} accessibilityRole="button" accessibilityLabel="Clear filters">
                <Text style={styles.clearFiltersText}>Clear</Text>
              </TouchableOpacity>
            )}
            </View>
          )}


      {(filterTokens.length > 0 || (!hasCategoryPills && (segment === 'pieces' ? activeFilterCount : outfitActiveFilterCount) > 0)) && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTokens}>
        {!hasCategoryPills && <TouchableOpacity onPress={segment === 'pieces' ? clearPieceFiltersAndResetCategories : clearOutfitFiltersOnly} style={styles.clearFilters} accessibilityRole="button" accessibilityLabel="Clear filters"><Text style={styles.clearFiltersText}>Clear</Text></TouchableOpacity>}
        {filterTokens.map(token => <PressableScale key={token.key} contentStyle={styles.filterToken} onPress={token.remove} accessibilityRole="button" accessibilityLabel={`Remove ${token.label} filter`}>
          <Text style={styles.resultCount}>{token.label}</Text><Ionicons name="close" size={14} color={colors.foreground} />
        </PressableScale>)}
      </ScrollView>}
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      <View style={{ flex: 1, overflow: 'hidden' }}>
        {/* Lists — padded so first item starts below the floating header */}
        {segment === 'pieces' && itemsLoading && items.length === 0 ? (
          <View style={{ flex: 1, paddingTop: listPaddingTop }}>
            <GarmentCardSkeleton />
          </View>
        ) : segment === 'pieces' && itemsError ? (
          <View style={{ flex: 1, paddingTop: listPaddingTop }}>
            <ErrorState message="Couldn't load your closet" onRetry={refetchItems} />
          </View>
        ) : segment === 'pieces' ? (
          <GestureDetector gesture={piecesPinch}>
          <View
            // FlashList needs a new layout instance when changing column count.
            key={`pieces-${piecesViewMode}`}
            style={styles.piecesListStage}
          >
          {piecesViewMode === 'rails' ? (
            <ClosetRails
              ref={piecesRailsRef}
              items={filteredItems}
              selectedIds={selectedIds}
              selectionMode={selectionMode}
              onItemPress={handleItemPress}
              onItemLongPress={handleLongPress}
              onToggleSelect={toggleSelect}
              onSeeAll={handleRailSeeAll}
              ListEmptyComponent={itemsLoading ? null : emptyPieces}
              onScroll={handleScroll}
              onScrollBeginDrag={() => { Keyboard.dismiss(); }}
              listPaddingTop={listPaddingTop}
              listPaddingBottom={listPaddingBottom}
              onLoad={() => { void restorePosition(); }}
              ListHeaderComponent={browseHeader}
            />
          ) : piecesViewMode !== 'list' ? (
            <ClosetGrid
              ref={piecesGridRef}
              numColumns={gridColumns(piecesViewMode) as 2 | 3 | 4}
              items={filteredItems}
              selectedIds={selectedIds}
              selectionMode={selectionMode}
              onItemPress={handleItemPress}
              onItemLongPress={handleLongPress}
              onToggleSelect={toggleSelect}
              ListEmptyComponent={itemsLoading ? null : emptyPieces}
              onScroll={handleScroll}
              onScrollBeginDrag={() => { Keyboard.dismiss(); }}
              scrollEventThrottle={16}
              listPaddingTop={listPaddingTop}
              listPaddingBottom={listPaddingBottom}
              onLoad={() => { void restorePosition(); }}
              ListHeaderComponent={browseHeader}
            />
          ) : (
            <AnimatedClosetList
              ref={piecesListRef}
              data={filteredItems}
              keyExtractor={item => String(item.id)}
              renderItem={renderItemRow}
              style={styles.list}
              ListEmptyComponent={itemsLoading ? null : emptyPieces}
              contentContainerStyle={{ paddingTop: listPaddingTop, ...styles.listContent, paddingBottom: listPaddingBottom, ...(scrubberEntries.length > 0 && !selectionMode && { paddingRight: SIDE_PAD + spacing.lg }) }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              maintainVisibleContentPosition={{ disabled: true }}
              onScroll={handleScroll}
              onScrollBeginDrag={() => { Keyboard.dismiss(); }}
              scrollEventThrottle={16}
              onLoad={() => { void restorePosition(); }}
              ListHeaderComponent={browseHeader}
            />
          )
          }
          {scrubberEntries.length > 0 && !selectionMode && (
            <View style={[StyleSheet.absoluteFill, { top: listPaddingTop - collapseDistance }]} pointerEvents="box-none">
              <ListScrubber entries={scrubberEntries} onJump={jumpToPiece} compactLabels={!nameSorted} />
            </View>
          )}
          </View>
          </GestureDetector>
        ) : segment === 'outfits' ? (
          <View key={`outfits-${outfitViewMode}`} style={styles.piecesListStage}>
          <AnimatedClosetList
            ref={outfitListRef}
            onLoad={() => { void restorePosition(); }}
            ListHeaderComponent={browseHeader}
            data={filteredOutfits}
            keyExtractor={outfit => String(outfit.id)}
            renderItem={renderOutfitCard}
            extraData={{ outfitSelectionMode, selectedOutfitIds }}
            numColumns={outfitViewMode === 'list' ? 1 : outfitColumns}
            ListEmptyComponent={emptyOutfits}
            contentContainerStyle={
              outfitViewMode === 'list'
                ? { paddingTop: listPaddingTop, paddingHorizontal: SIDE_PAD, paddingBottom: listPaddingBottom }
                : { paddingTop: listPaddingTop, paddingHorizontal: SIDE_PAD - COL_GAP / 2, paddingBottom: listPaddingBottom }
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            maintainVisibleContentPosition={{ disabled: true }}
            onScroll={handleScroll}
              onScrollBeginDrag={() => { Keyboard.dismiss(); }}
            scrollEventThrottle={16}
          />
          </View>
        ) : (
          <View key="boards-grid" style={styles.piecesListStage}>
          <AnimatedClosetList
            ref={boardListRef}
            onLoad={() => { void restorePosition(); }}
            onScroll={handleScroll}
              onScrollBeginDrag={() => { Keyboard.dismiss(); }}
            scrollEventThrottle={16}
            data={sortedBoards}
            keyExtractor={(b) => String(b.id)}
            numColumns={2}
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: COL_GAP / 2, marginBottom: spacing.gridRow }}>
                <BoardCard
                  board={item}
                  itemMap={itemMap}
                  outfitMap={outfitMap}
                  width={cardWidth}
                  onPress={() => { history.record(boardSearch); navigation.navigate('BoardDetail', { boardId: item.id }); }}
                  onOptions={() => handleBoardOptions(item)}
                />
              </View>
            )}
            ListHeaderComponent={browseHeader}
            ListEmptyComponent={
              boardsLoading
                ? boardLoadingSkeleton
                : boardQuery.trim().length > 0
                  ? <View style={styles.noBoardResults}><Text style={styles.emptyTitle}>No matching boards</Text><Text style={styles.emptySub}>Try removing a search term</Text><TouchableOpacity style={[styles.emptyBtn, styles.emptySearchBtn]} onPress={() => { setBoardSearch(''); setActiveSearchFilters([]); }} accessibilityRole="button" accessibilityLabel="Clear search"><Text style={[styles.emptyBtnText, styles.emptySearchBtnText]}>Clear search</Text></TouchableOpacity></View>
                  : visibleBoardCount === 0
                    ? emptyBoards
                    : null
            }
            contentContainerStyle={{
              paddingTop: listPaddingTop,
              paddingHorizontal: SIDE_PAD - COL_GAP / 2,
              paddingBottom: spacing.xxxl * 2,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            maintainVisibleContentPosition={{ disabled: true }}
          />
          </View>
        )}

        <ClosetHeader scrollY={scrollY}
          summary={subtitle}
          actionLabel={segment === 'pieces' ? 'Add' : segment === 'boards' ? 'New board' : 'Create outfit'}
          onAction={handlePrimaryAction}
          overflowAction={segment !== 'boards' ? <ClosetViewMenu key={segment} value={segment === 'pieces' ? piecesViewMode : outfitViewMode} label={segment}
            modes={segment === 'pieces' ? ['grid', 'grid3', 'grid4', 'rails', 'list'] : undefined} selectionDisabled={resultCount === 0}
            onChange={next => { if (segment === 'pieces') handlePiecesViewModeChange(next); else { capturePosition(); setOutfitViewMode(next); } }}
            onSelect={() => { if (segment === 'pieces') enterPieceSelection(); else enterOutfitSelection(); }} /> : undefined}
          selection={selectionMode ? {
            count: selectedIds.size, noun: 'piece', isAllSelected: pieceSelection.isAllSelected, canSelectAll: filteredItems.length > 0,
            onCancel: exitSelectionMode, onToggleAll: pieceSelection.isAllSelected ? pieceSelection.clear : pieceSelection.selectAll,
          } : outfitSelectionMode ? {
            count: selectedOutfitIds.size, noun: 'outfit', isAllSelected: outfitSelection.isAllSelected, canSelectAll: filteredOutfits.length > 0,
            onCancel: exitOutfitSelectionMode, onToggleAll: outfitSelection.isAllSelected ? outfitSelection.clear : outfitSelection.selectAll,
          } : undefined}
          onMeasure={measureHeader} hideDivider={searchVisibility[segment] || activeSearchFilters.length > 0}>
          <ClosetNavigation value={segment} onChange={handleSegmentChange}
            searchAvailable={segment !== 'boards' || showBoardSearch}
            searchOpen={searchVisibility[segment]}
            query={effectiveSearch}
            onSearch={toggleSearch}
            filterCount={segment === 'pieces' ? activeFilterCount : outfitActiveFilterCount}
            onFilter={segment === 'boards' ? undefined : () => { Keyboard.dismiss(); if (segment === 'pieces') setFilterSheetOpen(true); else setOutfitFilterSheetOpen(true); }} />
          {searchVisibility[segment] && <Animated.View entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(160).reduceMotion(ReduceMotion.System)}>
            <View style={styles.searchRow}>
              <SearchField key={segment} value={activeQuery} onChangeText={setActiveQuery}
                placeholder={segment === 'pieces' ? 'Search your pieces' : `Search ${segment}…`}
                accessibilityLabel={`Search ${segment}`} focusOnClear keepFocusOnSubmit autoCorrect={false} autoCapitalize="none"
                style={styles.closetSearchField}
                autoFocus={searchFocusRequest === segment}
                onBlur={() => { setSearchFocusRequest(null); }} onSubmitEditing={() => finishSearch(false)} />
              <PressableScale onPress={() => finishSearch(true)} contentStyle={styles.closeSearch} accessibilityRole="button" accessibilityLabel="Done searching">
                <Text style={styles.searchDone}>Done</Text>
              </PressableScale>
            </View>
          </Animated.View>}
          <ClosetSearchFilters filters={activeSearchFilters} onRemove={removeSearchFilter} />

        </ClosetHeader>
      </View>

      {/* ── Selection action bars ── */}
      {selectionMode && (
        <SelectionActionBar
          count={selectedIds.size}
          noun="piece"
          primary={{
            label: selectedIds.size === 1 ? 'Style this piece' : 'Build an outfit',
            icon: 'sparkles',
            onPress: handleStyleSelected,
            disabled: selectedIds.size > MAX_STYLIST_SELECTION,
            hint: `Select up to ${MAX_STYLIST_SELECTION} to style`,
            accessibilityLabel: 'Ask AI Stylist to build an outfit with the selected pieces',
          }}
          actions={[
            { label: 'Outfit', icon: 'layers-outline', onPress: handleCreateOutfit, accessibilityLabel: 'Create outfit from selected pieces' },
            { label: 'Board', icon: 'albums-outline', onPress: handleBulkAddToBoard, accessibilityLabel: 'Add selected pieces to a board' },
            { label: 'Worn today', icon: 'shirt-outline', onPress: handleBulkMarkWorn, accessibilityLabel: 'Mark selected pieces as worn today' },
          ]}
          overflow={[
            allSelectedPiecesFavorite
              ? { label: 'Remove from favourites', icon: 'heart-dislike-outline', onPress: handleBulkFavorite }
              : { label: 'Add to favourites', icon: 'heart-outline', onPress: handleBulkFavorite },
            { label: 'Delete…', icon: 'trash-outline', onPress: handleBulkDelete, destructive: true },
          ]}
        />
      )}
      {outfitSelectionMode && (
        <SelectionActionBar
          count={selectedOutfitIds.size}
          noun="outfit"
          actions={[
            { label: 'Worn today', icon: 'shirt-outline', onPress: handleBulkMarkOutfitsWorn, accessibilityLabel: 'Mark selected outfits as worn today' },
            { label: 'Board', icon: 'albums-outline', onPress: handleBulkAddOutfitsToBoard, accessibilityLabel: 'Add selected outfits to a board' },
            allSelectedOutfitsFavorite
              ? { label: 'Unfavourite', icon: 'heart-dislike-outline', onPress: handleBulkFavoriteOutfits, accessibilityLabel: 'Remove selected outfits from favourites' }
              : { label: 'Favourite', icon: 'heart-outline', onPress: handleBulkFavoriteOutfits, accessibilityLabel: 'Favourite selected outfits' },
          ]}
          overflow={[
            { label: 'Delete…', icon: 'trash-outline', onPress: handleBulkDeleteOutfits, destructive: true },
          ]}
        />
      )}
      {selectionToast && !selectionMode && !outfitSelectionMode && (
        <UndoToast message={selectionToast} actionLabel="OK" onUndo={() => setSelectionToast(null)} bottom={TAB_BAR_CLEARANCE + spacing.sm} />
      )}

      {filterSheetOpen && <FilterPanel
        onClose={() => setFilterSheetOpen(false)}
        sortOptions={SORT_OPTIONS}
        sortKey={sortKey}
        onSortChange={(key) => setSortKey(key as SortKey)}
        allColors={allColors}
        selectedColors={selectedColors}
        onToggleColor={(color) =>
          setSelectedColors(prev =>
            prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
          )
        }
        allBrands={allBrands}
        selectedBrands={selectedBrands}
        onToggleBrand={(brand) =>
          setSelectedBrands(prev =>
            prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
          )
        }
        allSeasons={allSeasons}
        selectedSeasons={selectedSeasons}
        onToggleSeason={(season) =>
          setSelectedSeasons(prev =>
            prev.includes(season) ? prev.filter(s => s !== season) : [...prev, season]
          )
        }
        selectedCategories={selectedCategories}
        onToggleCategory={(cat) => applySelectedCategories(
          selectedCategories.includes(cat)
            ? selectedCategories.filter(current => current !== cat)
            : [...selectedCategories, cat],
        )}
        selectedOccasions={selectedOccasions}
        onToggleOccasion={(occ) =>
          setSelectedOccasions(prev =>
            prev.includes(occ) ? prev.filter(o => o !== occ) : [...prev, occ]
          )
        }
        selectedStatuses={selectedStatuses}
        onToggleStatus={(s) =>
          setSelectedStatuses(prev =>
            prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
          )
        }
        allMaterials={allMaterials}
        selectedMaterials={selectedMaterials}
        onToggleMaterial={(m) =>
          setSelectedMaterials(prev =>
            prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
          )
        }
        allSleeveLengths={allSleeveLengths}
        selectedSleeveLengths={selectedSleeveLengths}
        onToggleSleeveLength={(s) =>
          setSelectedSleeveLengths(prev =>
            prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
          )
        }
        selectedConditions={selectedConditions}
        onToggleCondition={(cond) =>
          setSelectedConditions(prev =>
            prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
          )
        }
        selectedWarmth={selectedWarmth}
        onToggleWarmth={(level) =>
          setSelectedWarmth(prev =>
            prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
          )
        }
        filteredCount={filteredItems.length}
        activeFilterCount={activeFilterCount}
        canReset={canResetPieces}
        availableSubcategories={availableSubcategories}
        activeSubcategory={activeSubcategory}
        onSubcategoryChange={setActiveSubcategory}
        onClearAll={clearSheetFilters}
      />}

      {outfitFilterSheetOpen && (
        <OutfitFilterPanel
          onClose={() => setOutfitFilterSheetOpen(false)}
          sortOptions={OUTFIT_SORT_OPTIONS}
          sortKey={outfitSortKey}
          onSortChange={(key) => setOutfitSortKey(key as OutfitSortKey)}
          showAssigned={outfitShowAssigned}
          onToggleAssigned={() => setOutfitShowAssigned(v => !v)}
          allTags={allOutfitTags}
          selectedTags={outfitSelectedTags}
          onToggleTag={(tag) =>
            setOutfitSelectedTags(prev =>
              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
            )
          }
          showNeverWorn={outfitShowNeverWorn}
          onToggleNeverWorn={() => setOutfitShowNeverWorn(v => !v)}
          showFavorites={outfitShowFavorites}
          onToggleFavorites={() => setOutfitShowFavorites(v => !v)}
          filteredCount={filteredOutfits.length}
          activeFilterCount={outfitActiveFilterCount}
          canReset={canResetOutfits}
          onClearAll={clearOutfitFilters}
        />
      )}

      <OutfitBuilderSheet
        visible={outfitBuilderVisible}
        onClose={() => setOutfitBuilderVisible(false)}
        onCreated={() => { setOutfitBuilderVisible(false); exitSelectionMode(); }}
        initialItems={outfitBuilderItems}
      />

      {saveSheetTarget !== null && (
        <SaveToBoardSheet
          target={saveSheetTarget}
          onClose={() => { setSaveSheetTarget(null); exitSelectionMode(); exitOutfitSelectionMode(); }}
        />
      )}

      {boardOptionsTarget !== null && (
        <BoardOptionsMenuSheet
          visible
          boardName={boardOptionsTarget.name}
          canRename
          onClose={() => setBoardOptionsTarget(null)}
          onOrganize={() => navigation.navigate('BoardDetail', { boardId: boardOptionsTarget.id, organize: true })}
          onChangeCover={() => navigation.navigate('BoardDetail', { boardId: boardOptionsTarget.id, editCover: true })}
          onUploadCover={() => uploadBoardCover(boardOptionsTarget)}
          onRename={() => renameBoard(boardOptionsTarget)}
          onDelete={() => confirmDeleteBoard(boardOptionsTarget)}
        />
      )}
      {boardNameMode !== null && (
        <BoardNameSheet
          visible
          title={boardNameMode.kind === 'new' ? 'New board' : 'Rename board'}
          subtitle={boardNameMode.kind === 'new' ? 'Give your next edit a name.' : 'Update this board’s name.'}
          initialValue={boardNameMode.kind === 'rename' ? boardNameMode.board.name : ''}
          submitLabel={boardNameMode.kind === 'new' ? 'Create board' : 'Save name'}
          submitting={boardNameMode.kind === 'new' ? createBoard.isPending : updateBoard.isPending}
          onCancel={() => setBoardNameMode(null)}
          suggestions={boardNameMode.kind === 'new' ? STARTER_BOARD_NAMES.filter(name => !boards.some(board => board.name.toLowerCase() === name.toLowerCase())) : undefined}
          onSubmit={submitBoardName}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  noBoardResults: { paddingVertical: spacing.xl, alignItems: 'center' },
  boardSkeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: COL_GAP / 2 },
  boardSkeletonTitle: { marginTop: spacing.sm + 1 },
  boardSkeletonSubtitle: { marginTop: spacing.xs },
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header
  header: {
    paddingHorizontal: SIDE_PAD,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center', backgroundColor: colors.surfaceSubtle,
  },
  primaryHeaderBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  primaryHeaderBtnText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  title: {
    fontSize: typography.text.pageTitle.fontSize,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: typography.tracking.none,
  },
  subtitle: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  // ── Search row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIDE_PAD,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  closetSearchField: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
    borderRadius: 14,
  },
  searchDone: { ...typography.text.bodySmall, color: colors.foreground },
  closeSearch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  // ── Category pills
  // Bottom spacing lives on the row, not the scroll, so Clear centres on the chips.
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.xs },
  pillScrollWrap: { flex: 1, minWidth: 0, alignSelf: 'stretch' },
  pillScroll: { flexShrink: 0 },
  pillContent: {
    paddingHorizontal: 0, gap: spacing.sm, alignItems: 'center', flexGrow: 1,
  },
  pillFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 24,
  },
  pillFadeLeft: { left: 0 },
  pillFadeRight: { right: 0 },
  // Quiet text chips: the selected one is a small ink lozenge, the rest are plain words.
  pill: {
    height: 32, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: radii.full,
  },
  pillActive: {
    backgroundColor: colors.foreground,
  },
  pillLabel: {
    ...typography.text.bodySmall, color: colors.mutedForeground,
  },
  pillLabelActive: {
    color: colors.background,
  },
  pillCount: {
    color: colors.background, opacity: 0.6,
  },

  browseHeader: { paddingTop: spacing.sm, paddingBottom: 0 },
  resultCount: { ...typography.text.bodySmall, color: colors.mutedForeground },
  clearFilters: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm },
  // Chip height, so the row doesn't grow (and the chips shift) when Clear appears.
  clearFiltersInPillRow: { minHeight: 32, height: 32 },
  clearFiltersText: { ...typography.text.bodySmall, color: colors.foreground, fontWeight: typography.weight.medium },
  filterTokens: { gap: spacing.sm, paddingBottom: spacing.sm },
  filterToken: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.full },
  wearHistory: { ...typography.text.caption, color: colors.mutedForeground },

  // ── List layout
  list: {
    flex: 1,
  },
  piecesListStage: {
    flex: 1,
  },
  selectionDimmed: { opacity: 0.82 },
  listContent: {
    paddingHorizontal: SIDE_PAD,
    paddingBottom: spacing.xxxl * 2,
  },
  listContentRow: {
    paddingHorizontal: SIDE_PAD,
  },
  outfitGridItem: {
    paddingHorizontal: COL_GAP / 2, marginBottom: spacing.gridRow,
  },

  // ── Item row (list mode)
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline,
  },
  itemRowSelected: {
    backgroundColor: `${colors.primary}10`,
  },
  itemRowCheck: {
    flexShrink: 0,
  },
  itemRowInfo: {
    flex: 1, gap: spacing.xs,
  },

  // ── Item cards (grid mode)
  itemCard: {},
  itemThumb: {
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  favBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xs,
  },
  outfitBadgeStack: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  outfitFavBadge: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,252,247,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xs,
  },
  outfitRowAssignment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  outfitRowAssignmentText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  itemInfo: {
    paddingTop: spacing.sm,
    paddingHorizontal: 2,
    gap: 2,
  },
  itemName: {
    ...typography.text.cardTitle, color: colors.foreground,
  },
  // ── Outfit cards
  outfitCard: {},
  // A flat plate, like the garment tiles: the collage's own edge is the edge.
  collageWrapper: {
    borderRadius: radii.photo,
    overflow: 'hidden',
    backgroundColor: surfaces.plate,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(149, 109, 81, 0.18)',
  },
  selectionBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  outfitInfo: {
    paddingTop: 10, paddingHorizontal: 0, gap: spacing.xs,
  },
  outfitName: {
    ...typography.text.cardTitle,
    color: colors.foreground,
  },
  outfitWorn: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
  },
  outfitMeta: {
    ...typography.text.metaSheet,
    color: colors.mutedForeground,
  },
  outfitDraftText: {
    color: colors.primary,
  },
  outfitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  outfitRowThumb: {
    borderRadius: radii.md,
    overflow: 'hidden',
    flexShrink: 0,
  },
  outfitRowInfo: {
    flex: 1,
    gap: 2,
  },



  // ── Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 220,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  emptyBtnText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  emptySearchBtn: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  emptySearchBtnText: {
    color: colors.foreground,
  },

});
