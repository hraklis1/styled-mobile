import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { EditorialCardMeta } from '../primitives/Editorial';
import { BoardCover } from './BoardCover';
import { colors, spacing, typography } from '../../theme';
import type { Board } from '../../types/board';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';
import { getBoardContentSummary } from '../../lib/boardPresentation';

type Props = {
  board: Board;
  itemMap: Map<number, Item>;
  outfitMap: Map<number, Outfit>;
  width: number;
  onPress?: () => void;
  onOptions?: () => void;
};

export const BoardCard = React.memo(function BoardCard({ board, itemMap, outfitMap, width, onPress, onOptions }: Props) {
  const summary = getBoardContentSummary(board);

  return (
    <View style={{ width }}>
      <View style={styles.coverWrap}>
        <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${board.name} board, ${summary}`}>
          <BoardCover board={board} itemMap={itemMap} outfitMap={outfitMap} size={width} />
        </PressableScale>
      </View>
      {/* The options control lives in the meta row, so the cover stays an
          unbroken image and nothing floats over the photograph. */}
      <View style={styles.metaRow}>
        <EditorialCardMeta
          title={board.name}
          subtitle={summary}
          titleStyle={styles.boardTitle}
          trailing={onOptions ? (
            <TouchableOpacity
              style={styles.optionsHitArea}
              onPress={onOptions}
              activeOpacity={0.72}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Options for ${board.name}`}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : undefined}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  coverWrap: {
    position: 'relative',
  },
  metaRow: {
    paddingTop: spacing.sm,
  },
  optionsHitArea: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardTitle: {
    ...typography.text.cardTitle,
  },
});
