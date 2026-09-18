import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '../primitives/AppText';
import { PressableScale } from '../primitives/PressableScale';
import { formatShoppingPrice, shoppingCatalogChips } from '../../lib/shoppingPresentation';
import { SHORTLIST_COPY } from '../../lib/shoppingVocabulary';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';

/** Wide enough for the photograph to carry the card, narrow enough that the
 *  next one peeks by a third: a rail that fills the viewport stops reading as a
 *  rail. */
const CARD_WIDTH = 196;

/**
 * One place, not a trail of them. The gallery's two-part label ("San Francisco ·
 * Union Square/Market Street") only ever truncates at card width, and a clipped
 * street reads worse than no street: the city, or the neighbourhood standing in
 * for it, is all a shortlist card needs to place the find.
 */
function cardPlaceLabel(item: ShoppingEditItem): string {
  const neighbourhood = item.branchLabel?.split('/')[0].trim();
  return item.locality?.trim() || neighbourhood || item.region?.trim() || '';
}

/**
 * The shortlist as a line sheet: the user's own photographs at a size worth
 * looking at, each captioned with the three things a decision turns on — where
 * it was, what it costs, and what it is.
 */
export function ShortlistCarousel({
  items,
  totalCount,
  onPressItem,
  onSeeAll,
}: {
  items: ShoppingEditItem[];
  /** The whole shortlist behind the rail, which may be longer than `items`. */
  totalCount: number;
  onPressItem: (item: ShoppingEditItem) => void;
  onSeeAll: () => void;
}) {
  const remaining = totalCount - items.length;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={CARD_WIDTH + spacing.md}
      snapToAlignment="start"
      style={styles.rail}
      contentContainerStyle={styles.railContent}
    >
      {items.map((item) => (
        <ShortlistFindCard key={item.id} item={item} onPress={() => onPressItem(item)} />
      ))}
      {remaining > 0 ? (
        <PressableScale
          scaleTo={0.98}
          style={styles.cardLayout}
          contentStyle={styles.seeAllCard}
          onPress={onSeeAll}
          accessibilityRole="button"
          accessibilityLabel={`See all ${totalCount} pieces on your shortlist`}
        >
          <View style={styles.seeAllEmblem}>
            <Ionicons name="arrow-forward" size={20} color={colors.action} />
          </View>
          <AppText variant="label" tone="action" style={styles.seeAllLabel}>See all {totalCount} pieces</AppText>
        </PressableScale>
      ) : null}
    </ScrollView>
  );
}

function ShortlistFindCard({ item, onPress }: { item: ShoppingEditItem; onPress: () => void }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const price = formatShoppingPrice(item.extractedPrice, item.currencyCode ?? null);
  const place = cardPlaceLabel(item);
  const catalogChips = shoppingCatalogChips(item);
  // What the piece is, in the user's own terms — never the photo bookkeeping the
  // gallery falls back to, which tells you nothing about whether to buy it.
  // Nothing known means no line: a placeholder row is not information.
  const description = catalogChips.length > 0
    ? catalogChips.join(' · ')
    : item.notes?.trim() || '';

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
  }, [item.primarySnap.id, item.primarySnap.imageUri]);

  return (
    <PressableScale
      scaleTo={0.98}
      // Width is layout, so it belongs on the outer pressable; the inner view
      // that scales stretches to fill it.
      style={styles.cardLayout}
      contentStyle={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[item.storeName ?? 'Shopping piece', place, price, description].filter(Boolean).join(', ')}
      accessibilityHint="Opens this piece in your shortlist"
    >
      <View style={styles.imageFrame}>
        {!imageFailed ? (
          <Image
            source={{ uri: item.primarySnap.imageUri }}
            style={[StyleSheet.absoluteFill, !imageLoaded && styles.imagePending]}
            // Uniformly cropped, unlike the gallery's garment-aware fit: a rail
            // of ragged letterboxes reads cheap, and nothing is judged here.
            contentFit="cover"
            contentPosition="center"
            cachePolicy="memory-disk"
            recyclingKey={item.primarySnap.id}
            transition={220}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="shirt-outline" size={28} color={colors.primary} />
          </View>
        )}
        {imageLoaded && !imageFailed ? (
          <LinearGradient colors={['transparent', 'rgba(20, 15, 12, 0.24)']} style={styles.bottomGradient} />
        ) : null}
        {item.photoCount > 1 ? (
          <View style={styles.photoCountPill}>
            <Ionicons name="albums-outline" size={13} color={colors.primaryForeground} />
            <AppText variant="caption" tone="inverse" style={styles.photoCountText}>{item.photoCount}</AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.copy}>
        <AppText variant="label" tone="primary" numberOfLines={1}>
          {item.storeName ?? SHORTLIST_COPY.needsStore}
        </AppText>
        {price ? (
          <AppText variant="data" tone="primary" numberOfLines={1}>{price}</AppText>
        ) : (
          // The one thing left to do, in action colour — not a value in disguise.
          <AppText variant="label" tone="action" numberOfLines={1}>Add price</AppText>
        )}
        {place ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>{place}</AppText>
        ) : null}
        {description ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>{description}</AppText>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Full bleed: the rail runs to both edges of the screen while its cards keep
  // the page's own gutter, so the carousel reads as continuing past the margin.
  rail: { marginHorizontal: -spacing.lg },
  railContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  cardLayout: { width: CARD_WIDTH },
  // A plate and its caption on the page ground — no box, no shadow. Flex so
  // every card takes the tallest card's height and the rail's foot stays level.
  card: { flex: 1, gap: spacing.sm },
  imageFrame: {
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    borderRadius: radii.photo,
    backgroundColor: colors.surfaceSubtle,
  },
  imagePending: { opacity: 0 },
  imageFallback: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 },
  photoCountPill: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: 'rgba(24, 20, 18, 0.62)',
  },
  photoCountText: { fontWeight: typography.weight.semibold, fontVariant: ['tabular-nums'] },
  copy: { gap: 2, paddingHorizontal: 2 },
  seeAllCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.photo,
    backgroundColor: colors.surfaceSubtle,
  },
  seeAllEmblem: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.action}14`,
  },
  seeAllLabel: { textAlign: 'center' },
});
