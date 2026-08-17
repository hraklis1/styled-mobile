import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, typography } from '../../theme';
import type { Board } from '../../types/board';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';
import { getBoardCoverUris, getBoardSavedCount } from '../../lib/boardPresentation';

type Props = {
  board: Board;
  itemMap: Map<number, Item>;
  outfitMap: Map<number, Outfit>;
  size: number;
  height?: number;
  compact?: boolean;
};

const GAP = 2;

function CoverCell({
  uri,
  recyclingKey,
  contentFit = 'cover',
}: {
  uri: string;
  recyclingKey: string;
  contentFit?: 'cover' | 'contain';
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.cell}>
      <View style={styles.cellPlaceholder}>
        <Ionicons name="sparkles-outline" size={15} color={colors.mutedForeground} />
      </View>
      {!failed && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          cachePolicy="memory-disk"
          recyclingKey={recyclingKey}
          transition={150}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

export function BoardCover({ board, itemMap, outfitMap, size, height = size, compact }: Props) {
  const covers = useMemo(() => getBoardCoverUris(board, itemMap, outfitMap), [board, itemMap, outfitMap]);

  const count = getBoardSavedCount(board);
  const overflow = Math.max(0, count - covers.length);

  const cell = (index: number, contentFit?: 'cover' | 'contain') => (
    <CoverCell
      uri={covers[index]}
      recyclingKey={`${board.id}-${index}-${covers[index]}`}
      contentFit={contentFit}
    />
  );

  return (
    <View
      style={[styles.cover, { width: size, height, borderRadius: compact ? radii.md : radii.lg }]}
      accessibilityLabel={`${board.name} cover`}
    >
      {covers.length >= 4 ? (
        <View style={styles.moodboard}>
          <View style={styles.heroColumn}>{cell(0)}</View>
          <View style={styles.sideColumn}>
            {cell(1)}
            <View style={styles.row}>
              {cell(2)}
              <View style={styles.flex}>
                {cell(3)}
                {overflow > 0 && <View style={styles.overflow}><Text style={styles.overflowText}>+{overflow}</Text></View>}
              </View>
            </View>
          </View>
        </View>
      ) : covers.length === 3 ? (
        <View style={styles.row}>
          {cell(0)}
          <View style={styles.column}>{cell(1)}{cell(2)}</View>
        </View>
      ) : covers.length === 2 ? (
        <View style={styles.row}>{cell(0)}{cell(1)}</View>
      ) : covers.length === 1 ? (
        cell(0, 'cover')
      ) : (
        <LinearGradient
          colors={['#F4F0E9', '#E7DED3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fallback}
        >
          <View style={styles.fallbackIcon}>
            <Ionicons name="albums-outline" size={compact ? 18 : 30} color={colors.primary} />
          </View>
          {!compact && (
            <Text style={styles.fallbackText}>Start curating</Text>
          )}
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderCurve: 'continuous',
  },
  moodboard: { flex: 1, flexDirection: 'row', gap: GAP },
  heroColumn: { flex: 1.45 },
  sideColumn: { flex: 1, gap: GAP },
  grid: { flex: 1, gap: GAP },
  row: { flex: 1, flexDirection: 'row', gap: GAP },
  column: { flex: 1, gap: GAP },
  flex: { flex: 1 },
  cell: {
    flex: 1,
    minWidth: 1,
    minHeight: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  cellPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,252,247,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  overflow: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(40,35,31,0.36)',
  },
  overflowText: { color: colors.white, fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderCurve: 'continuous',
  },
  fallbackIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,252,247,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,252,247,0.72)',
  },
  fallbackText: { color: colors.inkSubtle, fontSize: typography.size.sm, fontWeight: typography.weight.medium, textAlign: 'center' },
});
