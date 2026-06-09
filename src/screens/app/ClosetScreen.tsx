import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { OutfitBuilderSheet } from '../../components/outfits/OutfitBuilderSheet';
import { FilterPanel, parseMaterialString } from '../../components/wardrobe/FilterPanel';
import { OutfitFilterPanel } from '../../components/outfits/OutfitFilterPanel';
import { ClosetGrid } from '../../components/wardrobe/ClosetGrid';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { CATEGORY_LABELS, CATEGORY_ORDER, SEASON_OPTIONS, type ItemCategory } from '../../types/item';
import { colors, shadows, spacing, typography, radii } from '../../theme';
import { useGlobalScan } from '../../contexts/GlobalScanContext';
import { useFabScroll } from '../../contexts/FabScrollContext';
import { useFocusEffect } from '@react-navigation/native';
import { PressableScale } from '../../components/primitives/PressableScale';
import type { ClosetScreenProps } from '../../navigation/types';

type SortKey = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'most_worn' | 'least_worn' | 'recently_worn' | 'cost_per_wear';
type OutfitSortKey = 'newest' | 'oldest' | 'most_worn' | 'recently_worn' | 'name_asc';
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
const SEARCH_ROW_H = 58;
const PILL_ROW_H   = 52;

export function ClosetScreen({ navigation }: ClosetScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { openScanItem } = useGlobalScan();
  const { fabCollapsed } = useFabScroll();

  const [segment, setSegment]               = useState<Segment>('pieces');
  const [search, setSearch]                 = useState('');
  const [activeCategory, setActiveCategory] = useState<ItemCategory | null>(null);
  const [sortKey, setSortKey]               = useState<SortKey>('newest');
  const [viewMode, setViewMode]             = useState<ViewMode>('grid');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [selectedWarmth, setSelectedWarmth] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedOccasions, setSelectedOccasions]   = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses]     = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials]   = useState<string[]>([]);

  // ── Outfit-segment filters ─────────────────────────────────────────────
  const [outfitSortKey, setOutfitSortKey]         = useState<OutfitSortKey>('newest');
  const [outfitSelectedTags, setOutfitSelectedTags]   = useState<string[]>([]);
  const [outfitSelectedEvents, setOutfitSelectedEvents] = useState<string[]>([]);
  const [outfitShowNeverWorn, setOutfitShowNeverWorn]   = useState(false);
  const [outfitFilterSheetOpen, setOutfitFilterSheetOpen] = useState(false);

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

  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;

  // ── Filter metadata ────────────────────────────────────────────────────────

  const allColors    = useMemo(() => [...new Set(items.filter(i => i.colorNormalized).map(i => i.colorNormalized!))].sort(), [items]);
  const allBrands    = useMemo(() => [...new Set(items.filter(i => i.brand).map(i => i.brand!))].sort(), [items]);
  const allSeasons   = useMemo(() => [...SEASON_OPTIONS], []);
  const allMaterials = useMemo(
    () => [...new Set(
      items
        .filter(i => i.material && i.material.toLowerCase() !== 'null')
        .flatMap(i => parseMaterialString(i.material!))
    )].sort(),
    [items],
  );

  const activeFilterCount = useMemo(
    () =>
      (sortKey !== 'newest' ? 1 : 0) +
      selectedColors.length +
      selectedBrands.length +
      selectedSeasons.length +
      selectedConditions.length +
      selectedWarmth.length +
      selectedCategories.length +
      selectedOccasions.length +
      selectedStatuses.length +
      selectedMaterials.length,
    [sortKey, selectedColors, selectedBrands, selectedSeasons,
     selectedConditions, selectedWarmth, selectedCategories,
     selectedOccasions, selectedStatuses, selectedMaterials],
  );

  const allOutfitTags = useMemo(
    () => [...new Set(outfits.flatMap(o => o.tags ?? []))].sort(),
    [outfits],
  );
  const allOutfitEvents = useMemo(
    () => [...new Set(outfits.filter(o => o.event).map(o => o.event!))].sort(),
    [outfits],
  );
  const outfitActiveFilterCount = useMemo(
    () =>
      (outfitSortKey !== 'newest' ? 1 : 0) +
      outfitSelectedTags.length +
      outfitSelectedEvents.length +
      (outfitShowNeverWorn ? 1 : 0),
    [outfitSortKey, outfitSelectedTags, outfitSelectedEvents, outfitShowNeverWorn],
  );

  // ── Hide-on-scroll ─────────────────────────────────────────────────────────
  // collapsibleAnim drives maxHeight on the search+pills container.
  // Collapses on downward scroll past a threshold, re-expands on upward scroll.

  const lastScrollY      = useRef(0);
  const isCollapsed      = useRef(false);
  const collapsibleAnim  = useRef(new Animated.Value(SEARCH_ROW_H + PILL_ROW_H)).current;

  useFocusEffect(useCallback(() => {
    fabCollapsed.value = 0;
  }, [fabCollapsed]));

  const expandCollapsible = useCallback(() => {
    if (!isCollapsed.current) return;
    isCollapsed.current = false;
    Animated.spring(collapsibleAnim, {
      toValue: SEARCH_ROW_H + PILL_ROW_H,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
  }, [collapsibleAnim]);

  const collapseCollapsible = useCallback(() => {
    if (isCollapsed.current) return;
    isCollapsed.current = true;
    Animated.spring(collapsibleAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
  }, [collapsibleAnim]);

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

  // ── Category data ──────────────────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ItemCategory, number>> = {};
    for (const item of items) {
      if (item.category) counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const availableCategories = useMemo(
    () => CATEGORY_ORDER.filter(c => (categoryCounts[c] ?? 0) > 0),
    [categoryCounts],
  );

  // ── Filtered data ──────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    let result = items.filter(i => !i.isArchived);
    if (activeCategory) result = result.filter(i => i.category === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          (i.brand ?? '').toLowerCase().includes(q) ||
          (i.category ? (CATEGORY_LABELS[i.category] ?? '').toLowerCase().includes(q) : false),
      );
    }
    if (selectedColors.length)
      result = result.filter(i => i.colorNormalized && selectedColors.includes(i.colorNormalized));
    if (selectedBrands.length)
      result = result.filter(i => i.brand && selectedBrands.includes(i.brand));
    if (selectedSeasons.length)
      result = result.filter(i => (i.seasons ?? []).some(s => selectedSeasons.includes(s)));
    if (selectedConditions.length)
      result = result.filter(i => i.condition && selectedConditions.includes(i.condition));
    if (selectedWarmth.length)
      result = result.filter(i => i.warmthRating != null && selectedWarmth.includes(i.warmthRating));
    if (selectedCategories.length)
      result = result.filter(i => i.category && selectedCategories.includes(i.category));
    if (selectedOccasions.length)
      result = result.filter(i => (i.occasions ?? []).some(o => selectedOccasions.includes(o)));
    if (selectedStatuses.length)
      result = result.filter(i => i.laundryStatus != null && selectedStatuses.includes(i.laundryStatus));
    if (selectedMaterials.length)
      result = result.filter(i =>
        parseMaterialString(i.material ?? '').some(m => selectedMaterials.includes(m))
      );

    const arr = [...result];
    if (sortKey === 'oldest')
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else if (sortKey === 'name_asc')
      arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === 'name_desc')
      arr.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortKey === 'most_worn')
      arr.sort((a, b) => (b.wearCount ?? 0) - (a.wearCount ?? 0));
    else if (sortKey === 'least_worn')
      arr.sort((a, b) => (a.wearCount ?? 0) - (b.wearCount ?? 0));
    else if (sortKey === 'recently_worn')
      arr.sort((a, b) => {
        const ta = a.lastWornAt ? new Date(a.lastWornAt).getTime() : 0;
        const tb = b.lastWornAt ? new Date(b.lastWornAt).getTime() : 0;
        return tb - ta;
      });
    else if (sortKey === 'cost_per_wear')
      arr.sort((a, b) => {
        const cpwA = a.purchasePrice != null && a.wearCount > 0 ? a.purchasePrice / a.wearCount : Infinity;
        const cpwB = b.purchasePrice != null && b.wearCount > 0 ? b.purchasePrice / b.wearCount : Infinity;
        return cpwA - cpwB;
      });
    else
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [items, activeCategory, search, sortKey, selectedColors, selectedBrands, selectedSeasons,
      selectedConditions, selectedWarmth, selectedCategories, selectedOccasions,
      selectedStatuses, selectedMaterials]);

  const filteredOutfits = useMemo(() => {
    let result = outfits;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        o =>
          o.name.toLowerCase().includes(q) ||
          (o.event ?? '').toLowerCase().includes(q) ||
          (o.tags ?? []).some(t => t.toLowerCase().includes(q)),
      );
    }
    if (outfitSelectedTags.length)
      result = result.filter(o => outfitSelectedTags.every(t => (o.tags ?? []).includes(t)));
    if (outfitSelectedEvents.length)
      result = result.filter(o => o.event && outfitSelectedEvents.includes(o.event));
    if (outfitShowNeverWorn)
      result = result.filter(o => o.wearCount === 0);

    const arr = [...result];
    if (outfitSortKey === 'oldest')
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else if (outfitSortKey === 'most_worn')
      arr.sort((a, b) => b.wearCount - a.wearCount);
    else if (outfitSortKey === 'recently_worn')
      arr.sort((a, b) => {
        if (!a.lastWornAt && !b.lastWornAt) return 0;
        if (!a.lastWornAt) return 1;
        if (!b.lastWornAt) return -1;
        return new Date(b.lastWornAt).getTime() - new Date(a.lastWornAt).getTime();
      });
    else if (outfitSortKey === 'name_asc')
      arr.sort((a, b) => a.name.localeCompare(b.name));
    else
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [outfits, search, outfitSelectedTags, outfitSelectedEvents, outfitShowNeverWorn, outfitSortKey]);

  // ── Segment switch ─────────────────────────────────────────────────────────

  const handleSegmentChange = useCallback(
    (next: Segment) => {
      if (next === segment) return;
      setSearch('');
      setActiveCategory(null);
      setSortKey('newest');
      setSelectedColors([]);
      setSelectedBrands([]);
      setSelectedSeasons([]);
      setSelectedConditions([]);
      setSelectedWarmth([]);
      setSelectedCategories([]);
      setSelectedOccasions([]);
      setSelectedStatuses([]);
      setSelectedMaterials([]);
      setOutfitSortKey('newest');
      setOutfitSelectedTags([]);
      setOutfitSelectedEvents([]);
      setOutfitShowNeverWorn(false);
      setSegment(next);
      expandCollapsible();
    },
    [segment, expandCollapsible],
  );

  const clearSheetFilters = () => {
    setSortKey('newest');
    setSelectedColors([]);
    setSelectedBrands([]);
    setSelectedSeasons([]);
    setSelectedConditions([]);
    setSelectedWarmth([]);
    setSelectedCategories([]);
    setSelectedOccasions([]);
    setSelectedStatuses([]);
    setSelectedMaterials([]);
  };

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
        {search || activeCategory ? 'No pieces match' : 'No pieces yet'}
      </Text>
      <Text style={styles.emptySub}>
        {search || activeCategory
          ? 'Try a different search or filter'
          : 'Add items from the + button below'}
      </Text>
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
            contentStyle={styles.headerBtn}
            onPress={() => openScanItem()}
            accessibilityLabel="Add to wardrobe"
          >
            <Ionicons name="add" size={22} color={colors.foreground} />
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
          >
            <Text style={[styles.segmentLabel, segment === 'pieces' && styles.segmentLabelActive]}>
              Pieces
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, segment === 'outfits' && styles.segmentBtnActive]}
            onPress={() => handleSegmentChange('outfits')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentLabel, segment === 'outfits' && styles.segmentLabelActive]}>
              Outfits
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Collapsible: search/filter row + category pills ── */}
      <Animated.View style={[styles.collapsible, { maxHeight: collapsibleAnim }]}>

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
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
        {segment === 'pieces' && availableCategories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillScroll}
            contentContainerStyle={styles.pillContent}
          >
            <PressableScale
              contentStyle={[styles.pill, activeCategory === null && styles.pillActive]}
              onPress={() => setActiveCategory(null)}
            >
              <Text style={[styles.pillLabel, activeCategory === null && styles.pillLabelActive]}>
                All
              </Text>
            </PressableScale>
            {availableCategories.map(cat => (
              <PressableScale
                key={cat}
                contentStyle={[styles.pill, activeCategory === cat && styles.pillActive]}
                onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                <Text style={[styles.pillLabel, activeCategory === cat && styles.pillLabelActive]}>
                  {CATEGORY_LABELS[cat]}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        )}
      </Animated.View>

      {/* ── Content ── */}
      {segment === 'pieces' && itemsError ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>Couldn't load your closet</Text>
          <Text style={styles.emptySub}>Check your connection and try again</Text>
          <Pressable onPress={() => refetchItems()} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Retry</Text>
          </Pressable>
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
          />
        ) : (
          <FlashList
            data={filteredItems}
            keyExtractor={item => String(item.id)}
            renderItem={renderItemRow}
            style={styles.list}
            ListEmptyComponent={itemsLoading ? null : emptyPieces}
            contentContainerStyle={{ ...styles.listContent, ...styles.listContentRow }}
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
              ? styles.listContentRow
              : { paddingHorizontal: SIDE_PAD - COL_GAP / 2, paddingBottom: spacing.xxxl * 2 }
          }
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      )}

      {/* ── Bulk action bar ── */}
      {selectionMode && (
        <View style={[styles.bulkBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.bulkBarTop}>
            <TouchableOpacity onPress={exitSelectionMode}>
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
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={[styles.bulkBtn, selectedIds.size === 0 && styles.bulkBtnDisabled]}
              onPress={handleBulkFavorite}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name="heart-outline" size={17} color={selectedIds.size === 0 ? colors.border : colors.foreground} />
              <Text style={[styles.bulkBtnText, selectedIds.size === 0 && styles.bulkBtnTextDisabled]}>Favourite</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, selectedIds.size === 0 && styles.bulkBtnDisabled]}
              onPress={handleBulkMarkWorn}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name="shirt-outline" size={17} color={selectedIds.size === 0 ? colors.border : colors.foreground} />
              <Text style={[styles.bulkBtnText, selectedIds.size === 0 && styles.bulkBtnTextDisabled]}>Worn today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, selectedIds.size === 0 && styles.bulkBtnDisabled]}
              onPress={handleCreateOutfit}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name="layers-outline" size={17} color={selectedIds.size === 0 ? colors.border : colors.foreground} />
              <Text style={[styles.bulkBtnText, selectedIds.size === 0 && styles.bulkBtnTextDisabled]}>Outfit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnDelete, selectedIds.size === 0 && styles.bulkBtnDisabled]}
              onPress={handleBulkDelete}
              disabled={selectedIds.size === 0}
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
          onClearAll={() => {
            setOutfitSortKey('newest');
            setOutfitSelectedTags([]);
            setOutfitSelectedEvents([]);
            setOutfitShowNeverWorn(false);
          }}
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

  // ── Collapsible wrapper
  collapsible: {
    overflow: 'hidden',
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
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
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
    paddingVertical: spacing.sm,
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
    paddingVertical: spacing.sm,
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

});
