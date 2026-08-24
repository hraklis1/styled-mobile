import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { getSwatchColor } from '../../lib/colorUtils';
import { itemCoverPresentation } from '../../lib/itemImage';
import { track } from '../../lib/analytics';
import { PressableScale } from '../primitives/PressableScale';
import { ShoppingOfferRail } from './ShoppingOfferRail';
import { colors, cutoutScaleFor, radii, shadows, spacing, typography } from '../../theme';
import type { ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import type { Item } from '../../types/item';

type Props = {
  target: ShoppingPriorityTarget;
  index: number;
  wardrobe: ReadonlyMap<number, Item>;
};

export function ShoppingPriorityTargetCard({ target, index, wardrobe }: Props) {
  const swatch = getSwatchColor(target.color);
  const pairs = target.pairsWithItemIds.map((id) => ({ id, item: wardrobe.get(id) }));
  // Absent whenever no product source is configured, which is the resting
  // state — the target reads exactly as it always has in that case.
  const offers = target.offers ?? [];

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Direction {String(index).padStart(2, '0')}</Text>
        <Text selectable style={styles.title}>{target.title}</Text>
        <Text selectable style={styles.rationale}>{target.rationale}</Text>
      </View>

      <View style={styles.specRow}>
        <View
          accessible
          accessibilityLabel={`Color: ${target.color}. Material: ${target.material}`}
          style={styles.colorMaterialSpec}
        >
          <ColorSwatch primary={swatch.primary} secondary={swatch.secondary} />
          <Text selectable style={styles.colorMaterialText}>
            <Text style={styles.specValueStrong}>{target.color}</Text>
            {'  ·  '}
            {target.material}
          </Text>
        </View>
        <View accessible accessibilityLabel={`Budget: ${target.priceRange}`} style={styles.budgetSpec}>
          <Text selectable style={styles.budgetText}>{target.priceRange}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <InlineDetail label="Silhouette" value={target.silhouette} />
        {target.retailerExamples.length > 0 ? (
          // Tappable only once a product-matching layer populates productUrl
          // (see the commerce-seam comment on ShoppingPriorityTarget) — until
          // then this stays the same inert text it always was, since
          // retailerExamples are "suitable places to look", never
          // availability claims.
          target.productUrl ? (
            <PressableScale
              haptic={false}
              onPress={() => {
                track('shopping_brief_product_opened', { targetKey: target.key, merchant: target.merchant ?? null });
                void WebBrowser.openBrowserAsync(target.productUrl!);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Shop ${target.title}${target.merchant ? ` at ${target.merchant}` : ''}`}
            >
              <InlineDetail label="Where to look" value={target.merchant ?? target.retailerExamples.join(' · ')} linked />
            </PressableScale>
          ) : (
            <InlineDetail label="Where to look" value={target.retailerExamples.join(' · ')} />
          )
        ) : null}
      </View>

      {offers.length > 0 ? (
        <ShoppingOfferRail offers={offers} targetKey={target.key} targetTitle={target.title} />
      ) : null}

      {pairs.length > 0 ? (
        <View style={styles.pairsSection}>
          <Text style={styles.pairsLabel}>Pairs from your wardrobe</Text>
          <View style={styles.pairsRow}>
            {pairs.map(({ id, item }) => (
              <WardrobePair key={id} item={item} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ColorSwatch({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <View
      style={styles.swatch}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.swatchHalf, { backgroundColor: primary }]} />
      {secondary ? <View style={[styles.swatchHalf, { backgroundColor: secondary }]} /> : null}
    </View>
  );
}

function InlineDetail({ label, value, linked }: { label: string; value: string; linked?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueRow}>
        <Text selectable={!linked} style={[styles.detailValue, linked && styles.detailValueLinked]}>{value}</Text>
        {linked ? <Ionicons name="open-outline" size={13} color={colors.action} /> : null}
      </View>
    </View>
  );
}

function WardrobePair({ item }: { item?: Item }) {
  return (
    <View style={styles.pair}>
      <WardrobeThumbnail item={item} />
      <Text selectable style={styles.pairName} numberOfLines={2}>
        {item?.name ?? 'Wardrobe piece unavailable'}
      </Text>
    </View>
  );
}

function WardrobeThumbnail({ item }: { item?: Item }) {
  const cover = itemCoverPresentation(item, { preferThumb: true });
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [cover.uri]);

  return (
    <View
      style={styles.thumbnail}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {cover.uri && !imageFailed ? (
        <Image
          source={{ uri: cover.uri }}
          style={[
            StyleSheet.absoluteFill,
            cover.variant === 'cutout' && { transform: [{ scale: cutoutScaleFor(item?.category) }] },
          ]}
          contentFit={cover.contentFit}
          contentPosition="center"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={item ? `${item.id}:${cover.variant}` : undefined}
          accessible={false}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Ionicons name="shirt-outline" size={22} color={colors.mutedForeground} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    ...shadows.xs,
  },
  heading: { gap: spacing.sm },
  eyebrow: { ...typography.text.eyebrow, color: colors.primary, fontVariant: ['tabular-nums'] },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  rationale: { fontSize: typography.text.body.fontSize, lineHeight: 22, color: colors.inkSubtle },
  specRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  colorMaterialSpec: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: {
    width: 18,
    height: 18,
    flexDirection: 'row',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  swatchHalf: { flex: 1 },
  colorMaterialText: { flex: 1, minWidth: 0, fontSize: typography.text.caption.fontSize, lineHeight: 18, color: colors.inkSubtle },
  specValueStrong: { fontWeight: typography.weight.medium },
  budgetSpec: { maxWidth: '42%', alignItems: 'flex-end' },
  budgetText: { textAlign: 'right', fontSize: typography.text.caption.fontSize, lineHeight: 18, fontWeight: typography.weight.semibold, color: colors.foreground },
  details: { gap: spacing.md },
  detailRow: { gap: spacing.xs },
  detailLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailValue: { fontSize: typography.text.bodySmall.fontSize, lineHeight: 20, color: colors.inkSubtle },
  detailValueLinked: { color: colors.action, fontWeight: typography.weight.medium },
  pairsSection: { gap: spacing.sm },
  pairsLabel: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  pairsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  pair: { flex: 1, minWidth: 0, gap: spacing.sm },
  thumbnail: {
    width: '100%',
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F0ECE5',
    backgroundColor: colors.surfaceSubtle,
  },
  pairName: { fontSize: typography.text.caption.fontSize, lineHeight: 16, color: colors.mutedForeground },
});
