import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateBoard } from '../../hooks/useBoards';
import { useWishlist } from '../../hooks/useWishlist';
import { colors, radii, spacing, typography } from '../../theme';
import type { Board } from '../../types/board';

export function BoardWishlistPickerModal({
  board,
  visible,
  onClose,
}: {
  board: Board | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { data: wishlist = [], isLoading } = useWishlist();
  const updateBoard = useUpdateBoard();
  
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible && board) {
      setSelected(new Set(board.wishlistIds ?? []));
    }
  }, [board, visible]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (!board) return;
    updateBoard.mutate(
      { id: board.id, wishlistIds: Array.from(selected) },
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
          <Text style={s.headerTitle}>Add from Shop</Text>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={updateBoard.isPending}
            style={[s.headerSide, s.headerSideRight]}
          >
            {updateBoard.isPending
              ? <ActivityIndicator color={colors.primary} />
              : <Text style={s.saveText}>Save{selected.size > 0 ? ` (${selected.size})` : ''}</Text>
            }
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={s.loading} />
        ) : wishlist.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No saved items yet.</Text>
            <Text style={s.emptyText}>
              Chat with your Stylist to get outfit recommendations and save them here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={wishlist}
            keyExtractor={(entry) => entry.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.listContent}
            renderItem={({ item }) => {
              const o = item.outfit;
              const isSelected = selected.has(item.id);
              return (
                <TouchableOpacity
                  style={[s.itemRow, isSelected && s.itemRowSelected]}
                  onPress={() => toggle(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={s.itemThumb}>
                    <Ionicons name="bag-handle-outline" size={24} color="#956D51" />
                  </View>
                  <View style={s.itemInfo}>
                    <Text style={s.itemName} numberOfLines={1}>
                      {o?.city ? `Shop · ${o.city}` : 'Shop outfit'}
                    </Text>
                    {!!o?.totalBudget && (
                      <Text style={s.itemMeta} numberOfLines={1}>{o.totalBudget}</Text>
                    )}
                  </View>
                  <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
                    {isSelected && <Text style={s.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
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
  loading: { marginTop: spacing.xxxl },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemRowSelected: { backgroundColor: `${colors.primary}08` },
  itemThumb: {
    width: 48, height: 48, borderRadius: radii.md,
    backgroundColor: 'rgba(149, 109, 81, 0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
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
