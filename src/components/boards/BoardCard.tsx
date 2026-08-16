import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { EditorialCardMeta } from '../primitives/Editorial';
import { BoardCover } from './BoardCover';
import { colors, radii, spacing, typography } from '../../theme';
import type { Board } from '../../types/board';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';
import { getBoardContentSummary } from '../../lib/boardPresentation';

const BOARD_CARD_ASPECT_RATIO = 0.8;

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
  const coverHeight = width / BOARD_CARD_ASPECT_RATIO;

  return (
    <View style={{ width }}>
      <View style={styles.coverWrap}>
        <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${board.name} board, ${summary}`}>
          <BoardCover board={board} itemMap={itemMap} outfitMap={outfitMap} size={width} height={coverHeight} />
        </PressableScale>
        {onOptions && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={onOptions}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${board.name}`}
          >
            <Ionicons name="ellipsis-horizontal" size={19} color={colors.foreground} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.metaRow}>
        <EditorialCardMeta title={board.name} subtitle={summary} titleStyle={styles.boardTitle} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  coverWrap: {
    position: 'relative',
  },
  metaRow: {
    paddingTop: spacing.sm + 1,
  },
  optionsButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  boardTitle: {
    fontFamily: typography.family.display,
    fontSize: typography.size.md,
    fontWeight: typography.weight.regular,
  },
});
