import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../primitives/PressableScale';
import { WishlistOutfitPreview } from './WishlistOutfitPreview';
import {
  getWishlistAccessibilityLabel,
  getWishlistContext,
  getWishlistMeta,
  getWishlistTitle,
} from '../../lib/wishlistPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { WishlistEntry } from '../../lib/wishlist';

/**
 * A saved Stylist entry at history scale: two of these sit in the width the full
 * summary card used to take, which is the point — on Shop they are the last
 * thing on the page, not the first.
 */
export function SavedLookTile({
  entry,
  onPress,
  style,
}: {
  entry: WishlistEntry;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { outfit, eventContext } = entry;
  const context = getWishlistContext(entry);
  const title = getWishlistTitle(entry);
  const meta = getWishlistMeta(entry);
  const savedEditHasImagery = outfit.shoppingBrief?.targets.some((target) => (
    Boolean(target.imageUrl) || target.offers?.some((offer) => Boolean(offer.imageUrl))
  )) ?? false;
  const coverIsComplete = Boolean(outfit.shoppingBrief) && !savedEditHasImagery;

  return (
    <PressableScale
      scaleTo={0.98}
      // Width is layout, so it belongs on the outer pressable; the inner view
      // that scales stretches to fill it.
      style={[styles.tileLayout, style]}
      contentStyle={styles.tile}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={getWishlistAccessibilityLabel(entry)}
      accessibilityHint="Opens saved Stylist details"
    >
      <WishlistOutfitPreview entry={entry} style={styles.preview} />
      {!coverIsComplete ? (
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {context ? (
            <View style={styles.contextRow}>
              <Ionicons
                name={outfit.shoppingBrief ? 'sparkles-outline' : eventContext ? 'calendar-outline' : 'location-outline'}
                size={11}
                color={colors.mutedForeground}
              />
              <Text style={styles.context} numberOfLines={1}>{context}</Text>
            </View>
          ) : null}
          <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tileLayout: { width: '48%' },
  tile: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  // Square rather than the usual 4:5 outfit crop: at history scale the moodboard
  // only needs to be recognisable, and two rows of portraits would dominate the
  // page they are meant to close.
  preview: { width: '100%', aspectRatio: 1 },
  copy: { gap: 2, paddingHorizontal: 2, paddingBottom: spacing.xs },
  title: {
    fontSize: typography.text.bodySmall.fontSize,
    lineHeight: 18,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  context: { flex: 1, fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  meta: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
});
