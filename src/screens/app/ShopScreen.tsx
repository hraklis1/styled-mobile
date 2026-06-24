import { useCallback, useMemo, useState } from 'react';
import {
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
import { ShopWishlistSummaryCard } from '../../components/outfits/ShopWishlistSummaryCard';
import { ShopWishlistDetailSheet } from '../../components/outfits/ShopWishlistDetailSheet';
import { ShopWishlistFilterSheet } from '../../components/outfits/ShopWishlistFilterSheet';
import { useWishlist, useRemoveFromWishlist } from '../../hooks/useWishlist';
import {
  countWishlistFilters,
  filterWishlist,
  getWishlistFilterOptions,
  type WishlistScope,
  type WishlistSortOrder,
} from '../../lib/shopWishlistFilters';
import type { WishlistEntry } from '../../lib/wishlist';
import { colors, spacing, typography, radii } from '../../theme';
import type { ShopScreenProps } from '../../navigation/types';

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

const SCOPES: { value: WishlistScope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'event', label: 'For events' },
  { value: 'general', label: 'General' },
];

export function ShopScreen({ navigation }: ShopScreenProps) {
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
  const [selectedEntry, setSelectedEntry] = useState<WishlistEntry | null>(null);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const filterOptions = useMemo(() => getWishlistFilterOptions(entries), [entries]);
  const filters = useMemo(() => ({
    query,
    scope,
    categories,
    cities,
    brands,
    sortOrder,
  }), [query, scope, categories, cities, brands, sortOrder]);
  const filteredEntries = useMemo(() => filterWishlist(entries, filters), [entries, filters]);
  const activeFilterCount = countWishlistFilters(filters);

  const clearFilters = useCallback(() => {
    setCategories([]);
    setCities([]);
    setBrands([]);
    setSortOrder('newest');
  }, []);

  const clearAllSearchAndFilters = useCallback(() => {
    setQuery('');
    setScope('all');
    clearFilters();
  }, [clearFilters]);

  const confirmRemove = useCallback((entry: WishlistEntry) => {
    Alert.alert('Remove saved outfit?', 'This outfit will be removed from your Shop Wishlist.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeItem(entry.id) },
    ]);
  }, [removeItem]);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Shop Wishlist</Text>
          <Text style={styles.headerSub}>
            {entries.length === 0 ? 'No saved outfits yet' : `${entries.length} saved outfit${entries.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.galleryShortcut}
          onPress={() => navigation.navigate('ShoppingGallery')}
          accessibilityLabel="View Shopping Mode gallery"
        >
          <Ionicons name="images-outline" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shoppingModeButton}
          onPress={() => navigation.navigate('ShoppingCamera')}
          accessibilityLabel="Open Shopping Mode camera"
        >
          <Ionicons name="camera" size={19} color={colors.primaryForeground} />
          <Text style={styles.shoppingModeButtonText}>Shopping Mode</Text>
        </TouchableOpacity>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="bag-handle-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Ask your AI Stylist to shop for a new outfit. When it suggests one, tap “Save” to add it here.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => openStylist({ initialQuery: 'Shop for a new outfit for me', source: 'shop' })}
            activeOpacity={0.85}
            accessibilityLabel="Open AI Stylist"
          >
            <Ionicons name="sparkles" size={15} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Chat with your Stylist</Text>
          </TouchableOpacity>
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
                  placeholder="Search outfits, brands, cities…"
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={Keyboard.dismiss}
                  accessibilityLabel="Search saved outfits"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
                onPress={() => setFiltersVisible(true)}
                accessibilityLabel={`Sort and filter${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
              >
                <Ionicons name="options-outline" size={20} color={activeFilterCount ? colors.primaryForeground : colors.foreground} />
                {activeFilterCount > 0 && <Text style={styles.filterCount}>{activeFilterCount}</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.scopeGroup} accessibilityRole="tablist">
              {SCOPES.map((option) => {
                const active = scope === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.scopeButton, active && styles.scopeButtonActive]}
                    onPress={() => setScope(option.value)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.scopeText, active && styles.scopeTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
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
                onMore={() => confirmRemove(item)}
              />
            )}
            ListEmptyComponent={(
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={30} color={colors.mutedForeground} />
                <Text style={styles.noResultsTitle}>No matching outfits</Text>
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
          sortOrder={sortOrder}
          resultCount={filteredEntries.length}
          onToggleCategory={(value) => setCategories((current) => toggleValue(current, value))}
          onToggleCity={(value) => setCities((current) => toggleValue(current, value))}
          onToggleBrand={(value) => setBrands((current) => toggleValue(current, value))}
          onSortChange={setSortOrder}
          onClear={clearFilters}
          onClose={() => setFiltersVisible(false)}
        />
      )}
      {selectedEntry && (
        <ShopWishlistDetailSheet
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onRemove={() => removeItem(selectedEntry.id)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.foreground, letterSpacing: -0.3 },
  headerSub: { marginTop: 2, fontSize: typography.size.sm, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  shoppingModeButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  galleryShortcut: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  shoppingModeButtonText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  browseControls: { padding: spacing.md, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchBox: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, fontSize: typography.size.sm, color: colors.foreground },
  filterButton: {
    width: 44,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  filterButtonActive: { width: 54, gap: 3, borderColor: colors.primary, backgroundColor: colors.primary },
  filterCount: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.primaryForeground, fontVariant: ['tabular-nums'] },
  scopeGroup: { flexDirection: 'row', padding: 3, borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  scopeButton: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  scopeButtonActive: { backgroundColor: colors.surfaceElevated },
  scopeText: { fontSize: typography.size.sm, color: colors.mutedForeground },
  scopeTextActive: { fontWeight: typography.weight.semibold, color: colors.foreground },
  listContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxxl },
  listContentEmpty: { flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.foreground },
  emptySubtitle: { maxWidth: 280, fontSize: typography.size.sm, lineHeight: 21, color: colors.mutedForeground, textAlign: 'center' },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary },
  emptyButtonText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  noResults: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  noResultsTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  noResultsText: { fontSize: typography.size.sm, color: colors.mutedForeground, textAlign: 'center' },
  clearButton: { marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.secondary },
  clearButtonText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
});
