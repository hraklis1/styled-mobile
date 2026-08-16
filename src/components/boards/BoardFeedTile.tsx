import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { GarmentCard } from '../wardrobe/GarmentCard';
import { OutfitCollage } from '../outfits/OutfitCollage';
import { PressableScale } from '../primitives/PressableScale';
import { WishlistOutfitPreview } from '../outfits/WishlistOutfitPreview';
import {
  getWishlistAccessibilityLabel,
  getWishlistBoardLabel,
  getWishlistBoardTitle,
  getWishlistMeta,
} from '../../lib/wishlistPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { BoardFeedItem } from '../../types/board';

export const BOARD_FEED_ASPECT_RATIO = 0.8;

type Props = {
  entry: BoardFeedItem;
  cardWidth: number;
  isMultiselect: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

export function BoardFeedTile({
  entry,
  cardWidth,
  isMultiselect,
  isSelected,
  onPress,
  onLongPress,
}: Props) {
  const mediaHeight = cardWidth / BOARD_FEED_ASPECT_RATIO;
  const selectionOverlay = isMultiselect ? (
    <View style={[styles.selectionOverlay, !isSelected && styles.selectionOverlayIdle]} pointerEvents="none">
      <View style={[styles.selectionCheck, !isSelected && styles.selectionCheckIdle]}>
        {isSelected && <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />}
      </View>
    </View>
  ) : null;

  let content: ReactNode;

  if (entry.kind === 'item') {
    content = (
      <GarmentCard
        item={entry.item}
        aspectRatio={BOARD_FEED_ASPECT_RATIO}
        cardWidth={cardWidth}
        bottomSpacing={0}
        onPress={onPress}
        onLongPress={onLongPress}
      />
    );
  } else if (entry.kind === 'outfit') {
    content = (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${entry.outfit.name || 'Saved'} outfit`}
        accessibilityHint={isMultiselect ? 'Selects this outfit' : 'Opens outfit details'}
      >
        <OutfitCollage outfit={entry.outfit} size={cardWidth} height={mediaHeight} />
        <View style={styles.metadata}>
          <Text style={styles.outfitName} numberOfLines={2} selectable>
            {entry.outfit.name || 'Saved outfit'}
          </Text>
        </View>
      </PressableScale>
    );
  } else {
    content = (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={getWishlistAccessibilityLabel(entry.entry)}
        accessibilityHint={isMultiselect ? 'Selects this outfit' : 'Opens outfit details'}
      >
        <View style={[styles.wishlistTile, { width: cardWidth, height: mediaHeight }]}>
          <WishlistOutfitPreview entry={entry.entry} style={styles.wishlistPreview} />
          <View style={styles.wishlistInfo}>
            <Text style={styles.wishlistEyebrow} numberOfLines={1} selectable>{getWishlistBoardLabel(entry.entry)}</Text>
            <Text style={styles.wishlistLabel} numberOfLines={2} selectable>{getWishlistBoardTitle(entry.entry)}</Text>
            <Text style={styles.wishlistBudget} numberOfLines={1} selectable>{getWishlistMeta(entry.entry)}</Text>
          </View>
        </View>
      </PressableScale>
    );
  }

  return (
    <View style={styles.cell}>
      {content}
      {selectionOverlay}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    paddingHorizontal: spacing.sm / 2,
    marginBottom: spacing.md,
  },
  metadata: {
    minHeight: 62,
    paddingTop: spacing.sm + 1,
    paddingHorizontal: 2,
  },
  outfitName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  wishlistTile: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  wishlistPreview: { width: '100%', height: '52%', borderRadius: 0 },
  wishlistInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  wishlistEyebrow: {
    color: colors.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  wishlistLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  wishlistBudget: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: `${colors.primary}40`,
    borderRadius: radii.lg,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: spacing.xs,
  },
  selectionOverlayIdle: { backgroundColor: 'transparent' },
  selectionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCheckIdle: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.border,
  },
});
