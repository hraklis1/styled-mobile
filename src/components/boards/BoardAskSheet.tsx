import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { StylistRichText } from '../stylist/StylistRichText';
import { GarmentImage } from '../wardrobe/garment-image';
import { useBoardAsk, useBoardAsks, useClearBoardAsks, type BoardAskEntry } from '../../hooks/useBoardAsk';
import { apiErrorCode } from '../../lib/api';
import { track } from '../../lib/analytics';
import type { Board } from '../../types/board';
import type { Item } from '../../types/item';
import { colors, spacing, typography, radii } from '../../theme';

// Fixed snap point — dynamic sizing collapses to 0 with a BottomSheetScrollView.
const SNAP_POINTS = ['85%'];
const MAX_QUESTION = 500;

// Starting points only: tapping one fills the input, it never sends by itself.
const EXAMPLES = ["What's the vibe here?", 'What can I wear these with?', 'Anything redundant?'];

type Props = {
  board: Board;
  /** The board's own owned pieces, passed as a prompt-context hint. */
  items: Item[];
  /** The whole closet by id, for thumbnails of pieces the answer names. */
  closetById: Map<number, Item>;
  onClose: () => void;
};

/**
 * "Ask about this board": one open question to the stylist, answered in place.
 * Boards can be any collection (all shoes, a mood, inspiration), so there is no
 * fixed workflow here — the user asks, the stylist answers. Each question is a
 * single advice call; answers are saved to the board's history on the server,
 * so reopening the sheet shows the newest in full and older ones collapsed.
 */
export function BoardAskSheet({ board, items, closetById, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const ask = useBoardAsk();
  const { data: history = [] } = useBoardAsks(board.id);
  const clearHistory = useClearBoardAsks(board.id);
  // The newest answer is open by default; tapping an older question opens it instead.
  const [openId, setOpenId] = useState<number | null>(null);
  const expandedId = openId ?? history[0]?.id ?? null;
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const usedExample = useRef(false);

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  useEffect(() => {
    ref.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    // One request at a time: the route shares its rate limit with the chat.
    if (!trimmed || ask.isPending) return;
    track('board_ask_sent', { boardId: board.id, chip: usedExample.current });
    usedExample.current = false;
    setAsked(trimmed);
    setQuestion('');
    ask.mutate(
      { boardId: board.id, name: board.name, itemIds, question: trimmed },
      {
        onSuccess: (entry) => {
          setAsked(null);
          setOpenId(entry.id);
        },
      },
    );
  }, [ask, board.id, board.name, itemIds]);

  const confirmClear = useCallback(() => {
    Alert.alert('Clear saved answers?', 'This removes every question and answer saved on this board.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          track('board_ask_cleared', { boardId: board.id, count: history.length });
          setOpenId(null);
          clearHistory.mutate();
        },
      },
    ]);
  }, [board.id, clearHistory, history.length]);

  const mentionedFor = useCallback(
    (entry: BoardAskEntry) => entry.itemIds.map((id) => closetById.get(id)).filter((item): item is Item => !!item),
    [closetById],
  );

  const pickExample = useCallback((text: string) => {
    usedExample.current = true;
    setQuestion(text);
  }, []);

  const errorCode = ask.error ? apiErrorCode(ask.error) : undefined;
  const isPaywalled = errorCode === 'FREE_LIMIT_REACHED' || errorCode === 'PREMIUM_REQUIRED';
  const canSend = question.trim().length > 0 && !ask.isPending;

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
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>Ask about this board</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{board.name}</Text>
          </View>
          <TouchableOpacity style={styles.doneButton} onPress={onClose} accessibilityRole="button">
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <BottomSheetTextInput
            style={styles.input}
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask anything about this board…"
            placeholderTextColor={colors.mutedForeground}
            maxLength={MAX_QUESTION}
            multiline
            returnKeyType="send"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => send(question)}
            accessibilityLabel="Question about this board"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={() => send(question)}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Ask"
          >
            <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!asked && history.length === 0 && (
            <View style={styles.examples}>
              {EXAMPLES.map((example) => (
                <TouchableOpacity
                  key={example}
                  style={styles.chip}
                  onPress={() => pickExample(example)}
                  accessibilityRole="button"
                >
                  <Text style={styles.chipText}>{example}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {asked && <Text style={styles.asked}>{asked}</Text>}

          {ask.isPending && (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.centeredText}>Looking through this board…</Text>
            </View>
          )}

          {!ask.isPending && ask.isError && (
            <View style={styles.centered}>
              <Ionicons
                name={isPaywalled ? 'lock-closed-outline' : 'cloud-offline-outline'}
                size={28}
                color={colors.mutedForeground}
              />
              <Text style={styles.centeredText}>
                {isPaywalled ? 'Asking about a board is part of premium.' : "Couldn't reach your stylist just now."}
              </Text>
              {!isPaywalled && asked && (
                <TouchableOpacity style={styles.retryBtn} onPress={() => send(asked)} accessibilityRole="button">
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {history.length > 0 && (
            <View style={styles.historyHeader}>
              <Text style={styles.historyLabel}>Saved answers</Text>
              <TouchableOpacity onPress={confirmClear} hitSlop={spacing.sm} accessibilityRole="button" accessibilityLabel="Clear saved answers">
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {history.map((entry) => {
            const open = entry.id === expandedId;
            const mentioned = open ? mentionedFor(entry) : [];
            return (
              <View key={entry.id} style={styles.entry}>
                <TouchableOpacity
                  style={styles.entryHead}
                  onPress={() => setOpenId(open ? -1 : entry.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <Text style={[styles.entryQuestion, open && styles.entryQuestionOpen]} numberOfLines={open ? undefined : 1}>
                    {entry.question}
                  </Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
                {open && (
                  <View style={styles.answer}>
                    <StylistRichText text={entry.response} />
                    {mentioned.length > 0 && (
                      <View style={styles.mentionedRow}>
                        {mentioned.map((item) => (
                          <GarmentImage key={item.id} item={item} width={64} height={80} borderRadius={radii.md} placeholderIconSize={20} />
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border, width: 36 },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  titleCopy: { flex: 1, gap: 2 },
  title: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.bold, color: colors.foreground },
  subtitle: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground },
  doneButton: { minWidth: 52, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  doneText: { color: colors.primary, fontSize: typography.text.body.fontSize, fontWeight: typography.weight.semibold },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.foreground,
    fontSize: typography.text.body.fontSize,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  scroll: { paddingBottom: spacing.xl, gap: spacing.md },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipText: { color: colors.foreground, fontSize: typography.text.bodySmall.fontSize },
  asked: { color: colors.mutedForeground, fontSize: typography.text.bodySmall.fontSize, fontStyle: 'italic' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  centeredText: { color: colors.mutedForeground, fontSize: typography.text.bodySmall.fontSize, textAlign: 'center' },
  answer: { gap: spacing.lg, paddingBottom: spacing.md },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  historyLabel: { color: colors.mutedForeground, fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  clearText: { color: colors.mutedForeground, fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold },
  entry: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  entryHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  entryQuestion: { flex: 1, color: colors.mutedForeground, fontSize: typography.text.bodySmall.fontSize },
  entryQuestionOpen: { color: colors.foreground, fontWeight: typography.weight.semibold },
  mentionedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  retryBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: colors.primaryForeground, fontWeight: typography.weight.semibold, fontSize: typography.text.bodySmall.fontSize },
});
