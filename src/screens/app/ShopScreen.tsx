import { useCallback, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { buildShopStylistLaunch } from '../../lib/shopDecisionWorkspace';
import { ShopWishlistSummaryCard } from '../../components/outfits/ShopWishlistSummaryCard';
import { ShopWishlistDetailSheet } from '../../components/outfits/ShopWishlistDetailSheet';
import { ShopWishlistFilterSheet } from '../../components/outfits/ShopWishlistFilterSheet';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { SaveToBoardSheet } from '../../components/boards/SaveToBoardSheet';
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
import type { SavedLooksScreenProps, SavedShoppingScreenProps, SavedShoppingTab } from '../../navigation/types';

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

const TABS: { value: SavedShoppingTab; label: string; kind: 'look' | 'piece' | 'list' }[] = [
  { value: 'looks', label: 'Looks', kind: 'look' },
  { value: 'pieces', label: 'Pieces', kind: 'piece' },
  { value: 'lists', label: 'Lists', kind: 'list' },
];

function tabCopy(tab: SavedShoppingTab) {
  if (tab === 'pieces') return {
    title: 'Saved pieces',
    emptyTitle: 'No saved pieces yet',
    emptySubtitle: 'When your Stylist recommends one standout item, tap “Save this piece” to keep it here.',
    searchPlaceholder: 'Search pieces, brands, cities…',
    searchLabel: 'Search saved pieces',
    noResultsTitle: 'No matching pieces',
  };
  if (tab === 'lists') return {
    title: 'Saved lists',
    emptyTitle: 'No saved lists yet',
    emptySubtitle: 'Ask your Stylist for a focused list of options, then save it here for later.',
    searchPlaceholder: 'Search lists, brands, cities…',
    searchLabel: 'Search saved lists',
    noResultsTitle: 'No matching lists',
  };
  return {
    title: 'Saved looks',
    emptyTitle: 'No saved looks yet',
    emptySubtitle: 'Ask your AI Stylist to shop for a complete outfit. When it suggests one, tap “Save this look” to keep it here.',
    searchPlaceholder: 'Search looks, brands, cities…',
    searchLabel: 'Search saved looks',
    noResultsTitle: 'No matching looks',
  };
}

type SavedShoppingContentProps = {
  navigation: SavedShoppingScreenProps['navigation'];
  initialTab: SavedShoppingTab;
  selectedId?: string;
};

function SavedShoppingContent({ navigation, initialTab, selectedId }: SavedShoppingContentProps) {
  const insets = useSafeAreaInsets();
  const { openStylist } = useGlobalAIStylist();
  const { data: entries = [], isLoading: loading, refetch } = useWishlist();
  const { mutate: removeItem } = useRemoveFromWishlist();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<WishlistScope>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<WishlistSortOrder>('newest');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<SavedShoppingTab>(initialTab);
  const [selectedEntry, setSelectedEntry] = useState<WishlistEntry | null>(null);
  const [boardTarget, setBoardTarget] = useState<BoardEntryRef | null>(null);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!selectedId) return;
      const entry = entries.find((item) => item.id === selectedId);
      if (entry) {
        const kind = getWishlistRecommendationType(entry);
        setActiveTab(kind === 'piece' ? 'pieces' : kind === 'list' ? 'lists' : 'looks');
        setSelectedEntry(entry);
        navigation.setParams({ selectedId: undefined });
      }
    }, [entries, navigation, selectedId]),
  );

  const selectedTab = TABS.find((tab) => tab.value === activeTab) ?? TABS[0];
  const copy = tabCopy(activeTab);
  const tabEntries = useMemo(
    () => entries.filter((entry) => getWishlistRecommendationType(entry) === selectedTab.kind),
    [entries, selectedTab.kind],
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
    looks: entries.filter((entry) => getWishlistRecommendationType(entry) === 'look').length,
    pieces: entries.filter((entry) => getWishlistRecommendationType(entry) === 'piece').length,
    lists: entries.filter((entry) => getWishlistRecommendationType(entry) === 'list').length,
  }), [entries]);
  const resultNoun = activeTab === 'looks' ? 'look' : activeTab === 'pieces' ? 'piece' : 'list';

  const confirmRemove = useCallback((entry: WishlistEntry) => {
    const kind = getWishlistRecommendationType(entry);
    const label = kind === 'look' ? 'look' : kind === 'piece' ? 'piece' : 'list';
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
    setTimeout(() => setBoardTarget({ type: 'wishlist', id: entry.id }), 300);
  }, []);

  const openEntryMenu = useCallback((entry: WishlistEntry) => {
    const kind = getWishlistRecommendationType(entry);
    const label = kind === 'look' ? 'look' : kind === 'piece' ? 'piece' : 'list';

    if (process.env.EXPO_OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Save to board', `Remove saved ${label}`],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (index) => {
          if (index === 1) openBoardPicker(entry);
          if (index === 2) confirmRemove(entry);
        },
      );
      return;
    }

    Alert.alert(`Saved ${label}`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save to board', onPress: () => openBoardPicker(entry) },
      { text: 'Remove', style: 'destructive', onPress: () => confirmRemove(entry) },
    ]);
  }, [confirmRemove, openBoardPicker]);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ShopSubpageHeader
        eyebrow="Shop"
        title="Saved shopping"
        compact
        subtitle={`${savedCounts.looks} look${savedCounts.looks === 1 ? '' : 's'} · ${savedCounts.pieces} piece${savedCounts.pieces === 1 ? '' : 's'} · ${savedCounts.lists} list${savedCounts.lists === 1 ? '' : 's'}`}
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('ShopMain'))}
        actions={(
          <>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => navigation.navigate('ShoppingGallery')}
              accessibilityLabel="Open Shortlist"
            >
              <Ionicons name="images-outline" size={21} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => navigation.navigate('ShoppingCamera')}
              accessibilityLabel="Open Shopping Mode camera"
            >
              <Ionicons name="camera-outline" size={21} color={colors.foreground} />
            </TouchableOpacity>
          </>
        )}
      />

      <View style={styles.tabControls}>
        <SegmentedControl
          value={activeTab}
          variant="tabs"
          options={TABS.map(({ value, label }) => ({ value, label }))}
          onChange={(value) => {
            setActiveTab(value);
            clearAllSearchAndFilters();
          }}
        />
      </View>

      {tabEntries.length === 0 ? (
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
            label="Chat with your Stylist"
            icon="sparkles"
            onPress={() => openStylist(buildShopStylistLaunch(
              activeTab === 'lists' ? 'Build me a focused shopping list.' : activeTab === 'pieces' ? 'Help me find one piece to buy.' : 'Shop for a new outfit for me',
              activeTab === 'lists' ? 'shop_list' : activeTab === 'pieces' ? 'shop_piece' : 'shop_new',
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
            contentContainerStyle={[styles.listContent, filteredEntries.length === 0 && styles.listContentEmpty]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ShopWishlistSummaryCard
                entry={item}
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
    </View>
  );
}

export function SavedShoppingScreen({ navigation, route }: SavedShoppingScreenProps) {
  return (
    <SavedShoppingContent
      navigation={navigation}
      initialTab={route.params?.tab ?? 'looks'}
      selectedId={route.params?.selectedId}
    />
  );
}

/** Backward-compatible deep link used by existing shortcuts and notifications. */
export function SavedLooksScreen({ navigation, route }: SavedLooksScreenProps) {
  return (
    <SavedShoppingContent
      navigation={navigation as SavedShoppingScreenProps['navigation']}
      initialTab="looks"
      selectedId={route.params?.selectedId}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  browseControls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  tabControls: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.surfaceElevated },
  searchBox: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceElevated,
  },
  searchInput: {
    flex: 1,
    height: 42,
    paddingVertical: 0,
    fontSize: typography.size.sm,
    lineHeight: typography.inputLineHeight(typography.size.sm),
    color: colors.foreground,
  },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.lg, paddingBottom: spacing.xxxl },
  listContentEmpty: { flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.foreground },
  emptySubtitle: { maxWidth: 280, fontSize: typography.size.sm, lineHeight: 21, color: colors.mutedForeground, textAlign: 'center' },
  emptyButton: { minHeight: 48, paddingHorizontal: spacing.lg },
  noResults: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  noResultsTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  noResultsText: { fontSize: typography.size.sm, color: colors.mutedForeground, textAlign: 'center' },
  clearButton: { marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.secondary },
  clearButtonText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
});
