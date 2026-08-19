import { useMemo } from 'react';
import { Modal, ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useBoards } from '../../hooks/useBoards';
import { useItems } from '../../hooks/useItems';
import { useOutfits } from '../../hooks/useOutfits';
import { filterVisibleBoards } from '../../lib/legacyBoards';
import { getBoardSavedCount } from '../../lib/boardPresentation';
import { BoardCover } from '../boards/BoardCover';
import { colors, spacing, typography, radii } from '../../theme';

type Props = {
  visible: boolean;
  /** Currently linked board, so it can be shown as selected and unlinked. */
  selectedBoardId: number | null;
  onClose: () => void;
  onSelect: (boardId: number | null) => void;
};

/**
 * Pick the one board an event was planned from.
 *
 * Single-select, unlike BoardPickerModal — an event points at one board, where
 * saving an item is a toggle across many. A plain Modal because the event
 * detail sheet it opens from is itself a fullscreen RN Modal.
 */
export function EventBoardPickerModal({ visible, selectedBoardId, onClose, onSelect }: Props) {
  const { data: boards = [] } = useBoards();
  const { data: items = [] } = useItems();
  const { data: outfits = [] } = useOutfits();

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const outfitMap = useMemo(() => new Map(outfits.map((outfit) => [outfit.id, outfit])), [outfits]);
  const visibleBoards = useMemo(() => filterVisibleBoards(boards), [boards]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Plan from a board</Text>
          <TouchableOpacity style={styles.doneButton} onPress={onClose} accessibilityRole="button">
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {visibleBoards.map((board) => {
            const selected = board.id === selectedBoardId;
            return (
              <TouchableOpacity
                key={board.id}
                style={styles.row}
                onPress={() => onSelect(selected ? null : board.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <BoardCover board={board} itemMap={itemMap} outfitMap={outfitMap} size={44} compact />
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>{board.name}</Text>
                  <Text style={styles.count}>{getBoardSavedCount(board)} saved</Text>
                </View>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={selected ? colors.primary : colors.border}
                />
              </TouchableOpacity>
            );
          })}

          {visibleBoards.length === 0 && (
            <Text style={styles.empty}>No boards yet — create one in your closet first.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  title: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.bold, color: colors.foreground },
  doneButton: { minWidth: 52, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  doneText: { color: colors.primary, fontSize: typography.text.body.fontSize, fontWeight: typography.weight.semibold },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  info: { flex: 1 },
  name: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.medium, color: colors.foreground },
  count: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  empty: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground, paddingVertical: spacing.lg },
});
