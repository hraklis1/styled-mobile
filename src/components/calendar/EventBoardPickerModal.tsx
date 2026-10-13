import { useEffect, useMemo, useState, useRef } from 'react';
import { Modal, ScrollView, View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
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
  onSelect: (boardId: number | null) => Promise<void>;
};

/**
 * Pick the one board an event was planned from.
 *
 * Single-select, unlike BoardPickerModal — an event points at one board, where
 * saving an item is a toggle across many. A plain Modal because the event
 * detail sheet it opens from is itself a fullscreen RN Modal.
 */
export function EventBoardPickerModal({ visible, selectedBoardId, onClose, onSelect }: Props) {
  const savingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<number | null>(selectedBoardId);
  useEffect(() => { if (visible) { setQuery(''); setSelection(selectedBoardId); setSaveError(null); } }, [visible, selectedBoardId]);
  const { data: boards = [] } = useBoards();
  const { data: items = [] } = useItems();
  const { data: outfits = [] } = useOutfits();

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const outfitMap = useMemo(() => new Map(outfits.map((outfit) => [outfit.id, outfit])), [outfits]);
  const visibleBoards = useMemo(() => filterVisibleBoards(boards), [boards]);

  const requestClose = () => { if (!savingRef.current) onClose(); };
  const confirm = async () => {
    if (savingRef.current || selection === selectedBoardId) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSelect(selection);
      onClose();
    } catch {
      setSaveError('Couldn’t save this board. Your selection is still here; try again.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={requestClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose a board</Text>
          <TouchableOpacity style={styles.doneButton} onPress={requestClose} disabled={isSaving} accessibilityRole="button" accessibilityState={{ disabled: isSaving }}>
            <Text style={styles.doneText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>Use a board as inspiration for this event. Styled can use it when planning your look.</Text>
        <TextInput editable={!isSaving} accessibilityLabel="Search boards" placeholder="Search boards…" value={query} onChangeText={setQuery} style={styles.search} placeholderTextColor={colors.mutedForeground} />
        {saveError ? <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text> : null}
        <ScrollView contentContainerStyle={styles.list}>
          {visibleBoards.filter((board) => board.name.toLowerCase().includes(query.trim().toLowerCase())).map((board) => {
            const selected = board.id === selection;
            return (
              <TouchableOpacity
                key={board.id}
                style={styles.row}
                disabled={isSaving}
                onPress={() => setSelection(selected ? null : board.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: isSaving }}
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
            <Text style={styles.empty}>No boards yet. Create one in Closet, or go back to choose saved outfits or individual items.</Text>
          )}
          {visibleBoards.length > 0 && !visibleBoards.some((board) => board.name.toLowerCase().includes(query.trim().toLowerCase())) ? <Text style={styles.empty}>No boards match your search. Try another name.</Text> : null}
        </ScrollView>
        <TouchableOpacity style={styles.confirm} disabled={isSaving || selection === selectedBoardId} accessibilityState={{ disabled: isSaving || selection === selectedBoardId, busy: isSaving }} accessibilityRole="button" onPress={() => { void confirm(); }}>
          {isSaving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.doneText}>{selection === null && selectedBoardId !== null ? 'Remove board' : 'Use board'}</Text>}
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  error: { ...typography.text.bodySmall, color: colors.destructive, paddingHorizontal: spacing.lg },
  hint: { ...typography.text.bodySmall, color: colors.mutedForeground, padding: spacing.lg },
  search: { minHeight: 44, marginHorizontal: spacing.lg, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.muted, color: colors.foreground },
  confirm: { minHeight: 48, margin: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surfaceSelected, alignItems: 'center', justifyContent: 'center' },
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
  list: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  info: { flex: 1 },
  name: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.medium, color: colors.foreground },
  count: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  empty: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground, paddingVertical: spacing.lg },
});
