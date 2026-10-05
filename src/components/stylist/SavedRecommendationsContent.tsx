import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { buildShopStylistLaunch } from '../../lib/shopDecisionWorkspace';
import { ShopWishlistSummaryCard } from '../../components/outfits/ShopWishlistSummaryCard';
import { ShopWishlistDetailSheet } from '../../components/outfits/ShopWishlistDetailSheet';
import { ShopWishlistFilterSheet } from '../../components/outfits/ShopWishlistFilterSheet';
import { SaveToBoardSheet } from '../../components/boards/SaveToBoardSheet';
import { ActionMenuSheet } from '../../components/primitives/ActionMenuSheet';
import type { BoardEntryRef } from '../../hooks/useBoards';
import { useWishlist, useRemoveFromWishlist } from '../../hooks/useWishlist';
import {
  countWishlistFilters,
  filterWishlist,
  getWishlistFilterOptions,
  type WishlistScope,
  type WishlistSortOrder,
} from '../../lib/shopWishlistFilters';
import type { WishlistEntry } from '../../lib/wishlist';
import { getWishlistRecommendationType } from '../../lib/wishlistType';
import { colors, spacing, typography, radii } from '../../theme';
import {
  ActionButton,
  FilterControl,
  SegmentedControl,
} from '../../components/primitives/Editorial';
import { track } from '../../lib/analytics';
import { wishlistSectionFromLegacy } from '../../navigation/savedRecommendations';
import type { SavedShoppingTab, WishlistSection } from '../../navigation/types';

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

const TABS: { value: WishlistSection; label: string }[] = [
  { value: 'products', label: 'Products' },
  { value: 'lists', label: 'Lists' },
];

function tabCopy(tab: WishlistSection) {
  return tab === 'products' ? {
    emptyTitle: 'Products you’re considering',
    emptySubtitle: 'Add products from Shop or your Stylist to your wishlist to revisit them here.',
    searchPlaceholder: 'Search products, brands, cities…',
    searchLabel: 'Search wishlist products',
    noResultsTitle: 'No matching products',
  } : {
    emptyTitle: 'Shopping recommendations saved together',
    emptySubtitle: 'Save a shopping outfit or wardrobe guide as a list to keep its recommendations together.',
    searchPlaceholder: 'Search lists, brands, cities…',
    searchLabel: 'Search wishlist lists',
    noResultsTitle: 'No matching lists',
  };
}

type SavedRecommendationsContentProps = {
  initialTab?: SavedShoppingTab;
  initialSection?: WishlistSection;
  selectedId?: string;
  active?: boolean;
  onTabConsumed?: () => void;
  onSelectionConsumed: () => void;
};

export function SavedRecommendationsContent({ initialTab, initialSection, selectedId, active = true, onTabConsumed, onSelectionConsumed }: SavedRecommendationsContentProps) {
  const { openStylist } = useGlobalAIStylist();
  const { fontScale } = useWindowDimensions();
  const { data: entries = [], isLoading: loading, isFetching, isFetchedAfterMount, isError, refetch } = useWishlist();
  const { mutate: removeItem } = useRemoveFromWishlist();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<WishlistScope>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<WishlistSortOrder>('newest');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<WishlistSection>(initialSection ?? wishlistSectionFromLegacy(initialTab));
  const [selectedEntry, setSelectedEntry] = useState<WishlistEntry | null>(null);
  const [menuEntry, setMenuEntry] = useState<WishlistEntry | null>(null);
  const [boardTarget, setBoardTarget] = useState<BoardEntryRef | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const boardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (active) void refetch();
    else {
      if (boardTimer.current) clearTimeout(boardTimer.current);
      setSelectedEntry(null);
      setMenuEntry(null);
      setFiltersVisible(false);
      setBoardTarget(null);
    }
  }, [active, refetch]);

  useEffect(() => {
    if (initialSection || initialTab) {
      setActiveTab(initialSection ?? wishlistSectionFromLegacy(initialTab));
      onTabConsumed?.();
    }
  }, [initialTab, initialSection, onTabConsumed]);

  useEffect(() => {
    if (!active || !selectedId || loading) return;
    const entry = entries.find((item) => item.id === selectedId);
    if (entry) {
      const kind = getWishlistRecommendationType(entry);
      setActiveTab(kind === 'piece' ? 'products' : 'lists');
      setQuery(''); setScope('all'); setCategories([]); setCities([]); setBrands([]); setSortOrder('newest');
      setSelectedEntry(entry);
      setSelectionNotice(null);
      onSelectionConsumed();
    } else if (!isFetching && isFetchedAfterMount && !isError) {
      setSelectionNotice('This recommendation is no longer saved.');
      onSelectionConsumed();
    }
  }, [active, entries, isFetching, isFetchedAfterMount, isError, loading, onSelectionConsumed, selectedId]);

  useEffect(() => {
    if (selectedEntry && !entries.some(entry => entry.id === selectedEntry.id)) setSelectedEntry(null);
  }, [entries, selectedEntry]);

  const copy = tabCopy(activeTab);
  const tabEntries = useMemo(
    () => entries.filter((entry) => activeTab === 'products' ? getWishlistRecommendationType(entry) === 'piece' : getWishlistRecommendationType(entry) !== 'piece'),
    [entries, activeTab],
  );
  const filterOptions = useMemo(() => getWishlistFilterOptions(tabEntries), [tabEntries]);
  const filters = useMemo(() => ({
    query,
    scope,
    categories,
    cities,
    brands,
    sortOrder,
  }), [query, scope, categories, cities, brands, sortOrder]);
  const filteredEntries = useMemo(() => filterWishlist(tabEntries, filters), [filters, tabEntries]);
  const activeFilterCount = countWishlistFilters(filters);

  const clearFilters = useCallback(() => {
    setCategories([]);
    setCities([]);
    setBrands([]);
    setSortOrder('newest');
  }, []);

  const clearFiltersAndScope = useCallback(() => {
    setScope('all');
    clearFilters();
  }, [clearFilters]);

  const clearAllSearchAndFilters = useCallback(() => {
    setQuery('');
    setScope('all');
    clearFilters();
  }, [clearFilters]);

  const savedCounts = useMemo(() => ({
    products: entries.filter((entry) => getWishlistRecommendationType(entry) === 'piece').length,
    lists: entries.filter((entry) => getWishlistRecommendationType(entry) !== 'piece').length,
  }), [entries]);
  const resultNoun = activeTab === 'products' ? 'product' : 'list';

  const confirmRemove = useCallback((entry: WishlistEntry) => {
    const kind = getWishlistRecommendationType(entry);
    const label = kind === 'piece' ? 'product' : 'list';
    Alert.alert(`Remove saved ${label}?`, `This saved ${label} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeItem(entry.id) },
    ]);
  }, [removeItem]);

  /**
   * Open the board picker for a saved entry. Any presented detail sheet is
   * closed first and the picker opened on a delay: presenting one
   * BottomSheetModal while a sibling is dismissing wedges the first at
   * DISMISSING, after which every later present() silently no-ops.
   */
  const openBoardPicker = useCallback((entry: WishlistEntry) => {
    setSelectedEntry(null);
    if (boardTimer.current) clearTimeout(boardTimer.current);
    boardTimer.current = setTimeout(() => setBoardTarget({ type: 'wishlist', id: entry.id }), 300);
  }, []);

  useEffect(() => () => { if (boardTimer.current) clearTimeout(boardTimer.current); }, []);

  const openEntryMenu = useCallback((entry: WishlistEntry) => {
    setMenuEntry(entry);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={styles.root}>
      <View style={styles.tabControls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <SegmentedControl
          value={activeTab}
          variant="tabs"
          style={{ minWidth: Math.max(350, TABS.reduce((total, tab) => total + (tab.label.length + String(savedCounts[tab.value]).length + 1) * 9 * fontScale + 24, 0)) }}
          options={TABS.map(({ value, label }) => ({ value, label: `${label} ${savedCounts[value]}` }))}
          onChange={(value) => {
            setActiveTab(value);
            track('wishlist_section_selected', { section: value });
            clearAllSearchAndFilters();
          }}
        />
        </ScrollView>
      </View>

      {selectionNotice ? <Text accessibilityRole="alert" style={styles.notice}>{selectionNotice}</Text> : null}
      {isError ? <View style={styles.errorState}>
        <Text accessibilityRole="alert" style={styles.noResultsText}>{entries.length ? 'Your wishlist is here. We couldn’t refresh it.' : 'Couldn’t load your wishlist.'}</Text>
        <ActionButton icon="refresh-outline" label="Try again" variant="secondary" onPress={() => void refetch()} />
      </View> : null}
      {loading ? (
        <SavedListSkeleton />
      ) : isError && entries.length === 0 ? null : tabEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="bag-handle-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>
            {copy.emptySubtitle}
          </Text>
          <ActionButton
            style={styles.emptyButton}
            label="Ask your Stylist"
            icon="sparkles"
            onPress={() => openStylist(buildShopStylistLaunch(
              activeTab === 'lists' ? 'Build me a focused shopping list.' : 'Help me find one piece to buy.',
              activeTab === 'lists' ? 'shop_list' : 'shop_piece',
            ))}
            accessibilityLabel="Open AI Stylist"
          />
        </View>
      ) : (
        <>
          <View style={styles.browseControls}>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  style={styles.searchInput}
                  placeholder={copy.searchPlaceholder}
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={Keyboard.dismiss}
                  accessibilityLabel={copy.searchLabel}
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
              <FilterControl count={activeFilterCount} onPress={() => setFiltersVisible(true)} />
            </View>

          </View>

          <FlatList
            data={filteredEntries}
            keyExtractor={(entry) => entry.id}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
            contentContainerStyle={[styles.listContent, filteredEntries.length === 0 && styles.listContentEmpty]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ShopWishlistSummaryCard
                entry={item}
                showType={activeTab === 'lists'}
                onPress={() => setSelectedEntry(item)}
                onMore={() => openEntryMenu(item)}
              />
            )}
            ListEmptyComponent={(
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={30} color={colors.mutedForeground} />
                <Text style={styles.noResultsTitle}>{copy.noResultsTitle}</Text>
                <Text style={styles.noResultsText}>Try another search or clear your filters.</Text>
                <TouchableOpacity style={styles.clearButton} onPress={clearAllSearchAndFilters}>
                  <Text style={styles.clearButtonText}>Clear search and filters</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      )}

      {filtersVisible && (
        <ShopWishlistFilterSheet
          options={filterOptions}
          categories={categories}
          cities={cities}
          brands={brands}
          scope={scope}
          sortOrder={sortOrder}
          resultCount={filteredEntries.length}
          resultNoun={resultNoun}
          onToggleCategory={(value) => setCategories((current) => toggleValue(current, value))}
          onToggleCity={(value) => setCities((current) => toggleValue(current, value))}
          onToggleBrand={(value) => setBrands((current) => toggleValue(current, value))}
          onScopeChange={setScope}
          onSortChange={setSortOrder}
          onClear={clearFiltersAndScope}
          onClose={() => setFiltersVisible(false)}
        />
      )}
      {selectedEntry && (
        <ShopWishlistDetailSheet
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onRemove={() => removeItem(selectedEntry.id)}
          onSaveToBoard={() => openBoardPicker(selectedEntry)}
        />
      )}
      {boardTarget && (
        <SaveToBoardSheet target={boardTarget} onClose={() => setBoardTarget(null)} />
      )}
      {menuEntry && (
        <ActionMenuSheet
          visible
          title="Wishlist options"
          subtitle={getWishlistRecommendationType(menuEntry) === 'piece' ? 'Product' : 'List'}
          options={[
            { label: 'Save to board', icon: 'albums-outline', onPress: () => openBoardPicker(menuEntry) },
            {
              label: `Remove ${getWishlistRecommendationType(menuEntry) === 'piece' ? 'product' : 'list'}`,
              icon: 'trash-outline',
              destructive: true,
              onPress: () => confirmRemove(menuEntry),
            },
          ]}
          onClose={() => setMenuEntry(null)}
        />
      )}
    </View>
  );
}

/**
 * Three rows in the summary row's own geometry, breathing at 0.55–1 opacity,
 * so the list arrives in place rather than after a centred spinner.
 */
function SavedListSkeleton() {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.skeleton} accessibilityLabel="Loading wishlist" accessibilityRole="progressbar">
      {[0, 1, 2].map((row) => (
        <Animated.View key={row} style={[styles.skeletonRow, pulseStyle]}>
          <View style={styles.skeletonPlate} />
          <View style={styles.skeletonCopy}>
            <View style={[styles.skeletonBar, { width: 72 }]} />
            <View style={[styles.skeletonBar, styles.skeletonBarTitle]} />
            <View style={[styles.skeletonBar, { width: 140 }]} />
            <View style={[styles.skeletonBar, styles.skeletonBarFigure]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  // The header above is compact, so the working controls get the rhythm the
  // masthead used to: tabs, then a full step down to the search row.
  tabControls: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  browseControls: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notice: { ...typography.text.bodySmall, color: colors.mutedForeground, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  errorState: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  // Same height and edge as the FilterControl beside it, so the row reads as
  // one control set. `border`, not `hairline`: white-on-ivory needs a drawn edge.
  searchBox: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingVertical: 0,
    fontSize: typography.text.bodySmall.fontSize,
    lineHeight: typography.inputLineHeight(typography.text.bodySmall.fontSize),
    color: colors.foreground,
  },
  // Rows carry their own rule and vertical padding.
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  skeleton: { paddingHorizontal: spacing.lg },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  skeletonPlate: { width: 88, aspectRatio: 4 / 5, borderRadius: radii.photo, backgroundColor: colors.surfaceSubtle },
  skeletonCopy: { flex: 1, gap: spacing.sm, paddingTop: spacing.xs },
  skeletonBar: { height: 12, borderRadius: radii.sm, backgroundColor: colors.surfaceSubtle },
  skeletonBarTitle: { height: 16, width: '85%' },
  skeletonBarFigure: { width: 96, marginTop: spacing.xs },
  listContentEmpty: { flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.bold, color: colors.foreground },
  emptySubtitle: { maxWidth: 280, fontSize: typography.text.bodySmall.fontSize, lineHeight: 21, color: colors.mutedForeground, textAlign: 'center' },
  emptyButton: { minHeight: 48, paddingHorizontal: spacing.lg },
  noResults: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  noResultsTitle: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  noResultsText: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground, textAlign: 'center' },
  clearButton: { marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.secondary },
  clearButtonText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
});
