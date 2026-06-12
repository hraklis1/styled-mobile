import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useItems } from '../../hooks/useItems';
import { useAssignEventItems } from '../../hooks/useEvents';
import { getSubcategories } from '../../lib/taxonomy';
import { CATEGORY_ORDER, CATEGORY_LABELS, type ItemCategory } from '../../types/item';
import { colors, spacing, typography, radii } from '../../theme';
import type { Event } from '../../types/event';

export function EventItemPickerModal({
  event,
  visible,
  onClose,
}: {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { data: allItems = [], isLoading } = useItems();
  const assignItems = useAssignEventItems();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<ItemCategory | null>(null);
  const [subcatFilter, setSubcatFilter] = useState<string | null>(null);

  useEffect(() => {
    if (visible && event) {
      setSelected(new Set(event.itemIds ?? []));
      setQuery('');
      setCatFilter(null);
      setSubcatFilter(null);
    }
  }, [visible, event]);

  const availableSubcategories = useMemo(() => {
    if (!catFilter) return [];
    const subs = new Set(
      allItems
        .filter((item) => item.category === catFilter && item.subcategory)
        .map((item) => item.subcategory!),
    );
    const taxonomyOrder = getSubcategories(catFilter);
    const result = taxonomyOrder.filter((subcategory) => subs.has(subcategory));
    for (const subcategory of subs) {
      if (!result.includes(subcategory)) result.push(subcategory);
    }
    return result;
  }, [allItems, catFilter]);

  const filtered = allItems.filter((item) => {
    const matchesCat = !catFilter || item.category === catFilter;
    const matchesSubcat = !subcatFilter || item.subcategory === subcatFilter;
    const matchesQ = !query.trim() || item.name.toLowerCase().includes(query.toLowerCase()) || (item.brand ?? '').toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesSubcat && matchesQ;
  });

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (!event) return;
    const itemIds = selected.size > 0 ? Array.from(selected) : null;
    assignItems.mutate({ id: event.id, itemIds }, { onSuccess: onClose });
  };

  const handleCategoryPress = (category: ItemCategory | null) => {
    setCatFilter((current) => current === category ? null : category);
    setSubcatFilter(null);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={s.root}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.headerSide}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>Assign Outfit</Text>
            <TouchableOpacity onPress={handleConfirm} disabled={assignItems.isPending} style={[s.headerSide, { alignItems: 'flex-end' }]}>
              {assignItems.isPending
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={s.saveText}>Save{selected.size > 0 ? ` (${selected.size})` : ''}</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={s.searchRow}>
            <TextInput
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search items…"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.catScroll}
            contentContainerStyle={s.catRow}
          >
            <TouchableOpacity
              style={[s.catChip, catFilter === null && s.catChipActive]}
              onPress={() => handleCategoryPress(null)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="All categories"
              accessibilityState={{ selected: catFilter === null }}
            >
              <Text style={[s.catLabel, catFilter === null && s.catLabelActive]}>All</Text>
            </TouchableOpacity>
            {CATEGORY_ORDER.map((category) => (
              <TouchableOpacity
                key={category}
                style={[s.catChip, catFilter === category && s.catChipActive]}
                onPress={() => handleCategoryPress(category)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={CATEGORY_LABELS[category]}
                accessibilityState={{ selected: catFilter === category }}
              >
                <Text style={[s.catLabel, catFilter === category && s.catLabelActive]}>
                  {CATEGORY_LABELS[category]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {availableSubcategories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.catScroll}
              contentContainerStyle={s.subcatRow}
            >
              {availableSubcategories.map((subcategory) => (
                <TouchableOpacity
                  key={subcategory}
                  style={[s.catChip, subcatFilter === subcategory && s.catChipActive]}
                  onPress={() => setSubcatFilter((current) => current === subcategory ? null : subcategory)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={subcategory}
                  accessibilityState={{ selected: subcatFilter === subcategory }}
                >
                  <Text style={[s.catLabel, subcatFilter === subcategory && s.catLabelActive]}>
                    {subcategory}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
          ) : filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>{query ? 'No items match your search.' : 'No items in this category.'}</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={s.listContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selected.has(item.id);
                return (
                  <TouchableOpacity
                    style={[s.itemRow, isSelected && s.itemRowSelected]}
                    onPress={() => toggle(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={s.itemThumb}>
                      {item.imageUrl
                        ? <Image source={{ uri: item.imageUrl }} style={s.itemThumbImg} />
                        : <View style={s.itemThumbFallback}><Text style={s.itemThumbInitials}>{item.name.slice(0, 2).toUpperCase()}</Text></View>
                      }
                    </View>
                    <View style={s.itemInfo}>
                      <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.itemMeta} numberOfLines={1}>
                        {[item.brand, item.category ? CATEGORY_LABELS[item.category] : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
                      {isSelected && <Text style={s.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {selected.size > 0 && (
            <TouchableOpacity style={s.clearBtn} onPress={() => setSelected(new Set())}>
              <Text style={s.clearBtnText}>Clear selection</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerSide: { minWidth: 70 },
  headerTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  cancelText: { fontSize: typography.size.md, color: colors.mutedForeground },
  saveText: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.primary, textAlign: 'right' },
  searchRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  searchInput: {
    height: 40, backgroundColor: colors.muted, borderRadius: radii.md,
    paddingHorizontal: spacing.md, fontSize: typography.size.sm, color: colors.foreground,
  },
  catScroll: { flexGrow: 0, flexShrink: 0 },
  catRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  subcatRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  catChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  catChipActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}15` },
  catLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  catLabelActive: { color: colors.primary },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemRowSelected: { backgroundColor: `${colors.primary}08` },
  itemThumb: {
    width: 48, height: 48, borderRadius: radii.md, overflow: 'hidden',
    backgroundColor: colors.muted, flexShrink: 0,
  },
  itemThumbImg: { width: '100%', height: '100%' },
  itemThumbFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  itemThumbInitials: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.mutedForeground },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.foreground },
  itemMeta: { fontSize: typography.size.xs, color: colors.mutedForeground },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { color: colors.white, fontSize: 13, fontWeight: typography.weight.bold },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  emptyText: { fontSize: typography.size.sm, color: colors.mutedForeground, textAlign: 'center' },
  clearBtn: {
    margin: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  clearBtnText: { fontSize: typography.size.sm, color: colors.mutedForeground },
});
