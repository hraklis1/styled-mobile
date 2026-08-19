import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../primitives/PressableScale';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { formatShoppingPrice, shoppingCatalogChips } from '../../lib/shoppingPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';

/** Wide enough for the photograph to carry the card, narrow enough that the next one peeks. */
const CARD_WIDTH = 224;

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
          <Text style={styles.seeAllLabel}>See all {totalCount} pieces</Text>
        </PressableScale>
      ) : null}
    </ScrollView>
  );
}

function ShortlistFindCard({ item, onPress }: { item: ShoppingEditItem; onPress: () => void }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const currencyCode = useCurrencyCode();
  const price = formatShoppingPrice(item.extractedPrice, currencyCode);
  const place = cardPlaceLabel(item);
  const catalogChips = shoppingCatalogChips(item);
  // What the piece is, in the user's own terms — never the photo bookkeeping the
  // gallery falls back to, which tells you nothing about whether to buy it.
  const description = catalogChips.length > 0
    ? catalogChips.join(' · ')
    : item.notes?.trim() || 'No details yet';

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
      accessibilityLabel={[item.storeName ?? 'Shopping find', place, price, description].filter(Boolean).join(', ')}
      accessibilityHint="Opens this find in your shortlist"
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
            <Ionicons name="albums-outline" size={13} color="#FFFFFF" />
            <Text style={styles.photoCountText}>{item.photoCount}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.copy}>
        <Text style={styles.store} numberOfLines={1}>{item.storeName ?? 'Store not set'}</Text>
        <View style={styles.placeRow}>
          <Ionicons name="location-outline" size={11} color={colors.mutedForeground} />
          <Text style={styles.place} numberOfLines={1}>{place || 'Location not set'}</Text>
        </View>
        <Text style={[styles.price, !price && styles.priceMissing]} numberOfLines={1}>
          {price ?? 'Needs price'}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>{description}</Text>
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
  // Flex so every card takes the tallest card's height: a two-line description
  // on one find must not leave the rail's bottom edge ragged.
  card: {
    flex: 1,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceElevated,
    boxShadow: '0 2px 8px rgba(40, 35, 31, 0.06)',
  },
  imageFrame: {
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderCurve: 'continuous',
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
    minWidth: 34,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    backgroundColor: 'rgba(24, 20, 18, 0.62)',
  },
  photoCountText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.bold,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  copy: { gap: 3, padding: spacing.md },
  store: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  place: { flex: 1, fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  price: {
    paddingTop: 2,
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  priceMissing: { color: colors.primary },
  description: { ...typography.text.caption, color: colors.mutedForeground },
  seeAllCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
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
  seeAllLabel: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.action,
    textAlign: 'center',
  },
});
