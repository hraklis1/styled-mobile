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
 * A saved Stylist entry at history scale: two of these share the page width,
 * which is the point — on Shop they are the last thing on the page, not the
 * first. Width comes from the row they sit in (`flex: 1`), not the tile.
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
              <Text style={styles.context} numberOfLines={2}>{context}</Text>
            </View>
          ) : null}
          <Text style={styles.meta} numberOfLines={2}>{meta}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tileLayout: { flex: 1, minWidth: 0 },
  // A plate and its caption on the page ground, like the shortlist rail above
  // it — one card language for the whole tab, not a boxed tile beside a bare one.
  tile: { gap: spacing.sm },
  preview: { width: '100%', aspectRatio: 4 / 5, borderRadius: radii.photo },
  copy: { gap: 2, paddingHorizontal: 2 },
  title: { ...typography.text.cardTitle, color: colors.foreground },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  context: { flex: 1, ...typography.text.caption, color: colors.mutedForeground },
  meta: { ...typography.text.caption, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
});
