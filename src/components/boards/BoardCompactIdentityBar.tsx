import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme';
import type { Board } from '../../types/board';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';
import { BoardCover } from './BoardCover';

type Props = {
  board: Board;
  itemMap: Map<number, Item>;
  outfitMap: Map<number, Outfit>;
  summary: string;
};

export function BoardCompactIdentityBar({ board, itemMap, outfitMap, summary }: Props) {
  return (
    <View
      style={styles.bar}
      accessible
      accessibilityLabel={`${board.name}, ${summary}`}
    >
      <BoardCover
        board={board}
        itemMap={itemMap}
        outfitMap={outfitMap}
        size={34}
        height={43}
        compact
      />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1} selectable>{board.name}</Text>
        <Text style={styles.summary} numberOfLines={1} selectable>{summary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    color: colors.foreground,
    fontSize: typography.size.md,
    lineHeight: 20,
  },
  summary: {
    color: colors.mutedForeground,
    fontSize: typography.size.xs,
    fontVariant: ['tabular-nums'],
  },
});
