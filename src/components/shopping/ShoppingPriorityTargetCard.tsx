import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import { getSwatchColor } from '../../lib/colorUtils';
import { itemCoverPresentation } from '../../lib/itemImage';
import { track } from '../../lib/analytics';
import { PressableScale } from '../primitives/PressableScale';
import { ShoppingOfferRail } from './ShoppingOfferRail';
import { colors, cutoutScaleFor, radii, spacing, typography } from '../../theme';
import {
  humanizeInlineTokens,
  splitPriceRange,
  targetOutfitIdeas,
  type ShoppingPriorityOutfitIdea,
  type ShoppingPriorityTarget,
} from '../../lib/shoppingPriorityEdit';
import type { Item } from '../../types/item';

type Props = {
  target: ShoppingPriorityTarget;
  index: number;
  wardrobe: ReadonlyMap<number, Item>;
  /** Title with a category noun the page already states removed — see
   *  shoppingPriorityTargetDisplayTitle. The raw `target.title` is still what
   *  reaches offers and analytics. */
  displayTitle?: string;
  /** The last card sits directly above the currency note and the save band,
   *  which already draw their own rules. */
  isLast?: boolean;
};

const cardSpring = LinearTransition.springify().damping(16).stiffness(200);
// A touch lighter than mutedForeground — the expand affordance should be
// legible, not a competing focal point at the foot of the number rail.
const toggleColor = `${colors.mutedForeground}B3`;
/** Width of the number rail. Wide enough for a tabular "01" at caption size,
 *  narrow enough that the text column still owns the card. */
const RAIL_WIDTH = 26;

/**
 * One curated direction, collapsed to a decision unit.
 *
 * At rest the card carries only what you choose between — name, why, and a
 * single meta line — so all three directions sit in roughly one screenful.
 * Silhouette, material, retailers, live offers and the wardrobe pairings are
 * real but secondary, and open in place rather than competing for the same
 * glance.
 *
 * The sequence number, the direction's colour and the expand affordance live
 * together in a left rail rather than as an eyebrow and a right-hand chevron.
 * That keeps the right margin flush — which is what lets the price sit in its
 * own column across all three cards — and reads as a numbered edit rather than
 * a list of rows to configure.
 */
export function ShoppingPriorityTargetCard({ target, index, wardrobe, displayTitle, isLast }: Props) {
  const [expanded, setExpanded] = useState(false);
  const expandTracked = useRef(false);
  const reduceMotion = useReducedMotion();
  const swatch = getSwatchColor(target.color);
  const looks = targetOutfitIdeas(target);
  // Absent whenever no product source is configured, which is the resting
  // state — the target reads exactly as it always has in that case.
  const offers = target.offers ?? [];
  const price = splitPriceRange(target.priceRange);
  const rationale = humanizeInlineTokens(target.rationale);
  const title = displayTitle || target.title;
  const specification = [target.material, target.silhouette].filter(Boolean).join(' · ');

  // Material is deliberately left out here — it's the longest, most
  // variable-length segment, and was the one reliably forcing this row to
  // wrap onto a second line and throwing off card heights across the list.
  // It still lives in the expanded body below, it's just not load-bearing
  // for picking between directions at a glance.
  //
  // Price is *not* in this run: it is the one axis the three directions are
  // actually compared on, and inside a joined string it lands at a different
  // x-position on every card. It gets its own right-aligned column below.
  const metaSegments = [
    target.color,
    looks.length > 0 ? `${looks.length} look${looks.length === 1 ? '' : 's'}` : null,
    offers.length > 0 ? `${offers.length} available now` : null,
  ].filter((segment): segment is string => Boolean(segment));
  const metaAccessible = [target.color, price.compact, ...metaSegments.slice(1)]
    .filter(Boolean)
    .join(', ');

  const toggle = useCallback(() => {
    const next = !expanded;
    if (next && !expandTracked.current) {
      expandTracked.current = true;
      track('shopping_brief_direction_expanded', { targetKey: target.key, index });
    }
    setExpanded(next);
  }, [expanded, index, target.key]);

  return (
    <Animated.View style={[styles.card, isLast && styles.cardLast]} layout={reduceMotion ? undefined : cardSpring}>
      <PressableScale
        scaleTo={0.985}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={`Direction ${index}: ${title}. ${metaAccessible}`}
        accessibilityHint={expanded ? 'Collapses the details' : 'Shows material, silhouette, where to look and wardrobe pairings'}
        accessibilityState={{ expanded }}
      >
        <View style={styles.heading}>
          <View
            style={styles.rail}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.railNumber}>{String(index).padStart(2, '0')}</Text>
            <ColorSpine primary={swatch.primary} secondary={swatch.secondary} />
            <Ionicons name={expanded ? 'remove' : 'add'} size={12} color={toggleColor} />
          </View>

          <View style={styles.headingBody}>
            <Text style={styles.title}>{title}</Text>
            {/* Four, not two: the server asks the model for under 28 words and
                hard-caps the field at 240 chars, which is ~4 lines in this
                column. At two, most rationales visibly cut mid-word — the
                cheapest-looking thing on the page, and pointless when the card
                expands anyway. */}
            <Text style={styles.rationale} numberOfLines={expanded ? undefined : 4}>{rationale}</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaText} numberOfLines={1}>{metaSegments.join('  ·  ')}</Text>
              {price.compact ? (
                <Text style={styles.metaPrice} numberOfLines={1}>{price.compact}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </PressableScale>

      {expanded ? (
        <Animated.View
          style={styles.body}
          entering={reduceMotion ? undefined : FadeIn.duration(150)}
          exiting={reduceMotion ? undefined : FadeOut.duration(100)}
          layout={reduceMotion ? undefined : cardSpring}
        >
          {offers.length > 0 ? (
            <ShoppingOfferRail offers={offers} targetKey={target.key} targetTitle={target.title} />
          ) : null}

          <View style={styles.details}>
            {/* Material and silhouette were two label/value pairs, four lines
                between them, for what is one specification read as a single
                thought. */}
            {specification ? <InlineDetail label="Specification" value={specification} /> : null}
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

          {looks.length > 0 ? (
            <View style={styles.looksSection}>
              <Text style={styles.looksLabel}>
                {looks.length === 1 ? 'A look this unlocks' : 'Looks this unlocks'}
              </Text>
              {looks.map((look, lookIndex) => (
                <OutfitIdea
                  key={`${look.label}-${lookIndex}`}
                  look={look}
                  targetTitle={target.title}
                  wardrobe={wardrobe}
                />
              ))}
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/**
 * The direction's colour as a vertical rule down the number rail.
 *
 * This replaces a 10pt dot that sat inline in the meta row, where it lost a
 * fight with the caption text beside it. The directions genuinely differ by
 * colour, so it earns a full-height mark — and stretching it between the
 * number and the toggle is what makes the rail read as one spine.
 */
function ColorSpine({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <View style={styles.spine}>
      <View style={[styles.spineHalf, { backgroundColor: primary }]} />
      {secondary ? <View style={[styles.spineHalf, { backgroundColor: secondary }]} /> : null}
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

/**
 * One complete look, read as a recipe: a name, the pieces, then the pieces
 * spelled out.
 *
 * Thumbnails are a fixed width rather than flexed, so a two-piece look does
 * not blow its images up to fill the row — the group's size should say how
 * many pieces it takes, not how much space is going spare.
 */
function OutfitIdea({
  look,
  targetTitle,
  wardrobe,
}: {
  look: ShoppingPriorityOutfitIdea;
  targetTitle: string;
  wardrobe: ReadonlyMap<number, Item>;
}) {
  const pieces = look.itemIds.map((id) => ({ id, item: wardrobe.get(id) }));
  const names = pieces.map(({ item }) => item?.name ?? 'a piece no longer in your closet');

  return (
    <View
      style={styles.look}
      accessible
      accessibilityLabel={`${look.label || 'Look'} with ${targetTitle}: ${names.join(', ')}`}
    >
      {look.label ? <Text style={styles.lookLabel}>{look.label}</Text> : null}
      <View style={styles.lookRow}>
        {pieces.map(({ id, item }) => (
          <View key={id} style={styles.lookThumb}>
            <WardrobeThumbnail item={item} />
          </View>
        ))}
      </View>
      <Text style={styles.lookPieces} numberOfLines={2}>{names.join('  +  ')}</Text>
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
            // Catalog-style covers are subjects on an empty ground, so they get
            // inset on the tile the way wardrobe rows do it; a plain photo is a
            // crop and still fills its frame. Without the split, a cutout on
            // white sits next to an edge-to-edge snapshot and the row stops
            // reading as one set.
            cover.isCatalogStyle && styles.catalogThumbnail,
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
        <Ionicons name="shirt-outline" size={18} color={colors.mutedForeground} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  cardLast: { borderBottomWidth: 0 },
  heading: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  rail: { width: RAIL_WIDTH, alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  railNumber: {
    ...typography.text.caption,
    color: colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  spine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    overflow: 'hidden',
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  spineHalf: { flex: 1 },
  headingBody: { flex: 1, minWidth: 0, gap: spacing.sm },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  rationale: { fontSize: typography.text.body.fontSize, lineHeight: 22, color: colors.inkSubtle },
  metaRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.text.caption.fontSize,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  // Fixed width so the three directions' prices stack into one column rather
  // than drifting with the length of the colour name beside them.
  metaPrice: {
    minWidth: 78,
    textAlign: 'right',
    fontSize: typography.text.caption.fontSize,
    lineHeight: 18,
    color: colors.inkSubtle,
    fontVariant: ['tabular-nums'],
  },
  // Indented to the text column so the rail keeps reading as one spine down
  // the whole card, open or closed.
  body: { gap: spacing.lg, paddingTop: spacing.lg, paddingLeft: RAIL_WIDTH + spacing.md },
  details: { gap: spacing.md },
  detailRow: { gap: 2 },
  detailLabel: { fontSize: typography.text.caption.fontSize, lineHeight: 16, color: colors.mutedForeground },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailValue: { fontSize: typography.text.bodySmall.fontSize, lineHeight: 20, color: colors.inkSubtle },
  detailValueLinked: { color: colors.action, fontWeight: typography.weight.medium },
  looksSection: { gap: spacing.lg },
  looksLabel: { fontSize: typography.text.caption.fontSize, lineHeight: 16, color: colors.mutedForeground },
  look: { gap: spacing.sm },
  lookLabel: {
    fontSize: typography.text.bodySmall.fontSize,
    lineHeight: 18,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  lookRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  // Reference marks under a look name, not hero imagery — at 64 they claimed
  // more attention than the mixed source photos can carry, and left a wide
  // dead gap at the right of a two-piece row.
  lookThumb: { width: 48 },
  lookPieces: { fontSize: typography.text.caption.fontSize, lineHeight: 16, color: colors.mutedForeground },
  thumbnail: {
    width: '100%',
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    // No border: on one shared ground the tiles already read as a set, and an
    // outline only re-emphasises how differently each source image is framed.
    backgroundColor: colors.surfaceSubtle,
  },
  catalogThumbnail: { padding: spacing.xs },
});
