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
import {
  ActionButton,
  FilterControl,
  ScreenHeader,
  SegmentedControl,
} from '../../components/primitives/Editorial';
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
    <View style={styles.root}>
      <ScreenHeader
        eyebrow="Shop"
        title="Wishlist"
        subtitle={entries.length === 0 ? 'No saved outfits yet' : `${entries.length} saved outfit${entries.length === 1 ? '' : 's'}`}
        primaryAction={{
          label: 'Shopping Mode',
          icon: 'camera',
          onPress: () => navigation.navigate('ShoppingCamera'),
          accessibilityLabel: 'Open Shopping Mode camera',
        }}
        secondaryActions={[{
          label: 'The Shopping Edit',
          icon: 'images-outline',
          onPress: () => navigation.navigate('ShoppingGallery'),
          accessibilityLabel: 'Open The Shopping Edit',
        }]}
      />

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="bag-handle-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Ask your AI Stylist to shop for a new outfit. When it suggests one, tap “Save” to add it here.
          </Text>
          <ActionButton
            style={styles.emptyButton}
            label="Chat with your Stylist"
            icon="sparkles"
            onPress={() => openStylist({ initialQuery: 'Shop for a new outfit for me', source: 'shop' })}
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
              <FilterControl count={activeFilterCount} onPress={() => setFiltersVisible(true)} />
            </View>

            <SegmentedControl value={scope} variant="tabs" options={SCOPES} onChange={setScope} />
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
  browseControls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  searchInput: { flex: 1, paddingVertical: 0, fontSize: typography.size.sm, color: colors.foreground },
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
