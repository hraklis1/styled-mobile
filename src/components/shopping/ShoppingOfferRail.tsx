import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { track } from '../../lib/analytics';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, spacing, typography } from '../../theme';
import type { ProductOffer } from '../../types/commerce';

/** Narrow enough that a third card peeks: these support a direction, they are not it. */
const CARD_WIDTH = 152;

/**
 * Real, buyable pieces for one shopping target.
 *
 * Deliberately subordinate to the target it sits under. The Shopping Brief's
 * recommendation is a wardrobe capability the coverage math decided on
 * (server/shoppingOpportunities.ts); these are merely places to satisfy it, so
 * they read as a supporting rail rather than the headline. If the rail is
 * empty the target still stands on its own — that is the normal resting state
 * whenever no product source is configured.
 */
export function ShoppingOfferRail({
  offers,
  targetKey,
  targetTitle,
}: {
  offers: ProductOffer[];
  targetKey: string;
  /** Named in the rail's accessibility label so the rail is not orphaned. */
  targetTitle: string;
}) {
  if (offers.length === 0) return null;

  // The disclosure is driven by the offers actually on screen, never by
  // configuration: a rail of unmonetized results must not claim a commission,
  // and one monetized result is enough to require the notice.
  const earnsCommission = offers.some((offer) => offer.monetized);

  return (
    <View
      style={styles.section}
      accessibilityRole="summary"
      accessibilityLabel={`${offers.length} available now for ${targetTitle}`}
    >
      <View style={styles.header}>
        <Text style={styles.label}>Available now</Text>
        <Text style={styles.count}>{offers.length}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + spacing.sm}
        snapToAlignment="start"
        style={styles.rail}
        contentContainerStyle={styles.railContent}
      >
        {offers.map((offer, index) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            onPress={() => {
              track('shopping_brief_product_opened', {
                targetKey,
                merchant: offer.merchant,
                offerId: offer.id,
                provider: offer.provider,
                position: index,
                monetized: offer.monetized,
              });
              void WebBrowser.openBrowserAsync(offer.url);
            }}
          />
        ))}
      </ScrollView>

      {earnsCommission ? (
        <Text style={styles.disclosure}>
          We may earn a commission on these links. It never affects what we recommend.
        </Text>
      ) : null}
    </View>
  );
}

function OfferCard({ offer, onPress }: { offer: ProductOffer; onPress: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [offer.imageUrl]);

  return (
    <PressableScale
      scaleTo={0.98}
      style={styles.cardLayout}
      contentStyle={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[offer.title, offer.merchant, offer.formattedPrice].filter(Boolean).join(', ')}
      accessibilityHint={`Opens ${offer.merchant} in your browser`}
    >
      <View style={styles.imageFrame}>
        {offer.imageUrl && !imageFailed ? (
          <Image
            source={{ uri: offer.imageUrl }}
            style={StyleSheet.absoluteFill}
            // Uniformly cropped: a rail of ragged letterboxes reads cheap, and
            // merchant photography arrives in every aspect ratio there is.
            contentFit="cover"
            contentPosition="center"
            transition={180}
            cachePolicy="memory-disk"
            recyclingKey={offer.id}
            accessible={false}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="pricetag-outline" size={22} color={colors.mutedForeground} />
          </View>
        )}
        {offer.inStock === false ? (
          <View style={styles.stockPill}>
            <Text style={styles.stockText}>Out of stock</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.copy}>
        <Text style={styles.merchant} numberOfLines={1}>{offer.merchant}</Text>
        <Text style={styles.title} numberOfLines={2}>{offer.title}</Text>
        <View style={styles.footer}>
          <Text style={styles.price} numberOfLines={1}>
            {offer.formattedPrice || 'See price'}
          </Text>
          <Ionicons name="open-outline" size={12} color={colors.action} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  label: { ...typography.text.eyebrow, color: colors.mutedForeground },
  count: { ...typography.text.caption, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  // Full bleed: the rail runs past the card's gutter so it reads as continuing
  // off-screen, matching ShortlistCarousel.
  rail: { marginHorizontal: -spacing.lg },
  railContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  cardLayout: { width: CARD_WIDTH },
  // Flex so every card takes the tallest card's height — a two-line title on
  // one offer must not leave the rail's bottom edge ragged.
  card: {
    flex: 1,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  imageFrame: {
    aspectRatio: 1,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
  },
  imageFallback: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockPill: {
    position: 'absolute',
    left: spacing.xs,
    bottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: 'rgba(29, 27, 24, 0.72)',
  },
  stockText: { ...typography.text.caption, fontSize: 10, color: colors.white },
  copy: { flex: 1, gap: 2, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  merchant: { ...typography.text.eyebrow, fontSize: 9, color: colors.mutedForeground },
  title: { flex: 1, fontSize: 12, lineHeight: 16, color: colors.foreground },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  price: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.foreground, fontVariant: ['tabular-nums'] },
  disclosure: { ...typography.text.caption, fontSize: 11, lineHeight: 15, color: colors.mutedForeground },
});
