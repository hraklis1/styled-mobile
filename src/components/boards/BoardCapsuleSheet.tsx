import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { TripPlanCard } from '../stylist/TripPlanCard';
import { useCreateOutfit, type CreateOutfitInput } from '../../hooks/useOutfits';
import { useUpdateBoard } from '../../hooks/useBoards';
import { useBoardCapsule, ranCapsuleWorkflow } from '../../hooks/useBoardCapsule';
import { apiErrorCode } from '../../lib/api';
import { track } from '../../lib/analytics';
import type { Board } from '../../types/board';
import type { Item } from '../../types/item';
import { colors, spacing, typography, radii } from '../../theme';

// Fixed snap point — dynamic sizing collapses to 0 with a BottomSheetScrollView.
const SNAP_POINTS = ['85%'];

type Props = {
  board: Board;
  /** The board's own owned pieces — the only wardrobe the server draws from. */
  items: Item[];
  onClose: () => void;
};

/**
 * "Style this board" without opening the chat: asks for a capsule, renders the
 * looks it comes back with, and files any the user keeps onto this board as
 * well as into the closet.
 *
 * This one is a bottom sheet rather than BoardPickerModal's plain Modal —
 * BoardDetail is an ordinary screen, so there is no enclosing RN Modal for the
 * portal to land behind.
 */
export function BoardCapsuleSheet({ board, items, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const createOutfit = useCreateOutfit();
  const { mutate: updateBoard } = useUpdateBoard();
  const capsule = useBoardCapsule();
  const { mutate: askForCapsule } = capsule;

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  // Fire once on mount. Guarded because a re-render must not spend a second
  // stylist message, and the route is rate limited at 12/min shared with chat.
  const requested = useRef(false);
  useEffect(() => {
    ref.current?.present();
    if (requested.current) return;
    requested.current = true;
    askForCapsule({ boardId: board.id, name: board.name, itemIds });
  }, [askForCapsule, board.id, board.name, itemIds]);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  /**
   * Save into the closet first, then attach the new outfit to this board.
   * Board membership is patched from the freshly created id, so a look the
   * user keeps shows up under the board's Outfits filter straight away.
   */
  const saveOutfitToBoard = useCallback(async (input: CreateOutfitInput) => {
    const outfit = await createOutfit.mutateAsync(input);
    updateBoard({ id: board.id, outfitIds: [outfit.id, ...board.outfitIds] });
    track('board_capsule_look_saved', { boardId: board.id });
    return outfit;
  }, [board.id, board.outfitIds, createOutfit, updateBoard]);

  const retry = useCallback(() => {
    askForCapsule({ boardId: board.id, name: board.name, itemIds });
  }, [askForCapsule, board.id, board.name, itemIds]);

  const plan = capsule.data?.tripPlan ?? null;
  const errorCode = capsule.error ? apiErrorCode(capsule.error) : undefined;
  const isPaywalled = errorCode === 'FREE_LIMIT_REACHED' || errorCode === 'PREMIUM_REQUIRED';

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onDismiss={onClose}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{board.name}</Text>
          <TouchableOpacity style={styles.doneButton} onPress={onClose} accessibilityRole="button">
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView contentContainerStyle={styles.scroll}>
          {capsule.isPending && (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.centeredText}>Pulling this board into looks…</Text>
            </View>
          )}

          {!capsule.isPending && capsule.isError && (
            <View style={styles.centered}>
              <Ionicons
                name={isPaywalled ? 'lock-closed-outline' : 'cloud-offline-outline'}
                size={28}
                color={colors.mutedForeground}
              />
              <Text style={styles.centeredText}>
                {isPaywalled
                  ? 'Styling a board is part of premium.'
                  : "Couldn't build looks from this board just now."}
              </Text>
              {!isPaywalled && (
                <TouchableOpacity style={styles.retryBtn} onPress={retry} accessibilityRole="button">
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* A capsule with looks — the good case. */}
          {plan && plan.outfits.length > 0 && (
            <TripPlanCard
              plan={{ ...plan, kind: 'board_capsule' }}
              allItems={items}
              createOutfit={createOutfit}
              onSaveOutfit={saveOutfitToBoard}
              saveLabel="Save to board"
            />
          )}

          {/* Ran, but every candidate look failed validation server-side. */}
          {plan && plan.outfits.length === 0 && (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>Couldn't build a full look from this board</Text>
              <Text style={styles.centeredText}>
                {plan.intro || 'Try saving a few more pieces that work together.'}
              </Text>
            </View>
          )}

          {/* No plan at all: the server answered in prose instead — usually a
              board with nothing wearable saved to it yet. */}
          {capsule.data && !plan && (
            <View style={styles.centered}>
              <Text style={styles.centeredText}>{capsule.data.response}</Text>
              {!ranCapsuleWorkflow(capsule.data) && (
                <Text style={styles.hint}>Add a few more pieces to this board and try again.</Text>
              )}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border, width: 36 },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  title: { flex: 1, fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.foreground },
  doneButton: { minWidth: 52, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  doneText: { color: colors.primary, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  scroll: { paddingBottom: spacing.xl, gap: spacing.md },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  centeredText: { color: colors.mutedForeground, fontSize: typography.size.sm, textAlign: 'center' },
  emptyTitle: { color: colors.foreground, fontSize: typography.size.md, fontWeight: typography.weight.semibold, textAlign: 'center' },
  hint: { color: colors.mutedForeground, fontSize: typography.size.xs, textAlign: 'center' },
  retryBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: colors.primaryForeground, fontWeight: typography.weight.semibold, fontSize: typography.size.sm },
});
