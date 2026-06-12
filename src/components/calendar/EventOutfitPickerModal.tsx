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
import { OutfitCard } from '../outfits/OutfitCard';
import { useAssignEventItems } from '../../hooks/useEvents';
import { useOutfits } from '../../hooks/useOutfits';
import { colors, radii, spacing, typography } from '../../theme';
import type { Event } from '../../types/event';

export function EventOutfitPickerModal({
  event,
  visible,
  onClose,
}: {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { data: outfits = [], isLoading } = useOutfits();
  const assignItems = useAssignEventItems();
  const [query, setQuery] = useState('');
  const [selectedOutfitId, setSelectedOutfitId] = useState<number | null>(null);

  const availableOutfits = useMemo(
    () => outfits.filter((outfit) => outfit.itemIds.length > 0),
    [outfits],
  );

  useEffect(() => {
    if (!visible) return;

    const assignedIds = [...(event?.itemIds ?? [])].sort((a, b) => a - b);
    const matchingOutfit = availableOutfits.find((outfit) => {
      const outfitIds = outfit.itemIds.map((entry) => entry.id).sort((a, b) => a - b);
      return outfitIds.length === assignedIds.length
        && outfitIds.every((id, index) => id === assignedIds[index]);
    });

    setQuery('');
    setSelectedOutfitId(matchingOutfit?.id ?? null);
  }, [availableOutfits, event, visible]);

  const filteredOutfits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return availableOutfits;

    return availableOutfits.filter((outfit) =>
      [outfit.name, outfit.event, ...outfit.tags]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [availableOutfits, query]);

  const handleConfirm = () => {
    if (!event || selectedOutfitId === null) return;
    const outfit = availableOutfits.find((candidate) => candidate.id === selectedOutfitId);
    if (!outfit) return;

    assignItems.mutate(
      { id: event.id, itemIds: outfit.itemIds.map((entry) => entry.id) },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.headerSide}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Choose outfit</Text>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={selectedOutfitId === null || assignItems.isPending}
            style={[s.headerSide, s.headerSideRight]}
          >
            {assignItems.isPending
              ? <ActivityIndicator color={colors.primary} />
              : <Text style={[s.saveText, selectedOutfitId === null && s.saveTextDisabled]}>Assign</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search outfits…"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={s.loading} />
        ) : filteredOutfits.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>{query ? 'No outfits match your search.' : 'No saved outfits yet.'}</Text>
            <Text style={s.emptyText}>
              {query ? 'Try a different search.' : 'Create an outfit in your closet, then assign it to an event.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredOutfits}
            keyExtractor={(outfit) => String(outfit.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.listContent}
            renderItem={({ item }) => (
              <OutfitCard
                outfit={item}
                viewMode="list"
                selectionMode
                isSelected={selectedOutfitId === item.id}
                onToggleSelect={() => setSelectedOutfitId(item.id)}
              />
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSide: { minWidth: 70 },
  headerSideRight: { alignItems: 'flex-end' },
  headerTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  cancelText: { fontSize: typography.size.md, color: colors.mutedForeground },
  saveText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  saveTextDisabled: { color: colors.border },
  searchRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  searchInput: {
    height: 40,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
  loading: { marginTop: spacing.xxxl },
  listContent: { paddingBottom: spacing.xxxl },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
