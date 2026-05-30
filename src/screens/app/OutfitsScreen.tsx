import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  useOutfits,
  useDeleteOutfit,
  useMarkOutfitWorn,
  useCreateOutfit,
} from '../../hooks/useOutfits';
import { OutfitCard, type OutfitViewMode } from '../../components/outfits/OutfitCard';
import { OutfitBuilderSheet } from '../../components/outfits/OutfitBuilderSheet';
import { colors, spacing, typography, radii } from '../../theme';
import type { Outfit } from '../../types/outfit';
import type { OutfitsListScreenProps } from '../../navigation/types';

// ─── Sort ────────────────────────────────────────────────────────────────────

const SORT_STORAGE_KEY = 'outfitsSortOrder';
const VIEW_MODE_KEY = 'outfitsViewMode';

const NEXT_VIEW_MODE: Record<OutfitViewMode, OutfitViewMode> = { grid: 'list', list: 'dense', dense: 'grid' };
const VIEW_MODE_ICON: Record<OutfitViewMode, 'grid-outline' | 'list-outline' | 'apps-outline'> = {
  grid: 'grid-outline',
  list: 'list-outline',
  dense: 'apps-outline',
};

type SortKey = 'newest' | 'oldest' | 'most_worn' | 'recently_worn' | 'name_asc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'most_worn', label: 'Most worn' },
  { key: 'recently_worn', label: 'Recently worn' },
  { key: 'name_asc', label: 'Name A → Z' },
];

function sortOutfits(outfits: Outfit[], key: SortKey): Outfit[] {
  const arr = [...outfits];
  switch (key) {
    case 'newest':
      return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'oldest':
      return arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case 'most_worn':
      return arr.sort((a, b) => b.wearCount - a.wearCount);
    case 'recently_worn':
      return arr.sort((a, b) => {
        if (!a.lastWornAt && !b.lastWornAt) return 0;
        if (!a.lastWornAt) return 1;
        if (!b.lastWornAt) return -1;
        return new Date(b.lastWornAt).getTime() - new Date(a.lastWornAt).getTime();
      });
    case 'name_asc':
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return arr;
  }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function OutfitsScreen({ navigation }: OutfitsListScreenProps) {
  const insets = useSafeAreaInsets();
  const { data: outfits = [], isLoading, isError, refetch, isRefetching } = useOutfits();
  const deleteOutfit = useDeleteOutfit();
  const markWorn = useMarkOutfitWorn();
  const createOutfit = useCreateOutfit();

  // ── Filters & sort ─────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(SORT_STORAGE_KEY).then((stored) => {
      if (stored) setSortKey(stored as SortKey);
    });
  }, []);

  const persistSortKey = useCallback((key: SortKey) => {
    setSortKey(key);
    AsyncStorage.setItem(SORT_STORAGE_KEY, key);
  }, []);

  const [viewMode, setViewMode] = useState<OutfitViewMode>('grid');

  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then((stored) => {
      if (stored) setViewMode(stored as OutfitViewMode);
    });
  }, []);

  const persistViewMode = useCallback((mode: OutfitViewMode) => {
    setViewMode(mode);
    AsyncStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  // ── UI state ───────────────────────────────────────────────────────────
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  // ── Create outfit form ─────────────────────────────────────────────────
  const [newName, setNewName] = useState('');
  const [newEvent, setNewEvent] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newTags, setNewTags] = useState('');

  // ── Selection mode ─────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Derived ────────────────────────────────────────────────────────────

  const allTags = useMemo(
    () => [...new Set(outfits.flatMap((o) => o.tags ?? []))].sort(),
    [outfits]
  );

  const filteredOutfits = useMemo(() => {
    let result = outfits;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.event?.toLowerCase().includes(q) ||
          o.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (selectedTags.length) {
      result = result.filter((o) => selectedTags.every((t) => o.tags?.includes(t)));
    }
    return sortOutfits(result, sortKey);
  }, [outfits, search, selectedTags, sortKey]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    selectedTags.length > 0 ||
    sortKey !== 'newest';

  const FAB_BOTTOM = Math.max(insets.bottom, 8) + 12;

  // ── Handlers ───────────────────────────────────────────────────────────

  const toggleSelectOutfit = useCallback((id: number) => {
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
      'Delete outfits',
      `Delete ${count} outfit${count !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedIds.forEach((id) => deleteOutfit.mutate(id));
            exitSelectionMode();
          },
        },
      ]
    );
  };

  const handleBulkMarkWorn = () => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach((id) => markWorn.mutate(id));
    exitSelectionMode();
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewEvent('');
    setNewNotes('');
    setNewTags('');
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const tags = newTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    createOutfit.mutate(
      {
        name: newName.trim(),
        event: newEvent.trim() || null,
        notes: newNotes.trim() || null,
        tags,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          resetCreateForm();
        },
      }
    );
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
        <Text style={styles.errorText}>Couldn't load your outfits.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Outfits</Text>
          <Text style={styles.headerSubtitle}>
            {filteredOutfits.length === outfits.length
              ? `${outfits.length} ${outfits.length === 1 ? 'look' : 'looks'}`
              : `${filteredOutfits.length} of ${outfits.length} looks`}
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => persistViewMode(NEXT_VIEW_MODE[viewMode])}
          >
            <Ionicons name={VIEW_MODE_ICON[viewMode]} size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setFilterSheetOpen(true)}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={sortKey !== 'newest' ? colors.primary : colors.foreground}
            />
            {sortKey !== 'newest' && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, event or tag…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch('')}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tag filter pills ── */}
      {allTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsScroll}
          contentContainerStyle={styles.pillsRow}
        >
          {allTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tagPill, active && styles.tagPillActive]}
                onPress={() =>
                  setSelectedTags((prev) =>
                    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                  )
                }
              >
                <Text style={[styles.tagPillText, active && styles.tagPillTextActive]}>
                  #{tag}
                </Text>
              </TouchableOpacity>
            );
          })}
          {(selectedTags.length > 0 || search.trim()) && (
            <TouchableOpacity
              style={styles.tagPillReset}
              onPress={() => {
                setSelectedTags([]);
                setSearch('');
                persistSortKey('newest');
              }}
            >
              <Ionicons name="close-outline" size={13} color={colors.error} />
              <Text style={styles.tagPillResetText}>Reset</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* ── Grid / List / Dense ── */}
      <FlatList
        key={viewMode}
        data={filteredOutfits}
        keyExtractor={(o) => String(o.id)}
        numColumns={viewMode === 'dense' ? 3 : viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode !== 'list' ? styles.gridRow : undefined}
        contentContainerStyle={viewMode === 'list' ? styles.listContent : styles.gridContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="layers-outline" size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>
              {hasActiveFilters ? 'No outfits match' : 'No outfits yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : 'Tap + to build your first look.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <OutfitCard
            outfit={item}
            viewMode={viewMode}
            onPress={() => navigation.navigate('OutfitDetail', { outfitId: item.id })}
            onLongPress={() => {
              setSelectionMode(true);
              toggleSelectOutfit(item.id);
            }}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(item.id)}
            onToggleSelect={() => toggleSelectOutfit(item.id)}
          />
        )}
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
                if (selectedIds.size === filteredOutfits.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(filteredOutfits.map((o) => o.id)));
                }
              }}
            >
              <Text style={styles.bulkSelectAll}>
                {selectedIds.size === 0
                  ? 'Select all'
                  : selectedIds.size === filteredOutfits.length
                    ? `${selectedIds.size} selected — Clear`
                    : `${selectedIds.size} selected — Select all`}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={[styles.bulkBtn, selectedIds.size === 0 && styles.bulkBtnDisabled]}
              onPress={handleBulkMarkWorn}
              disabled={selectedIds.size === 0}
            >
              <Ionicons
                name="shirt-outline"
                size={17}
                color={selectedIds.size === 0 ? colors.border : colors.foreground}
              />
              <Text style={[styles.bulkBtnText, selectedIds.size === 0 && styles.bulkBtnTextDisabled]}>
                Worn today
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnDelete, selectedIds.size === 0 && styles.bulkBtnDisabled]}
              onPress={handleBulkDelete}
              disabled={selectedIds.size === 0}
            >
              <Ionicons
                name="trash-outline"
                size={17}
                color={selectedIds.size === 0 ? colors.border : colors.error}
              />
              <Text style={[styles.bulkBtnText, styles.bulkBtnTextDelete, selectedIds.size === 0 && styles.bulkBtnTextDisabled]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── FAB backdrop ── */}
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
          {fabOpen && (
            <View style={styles.fabSpeedDial}>
              <TouchableOpacity
                style={styles.fabOption}
                onPress={() => {
                  setFabOpen(false);
                  setCreateOpen(true);
                }}
              >
                <Ionicons name="add-outline" size={16} color={colors.foreground} />
                <Text style={styles.fabOptionText}>Quick Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fabOption, styles.fabOptionPrimary]}
                onPress={() => {
                  setFabOpen(false);
                  setBuilderOpen(true);
                }}
              >
                <Ionicons name="layers-outline" size={16} color={colors.primaryForeground} />
                <Text style={[styles.fabOptionText, styles.fabOptionTextPrimary]}>
                  Outfit Builder
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
          Sort sheet
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={filterSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheetOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setFilterSheetOpen(false)}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sort</Text>
              <TouchableOpacity onPress={() => setFilterSheetOpen(false)}>
                <Ionicons name="close-outline" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            {SORT_OPTIONS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={styles.sheetRow}
                onPress={() => { persistSortKey(key); setFilterSheetOpen(false); }}
              >
                <View style={[styles.radio, sortKey === key && styles.radioActive]}>
                  {sortKey === key && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.sheetRowText}>{label}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ height: 8 }} />
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          Outfit Builder sheet
      ═══════════════════════════════════════════════════════════════════ */}
      <OutfitBuilderSheet
        visible={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onCreated={(outfit) => {
          setBuilderOpen(false);
          navigation.navigate('OutfitDetail', { outfitId: outfit.id });
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          Quick Create modal
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={createOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setCreateOpen(false); resetCreateForm(); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.createModal} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.createHeader}>
              <TouchableOpacity onPress={() => { setCreateOpen(false); resetCreateForm(); }}>
                <Text style={styles.createCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.createTitle}>New Outfit</Text>
              <TouchableOpacity
                onPress={handleCreate}
                disabled={!newName.trim() || createOutfit.isPending}
              >
                <Text style={[
                  styles.createSave,
                  (!newName.trim() || createOutfit.isPending) && styles.createSaveDisabled,
                ]}>
                  {createOutfit.isPending ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.createScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Name */}
              <Text style={styles.createLabel}>Name *</Text>
              <TextInput
                style={styles.createInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Sunday Brunch Look"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                returnKeyType="next"
                autoFocus
              />

              {/* Event / Occasion */}
              <Text style={styles.createLabel}>Occasion</Text>
              <TextInput
                style={styles.createInput}
                value={newEvent}
                onChangeText={setNewEvent}
                placeholder="e.g. casual, work, dinner"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                returnKeyType="next"
              />

              {/* Tags */}
              <Text style={styles.createLabel}>Tags</Text>
              <TextInput
                style={styles.createInput}
                value={newTags}
                onChangeText={setNewTags}
                placeholder="e.g. summer, linen, minimal"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <Text style={styles.createHint}>Separate tags with commas</Text>

              {/* Notes */}
              <Text style={styles.createLabel}>Notes</Text>
              <TextInput
                style={[styles.createInput, styles.createTextArea]}
                value={newNotes}
                onChangeText={setNewNotes}
                placeholder="Any notes about this look…"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="sentences"
                multiline
                numberOfLines={3}
                returnKeyType="done"
              />

              <View style={styles.createHintBox}>
                <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} />
                <Text style={styles.createHintBoxText}>
                  You can add specific wardrobe items to this outfit from the detail screen.
                </Text>
              </View>

              <View style={{ height: 48 }} />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
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
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerBtn: {
    padding: spacing.md,
    marginTop: 4,
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
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

  // ── Tag pills
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
  tagPill: {
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagPillActive: {
    backgroundColor: colors.foreground,
  },
  tagPillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  tagPillTextActive: {
    color: colors.primaryForeground,
  },
  tagPillReset: {
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagPillResetText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.error,
  },

  // ── Grid / List
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
  bulkBtnDisabled: { opacity: 0.4 },
  bulkBtnDelete: { backgroundColor: '#FEE2E2' },
  bulkBtnText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  bulkBtnTextDisabled: { color: colors.border },
  bulkBtnTextDelete: { color: colors.error },

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

  // ── Sort sheet
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
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
  radioActive: { borderColor: colors.primary },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  // ── Quick Create modal
  createModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  createCancel: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
  },
  createTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  createSave: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  createSaveDisabled: {
    color: colors.mutedForeground,
  },
  createScroll: {
    flex: 1,
  },
  createLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  createInput: {
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
  createTextArea: {
    height: 90,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  createHint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  createHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
  },
  createHintBoxText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    lineHeight: typography.size.xs * 1.5,
  },
});
