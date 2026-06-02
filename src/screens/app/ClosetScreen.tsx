import { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useItems } from '../../hooks/useItems';
import { useOutfits } from '../../hooks/useOutfits';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { FilterPanel } from '../../components/wardrobe/FilterPanel';
import { ClosetGrid } from '../../components/wardrobe/ClosetGrid';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { CATEGORY_LABELS, CATEGORY_ORDER, type ItemCategory } from '../../types/item';
import { colors, shadows, spacing, typography, radii } from '../../theme';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import type { ClosetScreenProps } from '../../navigation/types';

type SortKey = 'newest' | 'oldest' | 'name_asc';
type ViewMode = 'grid' | 'list';
type Segment = 'pieces' | 'outfits';

const SIDE_PAD = spacing.lg;
const COL_GAP  = spacing.sm;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'name_asc', label: 'Name A → Z' },
];

// Heights used to size the collapsible region and sheet detents.
// These are rough constants; adjust if layout changes.
const SEARCH_ROW_H = 58;
const PILL_ROW_H   = 52;

export function ClosetScreen({ navigation }: ClosetScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { openStylist } = useGlobalAIStylist();

  const [segment, setSegment]               = useState<Segment>('pieces');
  const [search, setSearch]                 = useState('');
  const [activeCategory, setActiveCategory] = useState<ItemCategory | null>(null);
  const [sortKey, setSortKey]               = useState<SortKey>('newest');
  const [viewMode, setViewMode]             = useState<ViewMode>('grid');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set());

  const { data: items   = [] } = useItems();
  const { data: outfits = [] } = useOutfits();

  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;

  // ── Filter metadata ────────────────────────────────────────────────────────

  const allColors  = useMemo(() => [...new Set(items.filter(i => i.color).map(i => i.color!))].sort(), [items]);
  const allBrands  = useMemo(() => [...new Set(items.filter(i => i.brand).map(i => i.brand!))].sort(), [items]);
  const allSeasons = useMemo(() => [...new Set(items.filter(i => i.season).map(i => i.season!))].sort(), [items]);

  const activeFilterCount = useMemo(
    () =>
      (sortKey !== 'newest' ? 1 : 0) +
      selectedColors.length +
      selectedBrands.length +
      selectedSeasons.length,
    [sortKey, selectedColors, selectedBrands, selectedSeasons],
  );

  // ── Hide-on-scroll ─────────────────────────────────────────────────────────
  // collapsibleAnim drives maxHeight on the search+pills container.
  // Collapses on downward scroll past a threshold, re-expands on upward scroll.

  const lastScrollY      = useRef(0);
  const isCollapsed      = useRef(false);
  const collapsibleAnim  = useRef(new Animated.Value(SEARCH_ROW_H + PILL_ROW_H)).current;

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
        expandCollapsible();
      } else if (delta > 6) {
        collapseCollapsible();
      } else if (delta < -6) {
        expandCollapsible();
      }
    },
    [expandCollapsible, collapseCollapsible],
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
      result = result.filter(i => i.color && selectedColors.some(c => i.color!.toLowerCase().includes(c.toLowerCase())));
    if (selectedBrands.length)
      result = result.filter(i => i.brand && selectedBrands.includes(i.brand));
    if (selectedSeasons.length)
      result = result.filter(i => i.season && selectedSeasons.includes(i.season));

    const arr = [...result];
    if (sortKey === 'oldest')    arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else if (sortKey === 'name_asc') arr.sort((a, b) => a.name.localeCompare(b.name));
    else                         arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [items, activeCategory, search, sortKey, selectedColors, selectedBrands, selectedSeasons]);

  const filteredOutfits = useMemo(() => {
    if (!search.trim()) return outfits;
    const q = search.trim().toLowerCase();
    return outfits.filter(
      o =>
        o.name.toLowerCase().includes(q) ||
        (o.event ?? '').toLowerCase().includes(q) ||
        (o.tags ?? []).some(t => t.toLowerCase().includes(q)),
    );
  }, [outfits, search]);

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
    setSelectionMode(true);
    setSelectedIds(new Set([item.id]));
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const renderItemRow = useCallback(
    ({ item }: { item: (typeof items)[number] }) => {
      const uri = resolveImageUri(item.imageUrl);
      return (
        <TouchableOpacity
          style={styles.itemRow}
          onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
          activeOpacity={0.85}
        >
          <View style={styles.itemRowThumb}>
            {uri ? (
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
          {item.isFavorite && (
            <Ionicons name="heart" size={16} color={colors.primary} />
          )}
        </TouchableOpacity>
      );
    },
    [navigation],
  );

  const renderOutfitCard = useCallback(
    ({ item: outfit }: { item: (typeof outfits)[number] }) => (
      <TouchableOpacity
        style={[styles.outfitCard, { width: cardWidth }]}
        onPress={() => navigation.navigate('OutfitDetail', { outfitId: outfit.id })}
        activeOpacity={0.85}
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
      </TouchableOpacity>
    ),
    [cardWidth, navigation],
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

  const emptyOutfits = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="layers-outline" size={32} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyTitle}>
        {search ? 'No outfits match' : 'No outfits yet'}
      </Text>
      <Text style={styles.emptySub}>
        {search ? 'Try a different search' : 'Build outfits from your pieces'}
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
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => openStylist()}
            accessibilityLabel="Open AI Stylist"
          >
            <Ionicons name="sparkles" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
            accessibilityLabel="Toggle view"
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
              size={20}
              color={colors.foreground}
            />
          </TouchableOpacity>
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
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {segment === 'pieces' && (
            <TouchableOpacity
              style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
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
            </TouchableOpacity>
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
            <TouchableOpacity
              style={[styles.pill, activeCategory === null && styles.pillActive]}
              onPress={() => setActiveCategory(null)}
            >
              <Text style={[styles.pillLabel, activeCategory === null && styles.pillLabelActive]}>
                All
              </Text>
            </TouchableOpacity>
            {availableCategories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.pill, activeCategory === cat && styles.pillActive]}
                onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                <Text style={[styles.pillLabel, activeCategory === cat && styles.pillLabelActive]}>
                  {CATEGORY_LABELS[cat]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </Animated.View>

      {/* ── Content ── */}
      {segment === 'pieces' ? (
        viewMode === 'grid' ? (
          <ClosetGrid
            items={filteredItems}
            selectedIds={selectedIds}
            selectionMode={selectionMode}
            onItemPress={handleItemPress}
            onItemLongPress={handleLongPress}
            onToggleSelect={toggleSelect}
            ListEmptyComponent={emptyPieces}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        ) : (
          <FlatList
            style={styles.list}
            key="pieces-list"
            data={filteredItems}
            keyExtractor={item => String(item.id)}
            renderItem={renderItemRow}
            ListEmptyComponent={emptyPieces}
            contentContainerStyle={[styles.listContent, styles.listContentRow]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        )
      ) : (
        <FlatList
          style={styles.list}
          key="outfits"
          data={filteredOutfits}
          keyExtractor={outfit => String(outfit.id)}
          renderItem={renderOutfitCard}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          ListEmptyComponent={emptyOutfits}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      )}

      <FilterPanel
        visible={filterSheetOpen}
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
        filteredCount={filteredItems.length}
        activeFilterCount={activeFilterCount}
        onClearAll={clearSheetFilters}
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
  columnWrapper: {
    gap: COL_GAP,
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
