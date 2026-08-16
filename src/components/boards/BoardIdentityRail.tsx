import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme';
import type { Board } from '../../types/board';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';
import { BoardCover } from './BoardCover';

type Props = {
  board: Board;
  itemMap: Map<number, Item>;
  outfitMap: Map<number, Outfit>;
  summary: string;
  swatches: string[];
  insightText?: string;
};

export function BoardIdentityRail({ board, itemMap, outfitMap, summary, swatches, insightText }: Props) {
  return (
    <View
      style={styles.rail}
      accessible
      accessibilityLabel={`${board.name}, ${summary}`}
    >
      <BoardCover
        board={board}
        itemMap={itemMap}
        outfitMap={outfitMap}
        size={84}
        height={105}
        compact
      />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2} selectable>{board.name}</Text>
        <Text style={styles.summary} numberOfLines={1} selectable>{summary}</Text>
        {insightText && <Text style={styles.insight} numberOfLines={1} selectable>{insightText}</Text>}
        {swatches.length > 0 && (
          <View style={styles.palette} accessibilityLabel={`Board palette with ${swatches.length} colors`}>
            {swatches.map((swatch, index) => (
              <View key={`${swatch}-${index}`} style={[styles.swatch, { backgroundColor: swatch }]} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    minHeight: 121,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.size.xl,
    lineHeight: 25,
    color: colors.foreground,
  },
  summary: {
    color: colors.mutedForeground,
    fontSize: typography.size.sm,
    fontVariant: ['tabular-nums'],
  },
  insight: {
    color: colors.mutedForeground,
    fontSize: typography.size.xs,
  },
  palette: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  swatch: {
    width: 20,
    height: 20,
    marginRight: -4,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.surfaceSubtle,
  },
});
