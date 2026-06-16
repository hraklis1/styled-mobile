import { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, spacing, typography, radii } from '../../theme';
import { OCCASION_LABELS, SEASON_LABELS } from '../../types/item';
import type { Item, Occasion, Season } from '../../types/item';

// ─── Shared filter-row helper ───────────────────────────────────────────────────

type PickerFilterRowProps = {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  getLabel?: (value: string) => string;
};

export function PickerFilterRow({
  label,
  values,
  selected,
  onToggle,
  getLabel = (value) => value,
}: PickerFilterRowProps) {
  return (
    <View style={styles.pickerFilterGroup}>
      <Text style={styles.pickerFilterGroupLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pickerFilterChips}
      >
        {values.map((value) => {
          const active = selected.includes(value);
          return (
            <TouchableOpacity
              key={value}
              style={[styles.pickerFilterChip, active && styles.pickerFilterChipActive]}
              onPress={() => onToggle(value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerFilterChipText, active && styles.pickerFilterChipTextActive]}>
                {getLabel(value)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────────

type ItemPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Candidate pool — parent pre-filters by category for swaps. */
  items: Item[];
  /** Highlights the current item when swapping. */
  selectedId?: number;
  onSelect: (item: Item) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ItemPickerSheet({
  visible,
  onClose,
  title,
  items,
  selectedId,
  onSelect,
}: ItemPickerSheetProps) {
  const { width: screenWidth } = useWindowDimensions();

  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [colorFilters, setColorFilters] = useState<string[]>([]);
  const [seasonFilters, setSeasonFilters] = useState<string[]>([]);
  const [occasionFilters, setOccasionFilters] = useState<string[]>([]);

  const filterOptions = useMemo(() => ({
    colors: [...new Set(items
      .map((item) => item.colorNormalized ?? item.color)
      .filter((value): value is string => !!value))].sort(),
    seasons: [...new Set(items.flatMap((item) => item.seasons ?? []))].sort(),
    occasions: [...new Set(items.flatMap((item) => item.occasions ?? []))].sort(),
  }), [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (favoritesOnly && !item.isFavorite) return false;
        if (availableOnly && item.laundryStatus && item.laundryStatus !== 'clean') return false;
        const itemColor = item.colorNormalized ?? item.color;
        if (colorFilters.length > 0 && (!itemColor || !colorFilters.includes(itemColor))) return false;
        if (seasonFilters.length > 0 && !item.seasons?.some((value) => seasonFilters.includes(value))) return false;
        if (occasionFilters.length > 0 && !item.occasions?.some((value) => occasionFilters.includes(value))) return false;
        if (!query) return true;
        return [
          item.name,
          item.brand,
          item.color,
          item.colorNormalized,
          item.subcategory,
          item.style,
          item.material,
          item.pattern,
          ...(item.tags ?? []),
        ].some((value) => value?.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (a.id === selectedId) return -1;
        if (b.id === selectedId) return 1;
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        if (a.wearCount !== b.wearCount) return b.wearCount - a.wearCount;
        const lastWornDiff =
          (b.lastWornAt ? new Date(b.lastWornAt).getTime() : 0) -
          (a.lastWornAt ? new Date(a.lastWornAt).getTime() : 0);
        if (lastWornDiff !== 0) return lastWornDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [
    items,
    search,
    favoritesOnly,
    availableOnly,
    colorFilters,
    seasonFilters,
    occasionFilters,
    selectedId,
  ]);

  const activeFilterCount =
    Number(favoritesOnly) +
    Number(availableOnly) +
    colorFilters.length +
    seasonFilters.length +
    occasionFilters.length;

  const clearFilters = useCallback(() => {
    setFavoritesOnly(false);
    setAvailableOnly(false);
    setColorFilters([]);
    setSeasonFilters([]);
    setOccasionFilters([]);
  }, []);

  const resetControls = useCallback(() => {
    setSearch('');
    setFiltersOpen(false);
    clearFilters();
  }, [clearFilters]);

  const toggleFilter = useCallback((
    value: string,
    setValues: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setValues((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }, []);

  const handleClose = useCallback(() => {
    resetControls();
    onClose();
  }, [resetControls, onClose]);

  const handleSelect = useCallback((item: Item) => {
    onSelect(item);
    handleClose();
  }, [onSelect, handleClose]);

  // ── Grid sizing ─────────────────────────────────────────────────────────
  const PICKER_COLS = 3;
  const PICKER_GAP = spacing.sm;
  const PICKER_H_PAD = spacing.lg;
  const cardWidth =
    (screenWidth - PICKER_H_PAD * 2 - PICKER_GAP * (PICKER_COLS - 1)) / PICKER_COLS;
  const cardHeight = cardWidth * 1.3;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back-outline" size={20} color={colors.foreground} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>

          <View style={{ width: 70 }} />
        </View>

        <View style={styles.pickerSearchRow}>
          <View style={styles.pickerSearchBar}>
            <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
            <TextInput
              style={styles.pickerSearchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search items…"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <TouchableOpacity
            style={[
              styles.pickerFilterButton,
              activeFilterCount > 0 && styles.pickerFilterButtonActive,
            ]}
            onPress={() => setFiltersOpen((open) => !open)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Filter items"
            accessibilityState={{ expanded: filtersOpen }}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={activeFilterCount > 0 ? colors.primaryForeground : colors.foreground}
            />
            {activeFilterCount > 0 && (
              <View style={styles.pickerFilterBadge}>
                <Text style={styles.pickerFilterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {filtersOpen && (
          <View style={styles.pickerFilters}>
            <View style={styles.pickerFilterHeader}>
              <Text style={styles.pickerFilterTitle}>Filters</Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={clearFilters} activeOpacity={0.7}>
                  <Text style={styles.pickerFilterClear}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerFilterChips}
            >
              <TouchableOpacity
                style={[styles.pickerFilterChip, favoritesOnly && styles.pickerFilterChipActive]}
                onPress={() => setFavoritesOnly((value) => !value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={favoritesOnly ? 'heart' : 'heart-outline'}
                  size={13}
                  color={favoritesOnly ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text style={[styles.pickerFilterChipText, favoritesOnly && styles.pickerFilterChipTextActive]}>
                  Favorites
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerFilterChip, availableOnly && styles.pickerFilterChipActive]}
                onPress={() => setAvailableOnly((value) => !value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerFilterChipText, availableOnly && styles.pickerFilterChipTextActive]}>
                  Available
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {filterOptions.colors.length > 0 && (
              <PickerFilterRow
                label="Color"
                values={filterOptions.colors}
                selected={colorFilters}
                onToggle={(value) => toggleFilter(value, setColorFilters)}
              />
            )}
            {filterOptions.seasons.length > 0 && (
              <PickerFilterRow
                label="Season"
                values={filterOptions.seasons}
                selected={seasonFilters}
                onToggle={(value) => toggleFilter(value, setSeasonFilters)}
                getLabel={(value) => SEASON_LABELS[value as Season] ?? value}
              />
            )}
            {filterOptions.occasions.length > 0 && (
              <PickerFilterRow
                label="Occasion"
                values={filterOptions.occasions}
                selected={occasionFilters}
                onToggle={(value) => toggleFilter(value, setOccasionFilters)}
                getLabel={(value) => OCCASION_LABELS[value as Occasion] ?? value}
              />
            )}
          </View>
        )}

        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          numColumns={PICKER_COLS}
          columnWrapperStyle={styles.pickerRow}
          contentContainerStyle={[
            styles.pickerContent,
            filteredItems.length === 0 && styles.pickerEmptyContent,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.pickerEmpty}>
              <Ionicons
                name={search.trim() ? 'search-outline' : 'shirt-outline'}
                size={44}
                color={colors.border}
              />
              <Text style={styles.pickerEmptyTitle}>
                {search.trim() || activeFilterCount > 0 ? 'No matching items' : 'No items available'}
              </Text>
              <Text style={styles.pickerEmptySubtitle}>
                {search.trim() || activeFilterCount > 0
                  ? 'Try changing your search or filters.'
                  : 'Add items to your wardrobe first, then come back.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedId === item.id;
            const imgUri = resolveImageUri(item.imageUrl);
            return (
              <TouchableOpacity
                style={[styles.pickerCard, { width: cardWidth }]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.8}
              >
                <View style={[styles.pickerCardImage, { height: cardHeight }]}>
                  {imgUri ? (
                    <Image
                      source={{ uri: imgUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.pickerCardPlaceholder}>
                      <Ionicons name="shirt-outline" size={24} color={colors.border} />
                    </View>
                  )}
                  {isSelected && (
                    <>
                      <View style={styles.pickerOverlay} />
                      <View style={styles.pickerCheck}>
                        <Ionicons name="checkmark" size={14} color={colors.primaryForeground} />
                      </View>
                    </>
                  )}
                </View>
                <Text style={styles.pickerCardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.pickerCardMeta} numberOfLines={1}>
                  {[item.brand, item.colorNormalized ?? item.color].filter(Boolean).join(' · ') || ' '}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 52,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    width: 70,
  },
  backText: {
    fontSize: typography.size.md,
    color: colors.foreground,
  },

  // ── Picker
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
  pickerSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.foreground,
    paddingVertical: 0,
  },
  pickerFilterButton: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerFilterButtonActive: {
    backgroundColor: colors.primary,
  },
  pickerFilterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.foreground,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerFilterBadgeText: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.background,
    fontVariant: ['tabular-nums'],
  },
  pickerFilters: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  pickerFilterTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  pickerFilterClear: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
  pickerFilterGroup: {
    gap: spacing.xs,
  },
  pickerFilterGroupLabel: {
    paddingHorizontal: spacing.lg,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
  },
  pickerFilterChips: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  pickerFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pickerFilterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  pickerFilterChipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  pickerFilterChipTextActive: {
    color: colors.primaryForeground,
  },
  pickerRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pickerContent: {
    paddingTop: spacing.md,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  pickerEmptyContent: {
    flexGrow: 1,
  },
  pickerCard: {
    marginBottom: 0,
  },
  pickerCardImage: {
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  pickerCardPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(149, 109, 81, 0.2)',
  },
  pickerCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCardName: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    marginTop: spacing.xs,
    paddingHorizontal: 2,
  },
  pickerCardMeta: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
    paddingHorizontal: 2,
    textTransform: 'capitalize',
  },
  pickerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  pickerEmptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  pickerEmptySubtitle: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: typography.size.md * 1.5,
  },
});
