import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { EditorialCardMeta } from '../primitives/Editorial';
import { BoardCover } from './BoardCover';
import { colors, radii, spacing } from '../../theme';
import type { Board } from '../../types/board';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';
import { getBoardSavedCount } from '../../lib/boardPresentation';

type Props = {
  board: Board;
  itemMap: Map<number, Item>;
  outfitMap: Map<number, Outfit>;
  width: number;
  onPress?: () => void;
  onOptions?: () => void;
};

export const BoardCard = React.memo(function BoardCard({ board, itemMap, outfitMap, width, onPress, onOptions }: Props) {
  const count = getBoardSavedCount(board);

  return (
    <View style={{ width }}>
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${board.name} board, ${count} saved`}>
        <BoardCover board={board} itemMap={itemMap} outfitMap={outfitMap} size={width} />
      </PressableScale>
      <View style={styles.metaRow}>
        <EditorialCardMeta title={board.name} subtitle={`${count} saved`} />
        {onOptions && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={onOptions}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${board.name}`}
          >
            <Ionicons name="ellipsis-horizontal" size={19} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: spacing.sm },
  optionsButton: { width: 44, height: 44, marginTop: -6, marginRight: -8, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full },
});
