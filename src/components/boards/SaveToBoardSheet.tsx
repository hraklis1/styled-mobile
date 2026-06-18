import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { colors, spacing, typography, radii } from '../../theme';

// Fixed snap point — dynamic sizing collapses to 0 height when the content is a
// BottomSheetScrollView, leaving the sheet invisible.
const SNAP_POINTS = ['60%'];

type Props = {
  onClose: () => void;
  /** A single reference or a batch (bulk select) to save into a board. */
  target: BoardEntryRef | BoardEntryRef[] | null;
};

// Mounted only while open by the parent (matches AddActionSheet), so it presents
// on mount and reports dismissal through onClose.
export function SaveToBoardSheet({ onClose, target }: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const { data: boards = [] } = useBoards();
  const { mutate: updateBoard } = useUpdateBoard();
  const { mutate: createBoard } = useCreateBoard();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const targets: BoardEntryRef[] = target == null ? [] : Array.isArray(target) ? target : [target];

  useEffect(() => {
    ref.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

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

  const title = targets.length > 1 ? `Save ${targets.length} items to…` : 'Save to board';

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onDismiss={onClose}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.title}>{title}</Text>

        {creating ? (
          <View style={styles.createRow}>
            <BottomSheetTextInput
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

        <BottomSheetScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {boards.map((board) => {
            const checked = allTargetsIn(board);
            return (
              <TouchableOpacity
                key={board.id}
                style={styles.boardRow}
                onPress={() => toggleBoard(board)}
                activeOpacity={0.7}
              >
                <View style={styles.boardThumb}>
                  <Ionicons name="albums-outline" size={18} color={colors.mutedForeground} />
                </View>
                <View style={styles.boardInfo}>
                  <Text style={styles.boardName} numberOfLines={1}>
                    {board.name}
                  </Text>
                  <Text style={styles.boardCount}>
                    {board.itemIds.length + board.outfitIds.length + board.wishlistIds.length} items
                  </Text>
                </View>
                <Ionicons
                  name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={checked ? colors.primary : colors.border}
                />
              </TouchableOpacity>
            );
          })}
          {boards.length === 0 && (
            <Text style={styles.emptyHint}>No boards yet — create one above.</Text>
          )}
        </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border, width: 36 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  newBoardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  newBoardIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBoardText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
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
  createBtnText: {
    color: colors.primaryForeground,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.sm,
  },
  list: {
    flex: 1,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  boardThumb: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardInfo: { flex: 1 },
  boardName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  boardCount: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  emptyHint: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    paddingVertical: spacing.md,
  },
});
