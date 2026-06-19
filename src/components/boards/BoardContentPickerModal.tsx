import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useItems } from '../../hooks/useItems';
import { useOutfits } from '../../hooks/useOutfits';
import { useWishlist } from '../../hooks/useWishlist';
import { useUpdateBoard } from '../../hooks/useBoards';
import { resolveImageUri } from '../../lib/resolveImageUri';
import type { WishlistEntry } from '../../lib/wishlist';
import {
  getWishlistAccessibilityLabel,
  getWishlistContext,
  getWishlistItemSummary,
  getWishlistMeta,
  getWishlistSearchText,
  getWishlistTitle,
} from '../../lib/wishlistPresentation';
import { WishlistOutfitPreview } from '../outfits/WishlistOutfitPreview';
import { colors, radii, spacing, typography } from '../../theme';
import type { Board } from '../../types/board';

type Tab = 'pieces' | 'outfits' | 'wishlist' | 'finds';
type Row = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  imageUrl?: string | null;
  searchText?: string;
  accessibilityLabel?: string;
  wishlistEntry?: WishlistEntry;
};

type Props = {
  board: Board | null;
  visible: boolean;
  onClose: () => void;
  onAddStoreFind: () => void;
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'pieces', label: 'Pieces' },
  { key: 'outfits', label: 'Outfits' },
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'finds', label: 'Finds' },
];

export function BoardContentPickerModal({ board, visible, onClose, onAddStoreFind }: Props) {
  const { data: items = [], isLoading: itemsLoading } = useItems();
  const { data: outfits = [] } = useOutfits();
  const { data: wishlist = [], isLoading: wishlistLoading } = useWishlist();
  const updateBoard = useUpdateBoard();
  const [tab, setTab] = useState<Tab>('pieces');
  const [query, setQuery] = useState('');
  const [pieceIds, setPieceIds] = useState<Set<number>>(new Set());
  const [outfitIds, setOutfitIds] = useState<Set<number>>(new Set());
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible || !board) return;
    setTab('pieces');
    setQuery('');
    setPieceIds(new Set(board.itemIds));
    setOutfitIds(new Set(board.outfitIds));
    setWishlistIds(new Set(board.wishlistIds));
  }, [board, visible]);

  const rows = useMemo<Row[]>(() => {
    const normalized = query.trim().toLowerCase();
    const source: Row[] = tab === 'pieces'
      ? items.map((item) => ({
          id: String(item.id),
          title: item.name,
          subtitle: [item.brand, item.category].filter(Boolean).join(' · '),
          imageUrl: item.imageUrl,
        }))
      : tab === 'outfits'
      ? outfits.map((outfit) => ({
          id: String(outfit.id),
          title: outfit.name,
          subtitle: outfit.tags?.slice(0, 2).join(' · '),
          imageUrl: outfit.aiGeneratedImageUrl,
        }))
      : tab === 'wishlist'
      ? wishlist.map((entry) => ({
          id: entry.id,
          title: getWishlistTitle(entry),
          subtitle: getWishlistItemSummary(entry),
          meta: [getWishlistContext(entry), getWishlistMeta(entry)].filter(Boolean).join(' · '),
          searchText: getWishlistSearchText(entry),
          accessibilityLabel: getWishlistAccessibilityLabel(entry),
          wishlistEntry: entry,
        }))
      : [];
    return normalized
      ? source.filter((row) => `${row.title} ${row.subtitle ?? ''} ${row.meta ?? ''} ${row.searchText ?? ''}`.toLowerCase().includes(normalized))
      : source;
  }, [items, outfits, query, tab, wishlist]);

  const selectedCount = pieceIds.size + outfitIds.size + wishlistIds.size;
  const isSelected = (id: string) => tab === 'pieces'
    ? pieceIds.has(Number(id))
    : tab === 'outfits'
    ? outfitIds.has(Number(id))
    : wishlistIds.has(id);

  const toggle = (id: string) => {
    const update = <T,>(set: Set<T>, value: T) => {
      const next = new Set(set);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    };
    if (tab === 'pieces') setPieceIds((current) => update(current, Number(id)));
    else if (tab === 'outfits') setOutfitIds((current) => update(current, Number(id)));
    else setWishlistIds((current) => update(current, id));
  };

  const save = () => {
    if (!board) return;
    updateBoard.mutate(
      { id: board.id, itemIds: [...pieceIds], outfitIds: [...outfitIds], wishlistIds: [...wishlistIds] },
      { onSuccess: onClose },
    );
  };

  const loading = itemsLoading || wishlistLoading;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerSide} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Add to board</Text>
            <Text style={styles.subtitle}>{selectedCount} selected</Text>
          </View>
          <TouchableOpacity onPress={save} disabled={updateBoard.isPending} style={[styles.headerSide, styles.headerRight]} accessibilityRole="button">
            {updateBoard.isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.saveText}>Done</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.tab, tab === option.key && styles.tabActive]}
              onPress={() => { setTab(option.key); setQuery(''); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === option.key }}
            >
              <Text style={[styles.tabText, tab === option.key && styles.tabTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'finds' ? (
          <View style={styles.findsState}>
            <View style={styles.findsIcon}><Ionicons name="camera-outline" size={34} color={colors.primary} /></View>
            <Text style={styles.findsTitle}>Save something you spot</Text>
            <Text style={styles.findsCopy}>Photograph an in-store find and keep the details with this board.</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => { onClose(); setTimeout(onAddStoreFind, 300); }}
              accessibilityRole="button"
            >
              <Ionicons name="camera-outline" size={18} color={colors.primaryForeground} />
              <Text style={styles.primaryButtonText}>Snap a store find</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${TABS.find((option) => option.key === tab)?.label.toLowerCase()}`}
                placeholderTextColor={colors.mutedForeground}
                style={styles.searchInput}
                returnKeyType="search"
                accessibilityLabel={`Search ${tab}`}
              />
              {!!query && <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}><Ionicons name="close-circle" size={18} color={colors.mutedForeground} /></TouchableOpacity>}
            </View>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={styles.loading} />
            ) : (
              <FlatList
                data={rows}
                keyExtractor={(row) => row.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={styles.empty}>Nothing matches this search.</Text>}
                renderItem={({ item }) => {
                  const selected = isSelected(item.id);
                  const uri = resolveImageUri(item.imageUrl ?? undefined);
                  return (
                    <TouchableOpacity
                      style={[styles.row, selected && styles.rowSelected]}
                      onPress={() => toggle(item.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={item.accessibilityLabel ?? item.title}
                      accessibilityHint={selected ? 'Double tap to remove from this board' : 'Double tap to add to this board'}
                    >
                      <View style={styles.thumb}>
                        {item.wishlistEntry ? (
                          <WishlistOutfitPreview entry={item.wishlistEntry} style={StyleSheet.absoluteFill} />
                        ) : uri ? (
                          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
                        ) : (
                          <Ionicons name={tab === 'outfits' ? 'images-outline' : 'shirt-outline'} size={22} color={colors.mutedForeground} />
                        )}
                      </View>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowTitle} numberOfLines={item.wishlistEntry ? 2 : 1}>{item.title}</Text>
                        {!!item.subtitle && <Text style={styles.rowSubtitle} numberOfLines={1}>{item.subtitle}</Text>}
                        {!!item.meta && <Text style={styles.rowMeta} numberOfLines={1}>{item.meta}</Text>}
                      </View>
                      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={25} color={selected ? colors.primary : colors.border} />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 64, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerSide: { width: 70, minHeight: 44, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { color: colors.foreground, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  subtitle: { color: colors.mutedForeground, fontSize: typography.size.xs, fontVariant: ['tabular-nums'] },
  cancelText: { color: colors.mutedForeground, fontSize: typography.size.md },
  saveText: { color: colors.primary, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  tabs: { flexDirection: 'row', margin: spacing.lg, padding: 3, borderRadius: radii.full, backgroundColor: colors.secondary },
  tab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full },
  tabActive: { backgroundColor: colors.surfaceElevated },
  tabText: { color: colors.mutedForeground, fontSize: typography.size.xs, fontWeight: typography.weight.medium },
  tabTextActive: { color: colors.foreground, fontWeight: typography.weight.semibold },
  searchWrap: { minHeight: 46, marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.full, backgroundColor: colors.secondary },
  searchInput: { flex: 1, minHeight: 46, color: colors.foreground, fontSize: typography.size.md },
  clearButton: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  loading: { paddingTop: spacing.xxxl },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.md },
  rowSelected: { backgroundColor: `${colors.primary}0D` },
  thumb: { width: 58, height: 58, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  rowSubtitle: { color: colors.mutedForeground, fontSize: typography.size.xs },
  rowMeta: { color: colors.mutedForeground, fontSize: typography.size.xs, fontVariant: ['tabular-nums'] },
  empty: { paddingTop: spacing.xxxl, textAlign: 'center', color: colors.mutedForeground, fontSize: typography.size.sm },
  findsState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  findsIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  findsTitle: { color: colors.foreground, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  findsCopy: { color: colors.mutedForeground, fontSize: typography.size.sm, textAlign: 'center', maxWidth: 300 },
  primaryButton: { marginTop: spacing.sm, minHeight: 48, borderRadius: radii.full, paddingHorizontal: spacing.xl, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
});
