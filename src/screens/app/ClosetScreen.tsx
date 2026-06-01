import { useState, useMemo, useCallback } from 'react';
import {
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useItems } from '../../hooks/useItems';
import { useOutfits } from '../../hooks/useOutfits';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { CATEGORY_LABELS, CATEGORY_ORDER, type ItemCategory } from '../../types/item';
import { colors, shadows, spacing, typography, radii } from '../../theme';
import type { ClosetScreenProps } from '../../navigation/types';

// ── Constants ────────────────────────────────────────────────────────────────

const SIDE_PAD = spacing.lg;
const COL_GAP  = spacing.sm;

type Segment = 'pieces' | 'outfits';

// ── Screen ───────────────────────────────────────────────────────────────────

export function ClosetScreen({ navigation }: ClosetScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [segment, setSegment]   = useState<Segment>('pieces');
  const [search, setSearch]     = useState('');
  const [activeCategory, setActiveCategory] = useState<ItemCategory | null>(null);

  const { data: items   = [] } = useItems();
  const { data: outfits = [] } = useOutfits();

  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;

  // ── Pieces (items) derived data ────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ItemCategory, number>> = {};
    for (const item of items) {
      if (item.category) counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const availableCategories = useMemo(
    () => CATEGORY_ORDER.filter((c) => (categoryCounts[c] ?? 0) > 0),
    [categoryCounts],
  );

  const filteredItems = useMemo(() => {
    let result = items.filter((i) => !i.isArchived);
    if (activeCategory) result = result.filter((i) => i.category === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.brand ?? '').toLowerCase().includes(q) ||
          (i.category ? CATEGORY_LABELS[i.category].toLowerCase().includes(q) : false),
      );
    }
    return result;
  }, [items, activeCategory, search]);

  // ── Outfits derived data ──────────────────────────────────────────────────

  const filteredOutfits = useMemo(() => {
    if (!search.trim()) return outfits;
    const q = search.trim().toLowerCase();
    return outfits.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.event ?? '').toLowerCase().includes(q) ||
        (o.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [outfits, search]);

  // ── Segment switch — reset search & category filter ──────────────────────

  const handleSegmentChange = useCallback(
    (next: Segment) => {
      if (next === segment) return;
      setSearch('');
      setActiveCategory(null);
      setSegment(next);
    },
    [segment],
  );

  // ── Subtitle ──────────────────────────────────────────────────────────────

  const subtitle =
    segment === 'pieces'
      ? `${filteredItems.length} ${filteredItems.length === 1 ? 'piece' : 'pieces'}`
      : `${filteredOutfits.length} ${filteredOutfits.length === 1 ? 'outfit' : 'outfits'}`;

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderItemCard = useCallback(
    ({ item }: { item: (typeof items)[number] }) => {
      const uri = resolveImageUri(item.imageUrl);
      return (
        <TouchableOpacity
          style={[styles.itemCard, { width: cardWidth }]}
          onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
          activeOpacity={0.85}
        >
          <View style={[styles.itemThumb, { height: cardWidth }]}>
            {uri ? (
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.itemThumbPlaceholder}>
                <Ionicons name="shirt-outline" size={28} color={colors.mutedForeground} />
              </View>
            )}
            {item.isFavorite && (
              <View style={styles.favBadge}>
                <Ionicons name="heart" size={10} color={colors.primary} />
              </View>
            )}
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            {item.category ? (
              <Text style={styles.itemCategory} numberOfLines={1}>
                {CATEGORY_LABELS[item.category]}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [cardWidth, navigation],
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

  // ── Empty states ──────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Closet</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {/* Segmented control */}
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

      {/* Search bar */}
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
      </View>

      {/* Category pills — Pieces only */}
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
          {availableCategories.map((cat) => (
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

      {/* Content */}
      {segment === 'pieces' ? (
        <FlatList
          key="pieces"
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItemCard}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          ListEmptyComponent={emptyPieces}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          key="outfits"
          data={filteredOutfits}
          keyExtractor={(outfit) => String(outfit.id)}
          renderItem={renderOutfitCard}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          ListEmptyComponent={emptyOutfits}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: SIDE_PAD,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
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

  // Segmented control
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

  // Search
  searchRow: {
    marginBottom: spacing.sm,
  },
  searchWrap: {
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

  // Category pills
  pillScroll: { marginHorizontal: -SIDE_PAD, marginBottom: spacing.md },
  pillContent: { paddingHorizontal: SIDE_PAD, gap: spacing.sm },
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

  // List layout
  listContent: {
    paddingHorizontal: SIDE_PAD,
    paddingBottom: spacing.xxxl * 2,
  },
  columnWrapper: {
    gap: COL_GAP,
    marginBottom: COL_GAP,
  },

  // Item cards
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

  // Outfit cards
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

  // Empty state
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
