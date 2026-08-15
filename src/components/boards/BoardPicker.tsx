// Shared innards of the "save this to a board" UI.
//
// It has two hosts with different containers: SaveToBoardSheet (a
// BottomSheetModal, used from ordinary screens) and BoardPickerModal (a plain
// React Native Modal, used from inside the stylist). They differ only in which
// scroll view and text input they must use, so those come in as props and
// everything else — the board list, toggling, undo, create — lives here once.

import { useState, useMemo, type ComponentType } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  useBoards,
  useCreateBoard,
  useUpdateBoard,
  boardContains,
  type BoardEntryRef,
} from '../../hooks/useBoards';
import type { Board } from '../../types/board';
import { useItems } from '../../hooks/useItems';
import { useOutfits } from '../../hooks/useOutfits';
import { filterVisibleBoards } from '../../lib/legacyBoards';
import { getBoardSavedCount } from '../../lib/boardPresentation';
import { BoardCover } from './BoardCover';
import { colors, spacing, typography, radii } from '../../theme';

export function useBoardPicker(target: BoardEntryRef | BoardEntryRef[] | null, onClose: () => void) {
  const { data: boards = [] } = useBoards();
  const { data: items = [] } = useItems();
  const { data: outfits = [] } = useOutfits();
  const { mutate: updateBoard } = useUpdateBoard();
  const { mutate: createBoard } = useCreateBoard();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [lastChange, setLastChange] = useState<{ message: string; board: Board } | null>(null);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const outfitMap = useMemo(() => new Map(outfits.map((outfit) => [outfit.id, outfit])), [outfits]);
  const visibleBoards = useMemo(() => filterVisibleBoards(boards), [boards]);

  const targets: BoardEntryRef[] = target == null ? [] : Array.isArray(target) ? target : [target];

  function allTargetsIn(board: Board): boolean {
    return targets.length > 0 && targets.every((t) => boardContains(board, t));
  }

  function toggleBoard(board: Board) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const allIn = allTargetsIn(board);
    const itemIds = new Set<number>(board.itemIds);
    const outfitIds = new Set<number>(board.outfitIds);
    const wishlistIds = new Set<string>(board.wishlistIds);
    for (const t of targets) {
      if (t.type === 'item') allIn ? itemIds.delete(t.id) : itemIds.add(t.id);
      else if (t.type === 'outfit') allIn ? outfitIds.delete(t.id) : outfitIds.add(t.id);
      else allIn ? wishlistIds.delete(t.id) : wishlistIds.add(t.id);
    }
    updateBoard({
      id: board.id,
      itemIds: [...itemIds],
      outfitIds: [...outfitIds],
      wishlistIds: [...wishlistIds],
    });
    setLastChange({
      message: allIn ? `Removed from ${board.name}` : `Saved to ${board.name}`,
      board,
    });
  }

  function undoLastChange() {
    if (!lastChange) return;
    updateBoard({
      id: lastChange.board.id,
      itemIds: lastChange.board.itemIds,
      outfitIds: lastChange.board.outfitIds,
      wishlistIds: lastChange.board.wishlistIds,
    });
    setLastChange(null);
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    createBoard({
      name,
      itemIds: targets.filter((t) => t.type === 'item').map((t) => t.id as number),
      outfitIds: targets.filter((t) => t.type === 'outfit').map((t) => t.id as number),
      wishlistIds: targets.filter((t) => t.type === 'wishlist').map((t) => t.id as string),
    });
    setNewName('');
    setCreating(false);
    onClose();
  }

  return {
    visibleBoards, itemMap, outfitMap,
    creating, setCreating, newName, setNewName,
    lastChange, undoLastChange, allTargetsIn, toggleBoard, handleCreate,
    title: targets.length > 1 ? `Save ${targets.length} items to…` : 'Save to board',
  };
}

type BodyProps = {
  picker: ReturnType<typeof useBoardPicker>;
  onClose: () => void;
  /** BottomSheetScrollView inside a sheet; plain ScrollView inside a Modal. */
  ScrollComponent: ComponentType<any>;
  /** BottomSheetTextInput inside a sheet; plain TextInput inside a Modal. */
  InputComponent: ComponentType<any>;
};

export function BoardPickerBody({ picker, onClose, ScrollComponent, InputComponent }: BodyProps) {
  const {
    visibleBoards, itemMap, outfitMap, creating, setCreating, newName, setNewName,
    lastChange, undoLastChange, allTargetsIn, toggleBoard, handleCreate, title,
  } = picker;

  return (
    <>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Done saving to boards"
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      {lastChange && (
        <View style={styles.confirmation} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.confirmationText} numberOfLines={1}>{lastChange.message}</Text>
          <TouchableOpacity onPress={undoLastChange} style={styles.undoButton} accessibilityRole="button">
            <Text style={styles.undoText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      {creating ? (
        <View style={styles.createRow}>
          <InputComponent
            style={styles.input}
            placeholder="Board name"
            placeholderTextColor={colors.mutedForeground}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={!newName.trim()}>
            <Text style={styles.createBtnText}>Create</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.newBoardRow} onPress={() => setCreating(true)} activeOpacity={0.7}>
          <View style={styles.newBoardIcon}>
            <Ionicons name="add" size={20} color={colors.primary} />
          </View>
          <Text style={styles.newBoardText}>Create new board</Text>
        </TouchableOpacity>
      )}

      <ScrollComponent style={styles.list} keyboardShouldPersistTaps="handled">
        {visibleBoards.map((board) => {
          const checked = allTargetsIn(board);
          return (
            <TouchableOpacity
              key={board.id}
              style={styles.boardRow}
              onPress={() => toggleBoard(board)}
              activeOpacity={0.7}
            >
              <BoardCover board={board} itemMap={itemMap} outfitMap={outfitMap} size={44} compact />
              <View style={styles.boardInfo}>
                <Text style={styles.boardName} numberOfLines={1}>{board.name}</Text>
                <Text style={styles.boardCount}>{getBoardSavedCount(board)} saved</Text>
              </View>
              <Ionicons
                name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={checked ? colors.primary : colors.border}
              />
            </TouchableOpacity>
          );
        })}
        {visibleBoards.length === 0 && (
          <Text style={styles.emptyHint}>No boards yet — create one above.</Text>
        )}
      </ScrollComponent>
    </>
  );
}

export const boardPickerContentStyle = {
  flex: 1,
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.sm,
  gap: spacing.md,
} as const;

const styles = StyleSheet.create({
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  doneButton: { minWidth: 52, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  doneText: { color: colors.primary, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  confirmation: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: `${colors.success}12`,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmationText: { flex: 1, color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  undoButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  undoText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  newBoardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  newBoardIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBoardText: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.primary },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md,
    color: colors.foreground,
  },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  createBtnText: { color: colors.primaryForeground, fontWeight: typography.weight.semibold, fontSize: typography.size.sm },
  list: { flex: 1 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  boardInfo: { flex: 1 },
  boardName: { fontSize: typography.size.md, fontWeight: typography.weight.medium, color: colors.foreground },
  boardCount: { fontSize: typography.size.xs, color: colors.mutedForeground },
  emptyHint: { fontSize: typography.size.sm, color: colors.mutedForeground, paddingVertical: spacing.md },
});
