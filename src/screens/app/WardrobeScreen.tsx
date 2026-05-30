import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  useItems,
  useArchivedItems,
  useArchiveItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useMarkItemWorn,
} from '../../hooks/useItems';
import { WardrobeItemCard } from '../../components/wardrobe/WardrobeItemCard';
import { WardrobeListRow } from '../../components/wardrobe/WardrobeListRow';
import { ScanItemSheet } from '../../components/wardrobe/ScanItemSheet';
import { BatchScanSheet } from '../../components/wardrobe/BatchScanSheet';
import { QuickCaptureSheet } from '../../components/wardrobe/QuickCaptureSheet';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS, CATEGORY_ORDER, type Item, type ItemCategory } from '../../types/item';
import type { WardrobeListScreenProps } from '../../navigation/types';

// ─── Sort ────────────────────────────────────────────────────────────────────

type SortKey =
  | 'newest'
  | 'oldest'
  | 'recently_worn'
  | 'most_worn'
  | 'least_worn'
  | 'name_asc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'recently_worn', label: 'Recently worn' },
  { key: 'most_worn', label: 'Most worn' },
  { key: 'least_worn', label: 'Least worn' },
  { key: 'name_asc', label: 'Name A → Z' },
];

function sortItems(items: Item[], key: SortKey): Item[] {
  const arr = [...items];
  switch (key) {
    case 'newest':
      return arr.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case 'oldest':
      return arr.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    case 'recently_worn':
      return arr.sort((a, b) => {
        if (!a.lastWornAt && !b.lastWornAt) return 0;
        if (!a.lastWornAt) return 1;
        if (!b.lastWornAt) return -1;
        return new Date(b.lastWornAt).getTime() - new Date(a.lastWornAt).getTime();
      });
    case 'most_worn':
      return arr.sort((a, b) => b.wearCount - a.wearCount);
    case 'least_worn':
      return arr.sort((a, b) => a.wearCount - b.wearCount);
    case 'name_asc':
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return arr;
  }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function WardrobeScreen({ navigation }: WardrobeListScreenProps) {
  const insets = useSafeAreaInsets();
  const { data: items = [], isLoading, isError, refetch, isRefetching } = useItems();
  const { data: archivedItems = [], refetch: refetchArchived, isRefetching: isRefetchingArchived } = useArchivedItems();
  const archiveItems = useArchiveItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const markWorn = useMarkItemWorn();

  // ── View & sort ────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  // ── Filters ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // ── UI state ───────────────────────────────────────────────────────────
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);

  // ── Scan sheet ─────────────────────────────────────────────────────────
  const [scanSheetVisible, setScanSheetVisible] = useState(false);
  const [batchScanVisible, setBatchScanVisible] = useState(false);
  const [quickCaptureVisible, setQuickCaptureVisible] = useState(false);

  // ── Add item form ──────────────────────────────────────────────────────
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newCategory, setNewCategory] = useState<ItemCategory | null>(null);
  const [newColor, setNewColor] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);

  // ── Selection mode ─────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  // ── Derived data ───────────────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ItemCategory, number>> = {};
    for (const item of items) {
      if (item.category) counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const availableCategories = useMemo(
    () => CATEGORY_ORDER.filter((c) => (categoryCounts[c] ?? 0) > 0),
    [categoryCounts]
  );

  const allColors = useMemo(
    () => [...new Set(items.filter((i) => i.color).map((i) => i.color!))].sort(),
    [items]
  );
  const allBrands = useMemo(
    () => [...new Set(items.filter((i) => i.brand).map((i) => i.brand!))].sort(),
    [items]
  );
  const allSeasons = useMemo(
    () => [...new Set(items.filter((i) => i.season).map((i) => i.season!))].sort(),
    [items]
  );
  const allTags = useMemo(
    () => [...new Set(items.flatMap((i) => i.tags))].sort(),
    [items]
  );

  const activeFilterCount = useMemo(
    () =>
      (sortKey !== 'newest' ? 1 : 0) +
      selectedColors.length +
      selectedBrands.length +
      selectedSeasons.length +
      selectedTags.length,
    [sortKey, selectedColors, selectedBrands, selectedSeasons, selectedTags]
  );

  const filteredItems = useMemo(() => {
    let result = items;
    if (showFavoritesOnly) result = result.filter((i) => i.isFavorite);
    if (selectedCategory) result = result.filter((i) => i.category === selectedCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.brand?.toLowerCase().includes(q) ||
          i.color?.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (selectedColors.length)
      result = result.filter(
        (i) =>
          i.color &&
          selectedColors.some((c) => i.color!.toLowerCase().includes(c.toLowerCase()))
      );
    if (selectedBrands.length)
      result = result.filter((i) => i.brand && selectedBrands.includes(i.brand));
    if (selectedSeasons.length)
      result = result.filter((i) => i.season && selectedSeasons.includes(i.season));
    if (selectedTags.length)
      result = result.filter((i) => selectedTags.some((t) => i.tags.includes(t)));
    return sortItems(result, sortKey);
  }, [
    items,
    showFavoritesOnly,
    selectedCategory,
    search,
    selectedColors,
    selectedBrands,
    selectedSeasons,
    selectedTags,
    sortKey,
  ]);

  const hasActiveFilters =
    showFavoritesOnly ||
    selectedCategory !== null ||
    search.trim().length > 0 ||
    activeFilterCount > 0;

  // ── Handlers ───────────────────────────────────────────────────────────

  const toggleSelectItem = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = () => {
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
            selectedIds.forEach((id) => deleteItem.mutate(id));
            exitSelectionMode();
          },
        },
      ]
    );
  };

  const handleBulkFavorite = () => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach((id) => {
      const item = items.find((i) => i.id === id);
      if (item) updateItem.mutate({ id, isFavorite: !item.isFavorite });
    });
    exitSelectionMode();
  };

  const handleBulkMarkWorn = () => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach((id) => markWorn.mutate(id));
    exitSelectionMode();
  };

  const handleBulkArchive = () => {
    if (selectedIds.size === 0) return;
    archiveItems.mutate({ ids: Array.from(selectedIds), archive: true }, { onSuccess: exitSelectionMode });
  };

  const handleBulkUnarchive = () => {
    if (selectedIds.size === 0) return;
    archiveItems.mutate({ ids: Array.from(selectedIds), archive: false }, { onSuccess: exitSelectionMode });
  };

  const handleFavoriteToggle = useCallback(
    (item: Item) => {
      updateItem.mutate({ id: item.id, isFavorite: !item.isFavorite });
    },
    [updateItem]
  );

  const resetAddForm = () => {
    setNewName('');
    setNewBrand('');
    setNewCategory(null);
    setNewColor('');
    setNewTags('');
    setNewImageUrl(null);
  };

  const handleAddItem = () => {
    if (!newName.trim()) return;
    const tags = newTags
      .split(/[,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    createItem.mutate(
      {
        name: newName.trim(),
        brand: newBrand.trim() || null,
        category: newCategory,
        color: newColor.trim() || null,
        tags,
        imageUrl: newImageUrl,
      },
      {
        onSuccess: () => {
          setAddItemOpen(false);
          resetAddForm();
        },
      }
    );
  };

  const handleScanCloset = () => {
    setFabOpen(false);
    setScanSheetVisible(true);
  };

  const clearAllFilters = () => {
    setSearch('');
    setSelectedCategory(null);
    setShowFavoritesOnly(false);
    setSelectedColors([]);
    setSelectedBrands([]);
    setSelectedSeasons([]);
    setSelectedTags([]);
    setSortKey('newest');
  };

  const clearSheetFilters = () => {
    setSelectedColors([]);
    setSelectedBrands([]);
    setSelectedSeasons([]);
    setSelectedTags([]);
    setSortKey('newest');
  };

  // ── Loading / error ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
        <Text style={styles.errorText}>Couldn't load your wardrobe.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const FAB_BOTTOM = Math.max(insets.bottom, 8) + 12;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Wardrobe</Text>
          <Text style={styles.headerSubtitle}>
            {filteredItems.length === items.length
              ? `${items.length} ${items.length === 1 ? 'piece' : 'pieces'}`
              : `${filteredItems.length} of ${items.length} pieces`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
              size={20}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setFilterSheetOpen(true)}>
            <Ionicons
              name="options-outline"
              size={20}
              color={activeFilterCount > 0 ? colors.primary : colors.foreground}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, brand, colour, tag…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Category pills ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillsScroll}
        contentContainerStyle={styles.pillsRow}
      >
        {/* Favourites toggle */}
        <TouchableOpacity
          style={[styles.pill, styles.pillIcon, showFavoritesOnly && styles.pillActivePrimary]}
          onPress={() => setShowFavoritesOnly((v) => !v)}
        >
          <Ionicons
            name={showFavoritesOnly ? 'heart' : 'heart-outline'}
            size={16}
            color={showFavoritesOnly ? colors.primaryForeground : colors.mutedForeground}
          />
        </TouchableOpacity>

        {/* All */}
        <TouchableOpacity
          style={[
            styles.pill,
            !selectedCategory && !showFavoritesOnly && styles.pillActiveNeutral,
          ]}
          onPress={() => {
            setSelectedCategory(null);
            setShowFavoritesOnly(false);
          }}
        >
          <Text
            style={[
              styles.pillText,
              !selectedCategory && !showFavoritesOnly && styles.pillTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {/* Per-category */}
        {availableCategories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.pill, active && styles.pillActiveNeutral]}
              onPress={() => setSelectedCategory(active ? null : cat)}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {CATEGORY_LABELS[cat]}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Reset — shown when any filter is active */}
        {hasActiveFilters && (
          <TouchableOpacity style={styles.pillReset} onPress={clearAllFilters}>
            <Ionicons name="close-outline" size={13} color={colors.error} />
            <Text style={styles.pillResetText}>Reset</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Item list / grid ── */}
      <FlatList
        key={viewMode}
        data={filteredItems}
        keyExtractor={(item) => String(item.id)}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        contentContainerStyle={[
          viewMode === 'grid' ? styles.gridContent : styles.listContent,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="shirt-outline" size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>
              {hasActiveFilters ? 'No items match' : 'Your wardrobe is empty'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Tap + to add your first piece.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          archivedItems.length > 0 ? (
            <View style={styles.archiveSection}>
              <TouchableOpacity
                style={styles.archiveToggle}
                onPress={() => setShowArchived((v) => !v)}
                activeOpacity={0.7}
              >
                <Ionicons name="archive-outline" size={16} color={colors.mutedForeground} />
                <Text style={styles.archiveToggleText}>
                  Archived ({archivedItems.length})
                </Text>
                <Ionicons
                  name={showArchived ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>

              {showArchived && (
                <View style={styles.archiveList}>
                  {(isRefetchingArchived ? [] : archivedItems).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.archiveRow,
                        selectionMode && selectedIds.has(item.id) && styles.archiveRowSelected,
                      ]}
                      onPress={() => {
                        if (selectionMode) {
                          toggleSelectItem(item.id);
                        } else {
                          navigation.navigate('ItemDetail', { itemId: item.id });
                        }
                      }}
                      onLongPress={() => {
                        setSelectionMode(true);
                        toggleSelectItem(item.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.archiveThumb}>
                        {item.imageUrl
                          ? <Image source={{ uri: item.imageUrl }} style={styles.archiveThumbImg} />
                          : <Ionicons name="shirt-outline" size={18} color={colors.mutedForeground} />
                        }
                      </View>
                      <View style={styles.archiveInfo}>
                        <Text style={styles.archiveName} numberOfLines={1}>{item.name}</Text>
                        {item.brand ? <Text style={styles.archiveMeta} numberOfLines={1}>{item.brand}</Text> : null}
                      </View>
                      {selectionMode && (
                        <View style={[styles.archiveCheck, selectedIds.has(item.id) && styles.archiveCheckSel]}>
                          {selectedIds.has(item.id) && <Text style={styles.archiveCheckMark}>✓</Text>}
                        </View>
                      )}
                      {!selectionMode && (
                        <TouchableOpacity
                          onPress={() => archiveItems.mutate({ ids: [item.id], archive: false })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.unarchiveBtn}>Restore</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) =>
          viewMode === 'list' ? (
            <WardrobeListRow
              item={item}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(item.id)}
              onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
              onLongPress={() => {
                setSelectionMode(true);
                toggleSelectItem(item.id);
              }}
              onToggleSelect={() => toggleSelectItem(item.id)}
              onFavorite={() => handleFavoriteToggle(item)}
            />
          ) : (
            <WardrobeItemCard
              item={item}
              onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
              onLongPress={() => {
                setSelectionMode(true);
                toggleSelectItem(item.id);
              }}
              onFavorite={() => handleFavoriteToggle(item)}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelectItem(item.id)}
            />
          )
        }
      />

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
                  setSelectedIds(new Set(filteredItems.map((i) => i.id)));
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
          {/* Determine which actions to show based on selected items */}
          {(() => {
            const archivedIdSet = new Set(archivedItems.map((i) => i.id));
            const anyArchived = [...selectedIds].some((id) => archivedIdSet.has(id));
            const anyActive = [...selectedIds].some((id) => !archivedIdSet.has(id));
            const dis = selectedIds.size === 0;
            return (
              <View style={styles.bulkActions}>
                {anyActive && (
                  <TouchableOpacity
                    style={[styles.bulkBtn, dis && styles.bulkBtnDisabled]}
                    onPress={handleBulkFavorite}
                    disabled={dis}
                  >
                    <Ionicons name="heart-outline" size={17} color={dis ? colors.border : colors.foreground} />
                    <Text style={[styles.bulkBtnText, dis && styles.bulkBtnTextDisabled]}>Favourite</Text>
                  </TouchableOpacity>
                )}
                {anyActive && (
                  <TouchableOpacity
                    style={[styles.bulkBtn, dis && styles.bulkBtnDisabled]}
                    onPress={handleBulkMarkWorn}
                    disabled={dis}
                  >
                    <Ionicons name="shirt-outline" size={17} color={dis ? colors.border : colors.foreground} />
                    <Text style={[styles.bulkBtnText, dis && styles.bulkBtnTextDisabled]}>Worn today</Text>
                  </TouchableOpacity>
                )}
                {anyActive && (
                  <TouchableOpacity
                    style={[styles.bulkBtn, dis && styles.bulkBtnDisabled]}
                    onPress={handleBulkArchive}
                    disabled={dis}
                  >
                    <Ionicons name="archive-outline" size={17} color={dis ? colors.border : colors.foreground} />
                    <Text style={[styles.bulkBtnText, dis && styles.bulkBtnTextDisabled]}>Archive</Text>
                  </TouchableOpacity>
                )}
                {anyArchived && (
                  <TouchableOpacity
                    style={[styles.bulkBtn, dis && styles.bulkBtnDisabled]}
                    onPress={handleBulkUnarchive}
                    disabled={dis}
                  >
                    <Ionicons name="arrow-up-outline" size={17} color={dis ? colors.border : colors.foreground} />
                    <Text style={[styles.bulkBtnText, dis && styles.bulkBtnTextDisabled]}>Restore</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.bulkBtn, styles.bulkBtnDelete, dis && styles.bulkBtnDisabled]}
                  onPress={handleBulkDelete}
                  disabled={dis}
                >
                  <Ionicons name="trash-outline" size={17} color={dis ? colors.border : colors.error} />
                  <Text style={[styles.bulkBtnText, styles.bulkBtnTextDelete, dis && styles.bulkBtnTextDisabled]}>Delete</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      )}

      {/* ── FAB backdrop (closes speed-dial) ── */}
      {fabOpen && !selectionMode && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setFabOpen(false)}
        />
      )}

      {/* ── FAB ── */}
      {!selectionMode && (
        <View style={[styles.fabContainer, { bottom: FAB_BOTTOM }]}>
          {/* Speed-dial options */}
          {fabOpen && (
            <View style={styles.fabSpeedDial}>
              <TouchableOpacity
                style={styles.fabOption}
                onPress={() => {
                  setFabOpen(false);
                  setQuickCaptureVisible(true);
                }}
              >
                <Ionicons name="add-outline" size={16} color={colors.foreground} />
                <Text style={styles.fabOptionText}>Quick Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fabOption, styles.fabOptionPrimary]}
                onPress={handleScanCloset}
              >
                <Ionicons name="camera-outline" size={16} color={colors.primaryForeground} />
                <Text style={[styles.fabOptionText, styles.fabOptionTextPrimary]}>
                  Scan Closet
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.fabOption}
                onPress={() => { setFabOpen(false); setBatchScanVisible(true); }}
              >
                <Ionicons name="images-outline" size={16} color={colors.foreground} />
                <Text style={styles.fabOptionText}>Batch Scan</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Main FAB button */}
          <TouchableOpacity
            style={[styles.fab, fabOpen && styles.fabOpen]}
            onPress={() => setFabOpen((v) => !v)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={fabOpen ? 'close-outline' : 'add-outline'}
              size={28}
              color={fabOpen ? colors.foreground : colors.primaryForeground}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Filter / Sort sheet
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={filterSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheetOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          {/* Backdrop — tap to close */}
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setFilterSheetOpen(false)}
          />
          {/* Sheet */}
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sort & Filter</Text>
              <TouchableOpacity onPress={() => setFilterSheetOpen(false)}>
                <Ionicons name="close-outline" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Sort */}
              <Text style={styles.sheetSection}>Sort by</Text>
              {SORT_OPTIONS.map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={styles.sheetRow}
                  onPress={() => setSortKey(key)}
                >
                  <View style={[styles.radio, sortKey === key && styles.radioActive]}>
                    {sortKey === key && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.sheetRowText}>{label}</Text>
                </TouchableOpacity>
              ))}

              {/* Colors */}
              {allColors.length > 0 && (
                <>
                  <Text style={styles.sheetSection}>Colour</Text>
                  <View style={styles.sheetChips}>
                    {allColors.map((color) => {
                      const active = selectedColors.includes(color);
                      return (
                        <TouchableOpacity
                          key={color}
                          style={[styles.sheetChip, active && styles.sheetChipActive]}
                          onPress={() =>
                            setSelectedColors((prev) =>
                              prev.includes(color)
                                ? prev.filter((c) => c !== color)
                                : [...prev, color]
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.sheetChipText,
                              active && styles.sheetChipTextActive,
                            ]}
                          >
                            {color}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Brands */}
              {allBrands.length > 0 && (
                <>
                  <Text style={styles.sheetSection}>Brand</Text>
                  {allBrands.map((brand) => {
                    const active = selectedBrands.includes(brand);
                    return (
                      <TouchableOpacity
                        key={brand}
                        style={styles.sheetRow}
                        onPress={() =>
                          setSelectedBrands((prev) =>
                            prev.includes(brand)
                              ? prev.filter((b) => b !== brand)
                              : [...prev, brand]
                          )
                        }
                      >
                        <View style={[styles.checkbox, active && styles.checkboxActive]}>
                          {active && (
                            <Ionicons name="checkmark" size={11} color={colors.primaryForeground} />
                          )}
                        </View>
                        <Text style={styles.sheetRowText}>{brand}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* Seasons */}
              {allSeasons.length > 0 && (
                <>
                  <Text style={styles.sheetSection}>Season</Text>
                  <View style={styles.sheetChips}>
                    {allSeasons.map((season) => {
                      const active = selectedSeasons.includes(season);
                      const label = season
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <TouchableOpacity
                          key={season}
                          style={[styles.sheetChip, active && styles.sheetChipActive]}
                          onPress={() =>
                            setSelectedSeasons((prev) =>
                              prev.includes(season)
                                ? prev.filter((s) => s !== season)
                                : [...prev, season]
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.sheetChipText,
                              active && styles.sheetChipTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Tags */}
              {allTags.length > 0 && (
                <>
                  <Text style={styles.sheetSection}>Tags</Text>
                  <View style={styles.sheetChips}>
                    {allTags.map((tag) => {
                      const active = selectedTags.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          style={[styles.sheetChip, active && styles.sheetChipActive]}
                          onPress={() =>
                            setSelectedTags((prev) =>
                              prev.includes(tag)
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag]
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.sheetChipText,
                              active && styles.sheetChipTextActive,
                            ]}
                          >
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>

            {/* Footer */}
            <View style={styles.sheetFooter}>
              {activeFilterCount > 0 && (
                <TouchableOpacity style={styles.sheetClearBtn} onPress={clearSheetFilters}>
                  <Text style={styles.sheetClearText}>Clear filters</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.sheetApplyBtn, activeFilterCount === 0 && styles.sheetApplyBtnFull]}
                onPress={() => setFilterSheetOpen(false)}
              >
                <Text style={styles.sheetApplyText}>
                  Show {filteredItems.length}{' '}
                  {filteredItems.length === 1 ? 'piece' : 'pieces'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          Add Item modal
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={addItemOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setAddItemOpen(false);
          resetAddForm();
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.addModal} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.addHeader}>
              <TouchableOpacity
                onPress={() => {
                  setAddItemOpen(false);
                  resetAddForm();
                }}
              >
                <Text style={styles.addCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.addTitle}>Add Item</Text>
              <TouchableOpacity
                onPress={handleAddItem}
                disabled={!newName.trim() || createItem.isPending}
              >
                <Text
                  style={[
                    styles.addSave,
                    (!newName.trim() || createItem.isPending) && styles.addSaveDisabled,
                  ]}
                >
                  {createItem.isPending ? 'Adding…' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.addScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Photo preview */}
              {newImageUrl && (
                <View style={styles.addImagePreview}>
                  <Image
                    source={{ uri: newImageUrl }}
                    style={styles.addImage}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* Name */}
              <Text style={styles.addLabel}>Name *</Text>
              <TextInput
                style={styles.addInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Navy Oxford Shirt"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                returnKeyType="next"
              />

              {/* Brand */}
              <Text style={styles.addLabel}>Brand</Text>
              <TextInput
                style={styles.addInput}
                value={newBrand}
                onChangeText={setNewBrand}
                placeholder="e.g. Uniqlo"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                returnKeyType="next"
              />

              {/* Category */}
              <Text style={styles.addLabel}>Category</Text>
              <View style={styles.addCatRow}>
                {CATEGORY_ORDER.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.addCatPill, newCategory === cat && styles.addCatPillActive]}
                    onPress={() => setNewCategory(newCategory === cat ? null : cat)}
                  >
                    <Text
                      style={[
                        styles.addCatPillText,
                        newCategory === cat && styles.addCatPillTextActive,
                      ]}
                    >
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Colour */}
              <Text style={styles.addLabel}>Colour</Text>
              <TextInput
                style={styles.addInput}
                value={newColor}
                onChangeText={setNewColor}
                placeholder="e.g. Navy Blue"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                returnKeyType="next"
              />

              {/* Tags */}
              <Text style={styles.addLabel}>Tags</Text>
              <TextInput
                style={styles.addInput}
                value={newTags}
                onChangeText={setNewTags}
                placeholder="e.g. office, smart casual"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleAddItem}
              />
              <Text style={styles.addHint}>Separate tags with commas</Text>

              <View style={{ height: 48 }} />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      <ScanItemSheet
        visible={scanSheetVisible}
        onClose={() => setScanSheetVisible(false)}
      />

      <BatchScanSheet
        visible={batchScanVisible}
        onClose={() => setBatchScanVisible(false)}
      />

      <QuickCaptureSheet
        visible={quickCaptureVisible}
        onClose={() => setQuickCaptureVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  headerBtn: {
    padding: spacing.sm,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
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

  // ── Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 42,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.foreground,
  },

  // ── Category pills
  pillsScroll: {
    flexGrow: 0,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
  },
  pillIcon: {
    width: 36,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  pillActiveNeutral: {
    backgroundColor: colors.foreground,
  },
  pillActivePrimary: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  pillCount: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  pillTextActive: {
    color: colors.primaryForeground,
  },
  pillReset: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: '#FEE2E2',
    gap: 4,
  },
  pillResetText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.error,
  },

  // ── FlatList
  gridRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  gridContent: {
    paddingBottom: 96,
  },
  listContent: {
    paddingBottom: 96,
  },

  // ── Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
    textAlign: 'center',
  },

  // ── Error
  errorText: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
  },
  retryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  retryText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.primary,
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

  // ── FAB
  fabContainer: {
    position: 'absolute',
    right: spacing.lg,
    alignItems: 'flex-end',
  },
  fabSpeedDial: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'flex-end',
  },
  fabOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabOptionPrimary: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  fabOptionText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  fabOptionTextPrimary: {
    color: colors.primaryForeground,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabOpen: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0.08,
  },

  // ── Filter sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  sheetSection: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    gap: spacing.md,
  },
  sheetRowText: {
    fontSize: typography.size.md,
    color: colors.foreground,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sheetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  sheetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
  },
  sheetChipActive: {
    backgroundColor: colors.primary,
  },
  sheetChipText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
  sheetChipTextActive: {
    color: colors.primaryForeground,
  },
  sheetFooter: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sheetClearBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
  },
  sheetClearText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  sheetApplyBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  sheetApplyBtnFull: {
    flex: 1,
  },
  sheetApplyText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },

  // ── Add item modal
  addModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  addImagePreview: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    overflow: 'hidden',
    height: 200,
    backgroundColor: colors.muted,
  },
  addImage: {
    width: '100%',
    height: '100%',
  },
  addHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  addCancel: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
  },
  addTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  addSave: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  addSaveDisabled: {
    color: colors.mutedForeground,
  },
  addScroll: {
    flex: 1,
  },
  addLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  addInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
  },
  addHint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  addCatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  addCatPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
  },
  addCatPillActive: {
    backgroundColor: colors.primary,
  },
  addCatPillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  addCatPillTextActive: {
    color: colors.primaryForeground,
  },

  // ── Archived section
  archiveSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.md,
  },
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  archiveToggleText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    flex: 1,
  },
  archiveList: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  archiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    opacity: 0.65,
  },
  archiveRowSelected: {
    backgroundColor: `${colors.primary}10`,
    opacity: 1,
  },
  archiveThumb: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  archiveThumbImg: { width: '100%', height: '100%' },
  archiveInfo: { flex: 1, gap: 2 },
  archiveName: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.foreground },
  archiveMeta: { fontSize: typography.size.xs, color: colors.mutedForeground },
  archiveCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  archiveCheckSel: { borderColor: colors.primary, backgroundColor: colors.primary },
  archiveCheckMark: { color: colors.white, fontSize: 12, fontWeight: typography.weight.bold },
  unarchiveBtn: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
});
