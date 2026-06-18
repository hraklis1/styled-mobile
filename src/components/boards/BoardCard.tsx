import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, radii, spacing, typography } from '../../theme';
import type { Board } from '../../types/board';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';

type Props = {
  board: Board;
  itemMap: Map<number, Item>;
  outfitMap: Map<number, Outfit>;
  width: number;
  onPress?: () => void;
};

// Hairline gutter between collage cells; the muted cover background shows through.
const GAP = 2;

function Cell({ uri, recyclingKey }: { uri: string; recyclingKey: string }) {
  return (
    <Image
      source={{ uri }}
      style={styles.fill}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey}
      transition={150}
    />
  );
}

export const BoardCard = React.memo(function BoardCard({ board, itemMap, outfitMap, width, onPress }: Props) {
  const count = board.itemIds.length + board.outfitIds.length + board.wishlistIds.length + (board.storeFinds?.length ?? 0);

  // Collect up to 4 real cover images, items-first then outfits. Wishlist entries
  // carry no image (only search queries), so they contribute to `count` but not
  // to the collage — matching the server's cover logic.
  const covers = useMemo(() => {
    const uris: string[] = [];
    for (const id of board.itemIds) {
      const uri = resolveImageUri(itemMap.get(id)?.imageUrl);
      if (uri) uris.push(uri);
      if (uris.length >= 4) return uris;
    }
    for (const id of board.outfitIds) {
      const uri = resolveImageUri(outfitMap.get(id)?.aiGeneratedImageUrl);
      if (uri) uris.push(uri);
      if (uris.length >= 4) return uris;
    }
    for (const sf of board.storeFinds ?? []) {
      const raw = sf.imageUrls?.[0] ?? sf.imageUrl;
      const uri = resolveImageUri(raw ?? undefined);
      if (uri) uris.push(uri);
      if (uris.length >= 4) return uris;
    }
    return uris;
  }, [board.itemIds, board.outfitIds, board.storeFinds, itemMap, outfitMap]);

  // Brief fallback while items/outfits hydrate (or dev setups without local
  // image data): lean on the server-baked composite so the tile isn't empty.
  const fallback = board.coverImageUrl ? resolveImageUri(board.coverImageUrl) : null;

  // How many saved things aren't shown in the (max 4) collage cells.
  const overflow = count - Math.min(covers.length, 4);

  const key = (i: number) => `${board.id}-${i}`;

  return (
    <PressableScale onPress={onPress} style={{ width }}>
      <View style={[styles.cover, { width, height: width }]}>
        {covers.length >= 4 ? (
          <View style={styles.grid}>
            <View style={styles.row}>
              <View style={styles.cellWrap}>
                <Cell uri={covers[0]} recyclingKey={key(0)} />
              </View>
              <View style={styles.cellWrap}>
                <Cell uri={covers[1]} recyclingKey={key(1)} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.cellWrap}>
                <Cell uri={covers[2]} recyclingKey={key(2)} />
              </View>
              <View style={styles.cellWrap}>
                <Cell uri={covers[3]} recyclingKey={key(3)} />
                {overflow > 0 && (
                  <View style={styles.overflow}>
                    <Text style={styles.overflowText}>+{overflow}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : covers.length === 3 ? (
          // One large cell on the left, two stacked on the right.
          <View style={styles.row}>
            <View style={styles.cellWrap}>
              <Cell uri={covers[0]} recyclingKey={key(0)} />
            </View>
            <View style={styles.column}>
              <View style={styles.cellWrap}>
                <Cell uri={covers[1]} recyclingKey={key(1)} />
              </View>
              <View style={styles.cellWrap}>
                <Cell uri={covers[2]} recyclingKey={key(2)} />
              </View>
            </View>
          </View>
        ) : covers.length === 2 ? (
          // Two side-by-side halves.
          <View style={styles.row}>
            <View style={styles.cellWrap}>
              <Cell uri={covers[0]} recyclingKey={key(0)} />
            </View>
            <View style={styles.cellWrap}>
              <Cell uri={covers[1]} recyclingKey={key(1)} />
            </View>
          </View>
        ) : covers.length === 1 ? (
          <Cell uri={covers[0]} recyclingKey={key(0)} />
        ) : fallback ? (
          <Image
            source={{ uri: fallback }}
            style={styles.fill}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={String(board.id)}
            transition={150}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="albums-outline" size={28} color={colors.mutedForeground} />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {board.name}
      </Text>
      <Text style={styles.count}>
        {count} {count === 1 ? 'item' : 'items'}
      </Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  cover: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  // The 2x2 grid: two rows stacked with a hairline gutter between them.
  grid: {
    flex: 1,
    flexDirection: 'column',
    gap: GAP,
  },
  // A row of cells (or rows of the 2x2 grid) with a hairline gutter between them.
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: GAP,
  },
  // The right-hand stacked column in the 3-up layout.
  column: {
    flex: 1,
    flexDirection: 'column',
    gap: GAP,
  },
  cellWrap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  overflow: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overflowText: {
    color: '#fff',
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
  },
  name: {
    marginTop: spacing.sm,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  count: {
    marginTop: 1,
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
});
