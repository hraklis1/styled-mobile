import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useItems, useUpdateItem, useDeleteItem, useMarkItemWorn } from '../../hooks/useItems';
import { useOutfits } from '../../hooks/useOutfits';
import { useClosetFilters, type SortKey, type OutfitSortKey } from '../../hooks/useClosetFilters';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { OutfitBuilderSheet } from '../../components/outfits/OutfitBuilderSheet';
import { FilterPanel } from '../../components/wardrobe/FilterPanel';
import { OutfitFilterPanel } from '../../components/outfits/OutfitFilterPanel';
import { ClosetGrid } from '../../components/wardrobe/ClosetGrid';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { CATEGORY_LABELS, type ItemCategory } from '../../types/item';
import { colors, shadows, spacing, typography, radii } from '../../theme';
import { useGlobalScan } from '../../contexts/GlobalScanContext';
import { useGlobalAddSheet } from '../../contexts/GlobalAddSheetContext';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { useFabScroll } from '../../contexts/FabScrollContext';
import { useFocusEffect } from '@react-navigation/native';
import { PressableScale } from '../../components/primitives/PressableScale';
import { GarmentCardSkeleton } from '../../components/primitives/GarmentCardSkeleton';
import { ErrorState } from '../../components/primitives/ErrorState';
import type { ClosetScreenProps } from '../../navigation/types';

type ViewMode = 'grid' | 'list';
type Segment = 'pieces' | 'outfits';

const OUTFIT_SORT_OPTIONS: { key: OutfitSortKey; label: string }[] = [
  { key: 'newest',        label: 'Newest first' },
  { key: 'oldest',        label: 'Oldest first' },
  { key: 'most_worn',     label: 'Most worn' },
  { key: 'recently_worn', label: 'Recently worn' },
  { key: 'name_asc',      label: 'Name A → Z' },
];

const SIDE_PAD = spacing.lg;
const COL_GAP  = spacing.sm;

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

// Heights used to size the collapsible region and sheet detents.
// These are rough constants; adjust if layout changes.
const SEARCH_ROW_H      = 58;
const PILL_ROW_H        = 52;
const SUBCATEGORY_ROW_H = 48;

export function ClosetScreen({ navigation }: ClosetScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { openScanItem, openBatchScan } = useGlobalScan();
  const { openAddSheet } = useGlobalAddSheet();
  const { openStylist } = useGlobalAIStylist();
  const { fabCollapsed } = useFabScroll();

  const [segment, setSegment]               = useState<Segment>('pieces');
  const [search, setSearch]                 = useState('');
  const [activeCategory, setActiveCategory] = useState<ItemCategory | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [viewMode, setViewMode]             = useState<ViewMode>('grid');

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set());
  const justLongPressedRef = useRef(false);
  const [outfitBuilderVisible, setOutfitBuilderVisible] = useState(false);
  const [outfitBuilderItems, setOutfitBuilderItems]     = useState<typeof items>([]);

  const { data: items = [], isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useItems();
  const { data: outfits = [] } = useOutfits();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const markWorn = useMarkItemWorn();
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
    outfitSortKey, setOutfitSortKey,
    outfitFilterSheetOpen, setOutfitFilterSheetOpen,
    outfitSelectedTags, setOutfitSelectedTags,
    outfitSelectedEvents, setOutfitSelectedEvents,
    outfitShowNeverWorn, setOutfitShowNeverWorn,
    allColors, allBrands, allSeasons, allMaterials, allSleeveLengths,
    activeFilterCount,
    allOutfitTags, allOutfitEvents,
    outfitActiveFilterCount,
    availableCategories, availableSubcategories,
    filteredItems, filteredOutfits,
    clearSheetFilters, clearOutfitFilters, resetAll,
  } = useClosetFilters({ items, outfits, search, activeCategory, activeSubcategory });

  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;

  // Floating header height — drives the paddingTop that reserves space for the
  // header inside the list. Changes only on category tap, never during scroll.
  const hasCategoryPills = segment === 'pieces' && availableCategories.length > 0;
  const subcatVisible    = hasCategoryPills && availableSubcategories.length > 0;
  const listPaddingTop   =
    SEARCH_ROW_H +
    (hasCategoryPills ? PILL_ROW_H : 0) +
    (subcatVisible ? SUBCATEGORY_ROW_H : 0);

  // ── Hide-on-scroll ─────────────────────────────────────────────────────────
  // headerTranslateY drives the floating header on the native UI thread.
  // Collapses on downward scroll past a threshold, re-expands on upward scroll.

  const lastScrollY    = useRef(0);
  const isCollapsed    = useRef(false);
  // translateY drives the floating header on the native UI thread.
  // The FlashList container never resizes, so FlashList recycling stays in sync
  // no matter how fast the user flings back to the top.
  const headerTranslateY = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    fabCollapsed.value = 0;
  }, [fabCollapsed]));

  const expandCollapsible = useCallback(() => {
    if (!isCollapsed.current) return;
    isCollapsed.current = false;
    Animated.spring(headerTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 150,
      friction: 25,
    }).start();
  }, [headerTranslateY]);

  const collapseCollapsible = useCallback(() => {
    if (isCollapsed.current) return;
    isCollapsed.current = true;
    // Translate by max possible height so the header always clears the viewport
    // regardless of how many pill rows are currently visible.
    Animated.spring(headerTranslateY, {
      toValue: -(SEARCH_ROW_H + PILL_ROW_H + SUBCATEGORY_ROW_H),
      useNativeDriver: true,
      tension: 150,
      friction: 25,
    }).start();
  }, [headerTranslateY]);

  const handleScroll = useCallback(
    (e: any) => {
      const y     = e.nativeEvent.contentOffset.y;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;

      if (y <= 10) {
        if (isCollapsed.current) fabCollapsed.value = 0;
        expandCollapsible();
      } else if (delta > 6) {
        if (!isCollapsed.current) fabCollapsed.value = 1;
        collapseCollapsible();
      } else if (delta < -6) {
        if (isCollapsed.current) fabCollapsed.value = 0;
        expandCollapsible();
      }
    },
    [fabCollapsed, expandCollapsible, collapseCollapsible],
  );

  // ── Segment switch ─────────────────────────────────────────────────────────

  const handleSegmentChange = useCallback(
    (next: Segment) => {
      if (next === segment) return;
      setSearch('');
      setActiveCategory(null);
      setActiveSubcategory(null);
      resetAll();
      setSegment(next);
      expandCollapsible();
    },
    [segment, expandCollapsible, resetAll],
  );

  const handleCategoryPress = useCallback((cat: ItemCategory) => {
    setActiveCategory(prev => (prev === cat ? null : cat));
    setActiveSubcategory(null);
  }, []);

  // ── Subtitle ───────────────────────────────────────────────────────────────

  const subtitle =
    segment === 'pieces'
      ? `${filteredItems.length} ${filteredItems.length === 1 ? 'piece' : 'pieces'}`
      : `${filteredOutfits.length} ${filteredOutfits.length === 1 ? 'outfit' : 'outfits'}`;

  // ── Render helpers ─────────────────────────────────────────────────────────

  const handleItemPress = useCallback(
    (item: (typeof items)[number]) => {
      navigation.navigate('ItemDetail', { itemId: item.id });
    },
    [navigation],
  );

  const handleLongPress = useCallback((item: (typeof items)[number]) => {
    justLongPressedRef.current = true;
    setSelectionMode(true);
    setSelectedIds(new Set([item.id]));
  }, []);

  const toggleSelect = useCallback((id: number) => {
    if (justLongPressedRef.current) {
      justLongPressedRef.current = false;
      return;
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    if (selectionMode && selectedIds.size === 0) {
      setSelectionMode(false);
    }
  }, [selectionMode, selectedIds.size]);

  const handleBulkDelete = useCallback(() => {
    const count = selectedIds.size;
    if (count === 0) return;
    Alert.alert(
      'Delete items',
      `Delete ${count} item${count !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedIds.forEach(id => deleteItem.mutate(id));
            exitSelectionMode();
          },
        },
      ]
    );
  }, [selectedIds, deleteItem, exitSelectionMode]);

  const handleBulkFavorite = useCallback(() => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach(id => {
      const item = items.find(i => i.id === id);
      if (item) updateItem.mutate({ id, isFavorite: !item.isFavorite });
    });
    exitSelectionMode();
  }, [selectedIds, items, updateItem, exitSelectionMode]);

  const handleBulkMarkWorn = useCallback(() => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach(id => markWorn.mutate(id));
    exitSelectionMode();
  }, [selectedIds, markWorn, exitSelectionMode]);

  const handleCreateOutfit = useCallback(() => {
    if (selectedIds.size === 0) return;
    const selected = items.filter(i => selectedIds.has(i.id));
    setOutfitBuilderItems(selected);
    setOutfitBuilderVisible(true);
  }, [selectedIds, items]);

  const handleAddPieces = useCallback(() => {
    openAddSheet({
      onTakePhoto: () => openScanItem('camera'),
      onFromLibrary: () => openScanItem('library'),
      onBatchImport: openBatchScan,
    });
  }, [openAddSheet, openBatchScan, openScanItem]);

  const handlePrimaryAction = useCallback(() => {
    if (segment === 'pieces') {
      handleAddPieces();
      return;
    }
    setOutfitBuilderItems([]);
    setOutfitBuilderVisible(true);
  }, [handleAddPieces, segment]);

  const handleStyleSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const names = items.filter((item) => selectedIds.has(item.id)).map((item) => item.name);
    const namedPieces = names.slice(0, 12).join(', ');
    const remainingCount = Math.max(0, names.length - 12);
    openStylist({
      initialQuery: `Build an outfit using these pieces from my closet: ${namedPieces}${remainingCount ? `, plus ${remainingCount} more selected pieces` : ''}`,
      source: 'closet_selection',
    });
  }, [items, openStylist, selectedIds]);

  const renderItemRow = useCallback(
    ({ item }: { item: (typeof items)[number] }) => {
      const uri = resolveImageUri(item.imageUrl);
      const isSelected = selectedIds.has(item.id);
      return (
        <PressableScale
          contentStyle={[styles.itemRow, selectionMode && isSelected && styles.itemRowSelected]}
          onPress={selectionMode ? () => toggleSelect(item.id) : () => navigation.navigate('ItemDetail', { itemId: item.id })}
          onLongPress={selectionMode ? undefined : () => handleLongPress(item)}
          delayLongPress={450}
          accessibilityRole="button"
          accessibilityLabel={[item.name, item.category ? CATEGORY_LABELS[item.category] : null].filter(Boolean).join(', ')}
          accessibilityState={selectionMode ? { selected: isSelected } : undefined}
        >
          {selectionMode && (
            <View style={styles.itemRowCheck}>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={isSelected ? colors.primary : colors.mutedForeground}
              />
            </View>
          )}
          <View style={styles.itemRowThumb}>
            {uri ? (
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <View style={styles.itemThumbPlaceholder}>
                <Ionicons name="shirt-outline" size={20} color={colors.mutedForeground} />
              </View>
            )}
          </View>
          <View style={styles.itemRowInfo}>
            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
            {item.category && CATEGORY_LABELS[item.category] ? (
              <Text style={styles.itemCategory}>{CATEGORY_LABELS[item.category]}</Text>
            ) : null}
          </View>
          {!selectionMode && item.isFavorite && (
            <Ionicons name="heart" size={16} color={colors.primary} />
          )}
        </PressableScale>
      );
    },
    [navigation, selectionMode, selectedIds, toggleSelect, handleLongPress],
  );

  const renderOutfitCard = useCallback(
    ({ item: outfit }: { item: (typeof outfits)[number] }) => {
      if (viewMode === 'list') {
        const thumbSize = 72;
        return (
          <PressableScale
            contentStyle={styles.outfitRow}
            onPress={() => navigation.navigate('OutfitDetail', { outfitId: outfit.id })}
            accessibilityRole="button"
            accessibilityLabel={outfit.name}
          >
            <View style={[styles.outfitRowThumb, { width: thumbSize, height: thumbSize }]}>
              <OutfitCollage outfit={outfit} size={thumbSize} />
            </View>
            <View style={styles.outfitRowInfo}>
              <Text style={styles.outfitName} numberOfLines={1}>{outfit.name}</Text>
              {outfit.event ? (
                <Text style={styles.outfitEvent} numberOfLines={1}>{outfit.event}</Text>
              ) : null}
              {outfit.wearCount > 0 ? (
                <Text style={styles.outfitWorn}>Worn {outfit.wearCount}×</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.border} />
          </PressableScale>
        );
      }
      return (
        <View style={styles.outfitGridItem}>
          <PressableScale
            contentStyle={[styles.outfitCard, { width: cardWidth }]}
            onPress={() => navigation.navigate('OutfitDetail', { outfitId: outfit.id })}
            accessibilityRole="button"
            accessibilityLabel={outfit.name}
          >
            <View style={styles.collageWrapper}>
              <OutfitCollage outfit={outfit} size={cardWidth} />
            </View>
            <View style={styles.outfitInfo}>
              <Text style={styles.outfitName} numberOfLines={1}>{outfit.name}</Text>
              {outfit.event ? (
                <Text style={styles.outfitEvent} numberOfLines={1}>{outfit.event}</Text>
              ) : null}
            </View>
          </PressableScale>
        </View>
      );
    },
    [cardWidth, navigation, viewMode],
  );

  // ── Empty states ───────────────────────────────────────────────────────────

  const emptyPieces = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="shirt-outline" size={32} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyTitle}>
        {search || activeCategory ? 'No pieces match' : 'Your wardrobe is empty'}
      </Text>
      <Text style={styles.emptySub}>
        {search || activeCategory
          ? 'Try a different search or filter'
          : 'Start by adding your first item'}
      </Text>
      {!search && !activeCategory && (
        <TouchableOpacity style={styles.emptyBtn} onPress={handleAddPieces} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Add your first item">
          <Ionicons name="add" size={16} color={colors.primaryForeground} />
          <Text style={styles.emptyBtnText}>Add your first item</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const hasActiveOutfitFilters = search.trim().length > 0 || outfitActiveFilterCount > 0;

  const emptyOutfits = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="layers-outline" size={32} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyTitle}>
        {hasActiveOutfitFilters ? 'No outfits match' : 'No outfits yet'}
      </Text>
      <Text style={styles.emptySub}>
        {hasActiveOutfitFilters ? 'Try adjusting your search or filters' : 'Build outfits from your pieces'}
      </Text>
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Fixed header: title + sparkles + view toggle ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Closet</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.headerActions}>
          <PressableScale
            contentStyle={styles.primaryHeaderBtn}
            onPress={handlePrimaryAction}
            accessibilityRole="button"
            accessibilityLabel={segment === 'pieces' ? 'Add pieces' : 'Create outfit'}
          >
            <Ionicons name="add" size={16} color={colors.primaryForeground} />
            <Text style={styles.primaryHeaderBtnText}>
              {segment === 'pieces' ? 'Add pieces' : 'Create outfit'}
            </Text>
          </PressableScale>
          <PressableScale
            contentStyle={styles.headerBtn}
            onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
            accessibilityLabel="Toggle view"
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
              size={20}
              color={colors.foreground}
            />
          </PressableScale>
        </View>
      </View>

      {/* ── Segmented control ── */}
      <View style={styles.segmentRow}>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentBtn, segment === 'pieces' && styles.segmentBtnActive]}
            onPress={() => handleSegmentChange('pieces')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: segment === 'pieces' }}
            accessibilityLabel="Pieces"
          >
            <Text style={[styles.segmentLabel, segment === 'pieces' && styles.segmentLabelActive]}>
              Pieces
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, segment === 'outfits' && styles.segmentBtnActive]}
            onPress={() => handleSegmentChange('outfits')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: segment === 'outfits' }}
            accessibilityLabel="Outfits"
          >
            <Text style={[styles.segmentLabel, segment === 'outfits' && styles.segmentLabelActive]}>
              Outfits
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content area + floating header ── */}
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
          viewMode === 'grid' ? (
            <ClosetGrid
              items={filteredItems}
              selectedIds={selectedIds}
              selectionMode={selectionMode}
              onItemPress={handleItemPress}
              onItemLongPress={handleLongPress}
              onToggleSelect={toggleSelect}
              ListEmptyComponent={itemsLoading ? null : emptyPieces}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              listPaddingTop={listPaddingTop}
            />
          ) : (
            <FlashList
              data={filteredItems}
              keyExtractor={item => String(item.id)}
              renderItem={renderItemRow}
              style={styles.list}
              ListEmptyComponent={itemsLoading ? null : emptyPieces}
              contentContainerStyle={{ paddingTop: listPaddingTop, ...styles.listContent }}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          )
        ) : (
          <FlashList
            key={`outfits-${viewMode}`}
            data={filteredOutfits}
            keyExtractor={outfit => String(outfit.id)}
            renderItem={renderOutfitCard}
            numColumns={viewMode === 'list' ? 1 : 2}
            ListEmptyComponent={emptyOutfits}
            contentContainerStyle={
              viewMode === 'list'
                ? { paddingTop: listPaddingTop, paddingHorizontal: SIDE_PAD }
                : { paddingTop: listPaddingTop, paddingHorizontal: SIDE_PAD - COL_GAP / 2, paddingBottom: spacing.xxxl * 2 }
            }
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        )}

        {/* Floating header — absolute over the list, slides on native thread */}
        <Animated.View
          style={[styles.floatingHeader, { transform: [{ translateY: headerTranslateY }] }]}
        >
          {/* Search bar + Sort&Filter button */}
          <View style={styles.searchRow}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color={colors.mutedForeground} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={segment === 'pieces' ? 'Search pieces…' : 'Search outfits…'}
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Clear search" accessibilityRole="button">
                  <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {segment === 'pieces' && (
              <PressableScale
                contentStyle={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
                onPress={() => setFilterSheetOpen(true)}
                accessibilityLabel="Sort and filter"
              >
                <Ionicons
                  name="options-outline"
                  size={18}
                  color={activeFilterCount > 0 ? colors.primaryForeground : colors.foreground}
                />
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </PressableScale>
            )}
            {segment === 'outfits' && (
              <PressableScale
                contentStyle={[styles.filterBtn, outfitActiveFilterCount > 0 && styles.filterBtnActive]}
                onPress={() => setOutfitFilterSheetOpen(true)}
                accessibilityLabel="Sort and filter outfits"
              >
                <Ionicons
                  name="options-outline"
                  size={18}
                  color={outfitActiveFilterCount > 0 ? colors.primaryForeground : colors.foreground}
                />
                {outfitActiveFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{outfitActiveFilterCount}</Text>
                  </View>
                )}
              </PressableScale>
            )}
          </View>

          {/* Category pills — pieces only */}
          {hasCategoryPills && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pillScroll}
              contentContainerStyle={styles.pillContent}
            >
              <PressableScale
                contentStyle={[styles.pill, activeCategory === null && styles.pillActive]}
                onPress={() => { setActiveCategory(null); setActiveSubcategory(null); }}
                accessibilityRole="button"
                accessibilityLabel="All categories"
                accessibilityState={{ selected: activeCategory === null }}
              >
                <Text style={[styles.pillLabel, activeCategory === null && styles.pillLabelActive]}>
                  All
                </Text>
              </PressableScale>
              {availableCategories.map(cat => (
                <PressableScale
                  key={cat}
                  contentStyle={[styles.pill, activeCategory === cat && styles.pillActive]}
                  onPress={() => handleCategoryPress(cat)}
                  accessibilityRole="button"
                  accessibilityLabel={CATEGORY_LABELS[cat]}
                  accessibilityState={{ selected: activeCategory === cat }}
                >
                  <Text style={[styles.pillLabel, activeCategory === cat && styles.pillLabelActive]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          )}

          {/* Subcategory pills — shown/hidden without animation; listPaddingTop
              and subcatVisible update in the same render so there is no gap */}
          {subcatVisible && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pillScroll}
              contentContainerStyle={styles.pillContent}
            >
              {availableSubcategories.map(sub => (
                <PressableScale
                  key={sub}
                  contentStyle={[styles.pill, activeSubcategory === sub && styles.pillActive]}
                  onPress={() => setActiveSubcategory(prev => (prev === sub ? null : sub))}
                  accessibilityRole="button"
                  accessibilityLabel={sub}
                  accessibilityState={{ selected: activeSubcategory === sub }}
                >
                  <Text style={[styles.pillLabel, activeSubcategory === sub && styles.pillLabelActive]}>
                    {sub}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          )}
        </Animated.View>

      </View>

      {/* ── Bulk action bar ── */}
      {selectionMode && (
        <View style={[styles.bulkBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.bulkBarTop}>
            <TouchableOpacity onPress={exitSelectionMode} accessibilityRole="button" accessibilityLabel="Cancel selection">
              <Text style={styles.bulkCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (selectedIds.size === filteredItems.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(filteredItems.map(i => i.id)));
                }
              }}
              accessibilityRole="button"
            >
              <Text style={styles.bulkSelectAll}>
                {selectedIds.size === 0
                  ? 'Select all'
                  : selectedIds.size === filteredItems.length
                    ? `${selectedIds.size} selected — Clear`
                    : `${selectedIds.size} selected — Select all`}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.bulkStylistBtn, selectedIds.size === 0 && styles.bulkBtnDisabled]}
            onPress={handleStyleSelected}
            disabled={selectedIds.size === 0}
            accessibilityRole="button"
            accessibilityLabel="Ask AI Stylist to build an outfit with selected items"
            accessibilityState={{ disabled: selectedIds.size === 0 }}
          >
            <Ionicons name="sparkles" size={17} color={selectedIds.size === 0 ? colors.border : colors.primary} />
            <Text style={[styles.bulkStylistBtnText, selectedIds.size === 0 && styles.bulkBtnTextDisabled]}>
              Build an outfit with these
            </Text>
          </TouchableOpacity>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={[styles.bulkBtn, selectedIds.size === 0 && styles.bulkBtnDisabled]}
              onPress={handleBulkFavorite}
              disabled={selectedIds.size === 0}
              accessibilityRole="button"
              accessibilityLabel="Favourite selected items"
              accessibilityState={{ disabled: selectedIds.size === 0 }}
            >
              <Ionicons name="heart-outline" size={17} color={selectedIds.size === 0 ? colors.border : colors.foreground} />
              <Text style={[styles.bulkBtnText, selectedIds.size === 0 && styles.bulkBtnTextDisabled]}>Favourite</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, selectedIds.size === 0 && styles.bulkBtnDisabled]}
              onPress={handleBulkMarkWorn}
              disabled={selectedIds.size === 0}
              accessibilityRole="button"
              accessibilityLabel="Mark selected items as worn today"
              accessibilityState={{ disabled: selectedIds.size === 0 }}
            >
              <Ionicons name="shirt-outline" size={17} color={selectedIds.size === 0 ? colors.border : colors.foreground} />
              <Text style={[styles.bulkBtnText, selectedIds.size === 0 && styles.bulkBtnTextDisabled]}>Worn today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, selectedIds.size === 0 && styles.bulkBtnDisabled]}
              onPress={handleCreateOutfit}
              disabled={selectedIds.size === 0}
              accessibilityRole="button"
              accessibilityLabel="Create outfit from selected items"
              accessibilityState={{ disabled: selectedIds.size === 0 }}
            >
              <Ionicons name="layers-outline" size={17} color={selectedIds.size === 0 ? colors.border : colors.foreground} />
              <Text style={[styles.bulkBtnText, selectedIds.size === 0 && styles.bulkBtnTextDisabled]}>Outfit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnDelete, selectedIds.size === 0 && styles.bulkBtnDisabled]}
              onPress={handleBulkDelete}
              disabled={selectedIds.size === 0}
              accessibilityRole="button"
              accessibilityLabel="Delete selected items"
              accessibilityState={{ disabled: selectedIds.size === 0 }}
            >
              <Ionicons name="trash-outline" size={17} color={selectedIds.size === 0 ? colors.border : colors.error} />
              <Text style={[styles.bulkBtnText, styles.bulkBtnTextDelete, selectedIds.size === 0 && styles.bulkBtnTextDisabled]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
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
        onToggleCategory={(cat) =>
          setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
          )
        }
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
        onClearAll={clearSheetFilters}
      />}

      {outfitFilterSheetOpen && (
        <OutfitFilterPanel
          onClose={() => setOutfitFilterSheetOpen(false)}
          sortOptions={OUTFIT_SORT_OPTIONS}
          sortKey={outfitSortKey}
          onSortChange={(key) => setOutfitSortKey(key as OutfitSortKey)}
          allEvents={allOutfitEvents}
          selectedEvents={outfitSelectedEvents}
          onToggleEvent={(event) =>
            setOutfitSelectedEvents(prev =>
              prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
            )
          }
          allTags={allOutfitTags}
          selectedTags={outfitSelectedTags}
          onToggleTag={(tag) =>
            setOutfitSelectedTags(prev =>
              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
            )
          }
          showNeverWorn={outfitShowNeverWorn}
          onToggleNeverWorn={() => setOutfitShowNeverWorn(v => !v)}
          filteredCount={filteredOutfits.length}
          activeFilterCount={outfitActiveFilterCount}
          onClearAll={clearOutfitFilters}
        />
      )}

      <OutfitBuilderSheet
        visible={outfitBuilderVisible}
        onClose={() => setOutfitBuilderVisible(false)}
        onCreated={() => { setOutfitBuilderVisible(false); exitSelectionMode(); }}
        initialItems={outfitBuilderItems}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryHeaderBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  primaryHeaderBtnText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  // ── Segmented control
  segmentRow: {
    paddingHorizontal: SIDE_PAD,
    paddingBottom: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radii.full,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm - 1,
    alignItems: 'center',
    borderRadius: radii.full,
  },
  segmentBtnActive: {
    backgroundColor: colors.white,
    ...shadows.xs,
  },
  segmentLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  segmentLabelActive: {
    color: colors.foreground,
    fontWeight: typography.weight.semibold,
  },

  // ── Floating header (absolute, slides over the list)
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.background,
  },

  // ── Search row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIDE_PAD,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.foreground,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filterBtnActive: {
    backgroundColor: colors.foreground,
  },
  filterBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.primaryForeground,
  },

  // ── Category pills
  pillScroll: { flexShrink: 0 },
  pillContent: { paddingHorizontal: SIDE_PAD, paddingBottom: spacing.md, gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  pillLabelActive: {
    color: colors.white,
  },

  // ── List layout
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SIDE_PAD,
    paddingBottom: spacing.xxxl * 2,
  },
  listContentRow: {
    paddingHorizontal: SIDE_PAD,
  },
  outfitGridItem: {
    paddingHorizontal: COL_GAP / 2,
    marginBottom: COL_GAP,
  },

  // ── Item row (list mode)
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemRowSelected: {
    backgroundColor: `${colors.primary}10`,
  },
  itemRowCheck: {
    flexShrink: 0,
  },
  itemRowThumb: {
    width: 60,
    height: 60,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    flexShrink: 0,
  },
  itemRowInfo: {
    flex: 1,
    gap: 2,
  },

  // ── Item cards (grid mode)
  itemCard: {},
  itemThumb: {
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  itemThumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  itemInfo: {
    paddingTop: spacing.sm,
    paddingHorizontal: 2,
    gap: 2,
  },
  itemName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  itemCategory: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },

  // ── Outfit cards
  outfitCard: {},
  collageWrapper: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  outfitInfo: {
    paddingTop: spacing.sm,
    paddingHorizontal: 2,
    gap: 2,
  },
  outfitName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  outfitEvent: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  outfitWorn: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
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

  // ── Bulk action bar
  bulkBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  bulkBarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  bulkCancel: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },
  bulkSelectAll: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
  bulkActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  bulkStylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  bulkStylistBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  bulkBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.secondary,
    gap: 3,
  },
  bulkBtnDisabled: {
    opacity: 0.4,
  },
  bulkBtnDelete: {
    backgroundColor: '#FEE2E2',
  },
  bulkBtnText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  bulkBtnTextDisabled: {
    color: colors.border,
  },
  bulkBtnTextDelete: {
    color: colors.error,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: typography.size.xs,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },

});
