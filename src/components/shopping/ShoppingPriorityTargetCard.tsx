import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import { shoppingAccent } from '../../lib/shoppingAccent';
import { ShoppingSurfaceLight } from './ShoppingSurfaceLight';
import { getSwatchColor } from '../../lib/colorUtils';
import { itemCoverPresentation } from '../../lib/itemImage';
import { track } from '../../lib/analytics';
import { PressableScale } from '../primitives/PressableScale';
import { ShoppingOfferRail } from './ShoppingOfferRail';
import { shoppingSurfaces, colors, cutoutScaleFor, editorial, radii, spacing, typography } from '../../theme';
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
  /** Open on arrival. The first card on a guide opens itself, so the looks
   *  strip — the reason to trust the recommendation — is on the first screen
   *  rather than behind three identical chevrons. */
  defaultExpanded?: boolean;
  /** "Found one? Save it" — the bridge from this guide to the shortlist.
   *  Omitted where the guide is read-only (a saved copy, for instance). */
  onSaveFind?: () => void;
};

const cardSpring = LinearTransition.springify().damping(16).stiffness(200);
/** Width of the number rail. Wide enough for a tabular "01" in the editorial
 *  numeral, narrow enough that the text column still owns the card. Shared
 *  with ShoppingPriorityRow so the brief and the edit number on one grid. */
const RAIL_WIDTH = 26;
/** Contact-sheet tile width in the looks strip. */
const TILE_WIDTH = 64;

/**
 * One curated direction, collapsed to a decision unit.
 *
 * At rest the card carries only what you choose between — name, why, and a
 * single meta line — so all three directions sit in roughly one screenful.
 * Silhouette, material, retailers, live offers and the wardrobe pairings are
 * real but secondary, and open in place rather than competing for the same
 * glance.
 *
 * The sequence number and the direction's colour live together in a left
 * rail; the expand affordance is a chevron at the foot of the text column,
 * under the price. That keeps the right margin flush — which is what lets the
 * price sit in its own column across all three cards — and reads as a
 * numbered edit rather than a list of rows to configure.
 */
export function ShoppingPriorityTargetCard({ target, index, wardrobe, displayTitle, isLast, defaultExpanded = false, onSaveFind }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const expandTracked = useRef(false);
  const reduceMotion = useReducedMotion();
  const swatch = getSwatchColor(target.color);
  const accent = shoppingAccent(target.color);
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
  const metaAccessible = [target.color, `Suggested budget ${price.compact}${price.currency ? ` ${price.currency}` : ''}`, ...metaSegments.slice(1)]
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
        motion="crisp"
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={`Style ${index}: ${title}. ${metaAccessible}`}
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
            <ColorSpine primary={accent.accent} />
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
              <Text style={styles.metaText}>{metaSegments.join(' · ')}</Text>
              {price.compact ? (
                <Text style={styles.metaPrice}>Budget {price.compact}{price.currency ? ` ${price.currency}` : ''}</Text>
              ) : null}
            </View>
            <View style={styles.disclosureRow}>
              <Text style={styles.disclosureLabel}>{expanded ? 'Less' : looks.length > 0 ? 'See outfit ideas & details' : 'See style details'}</Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.mutedForeground}
                style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
              />
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
            {target.productUrl || target.retailerExamples.length > 0 ? (
              // Tappable only once a product-matching layer populates productUrl
              // (see the commerce-seam comment on ShoppingPriorityTarget) — until
              // then this stays the same inert text it always was, since
              // retailerExamples are "suitable places to look", never
              // availability claims.
              target.productUrl ? (
                <PressableScale
                  haptic={false}
                  motion="crisp"
                  scaleTo={0.985}
                  onPress={() => {
                    track('shopping_brief_product_opened', { targetKey: target.key, merchant: target.merchant ?? null });
                    void WebBrowser.openBrowserAsync(target.productUrl!);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={target.merchant ? `View at ${target.merchant}` : `View ${target.title}`}
                >
                  <InlineDetail label={target.merchant ? `View at ${target.merchant}` : 'View product'} value={target.title} linked />
                </PressableScale>
              ) : (
                <RetailerChips retailers={target.retailerExamples} query={target.title} targetKey={target.key} />
              )
            ) : null}
          </View>

          {looks.length > 0 ? (
            <View style={styles.looksSection}>
              <Text style={styles.looksLabel}>
                {looks.length === 1 ? 'A look this unlocks' : 'Looks this unlocks'}
              </Text>
              {looks.map((look, lookIndex) => (
                <UnlockedLook
                  key={`${look.label}-${lookIndex}`}
                  look={look}
                  newPiece={title}
                  targetTitle={target.title}
                  wardrobe={wardrobe}
                  swatch={swatch}
                  wash={accent.wash}
                />
              ))}
            </View>
          ) : null}

          {onSaveFind ? (
            <PressableScale
              haptic={false}
              motion="crisp"
              scaleTo={0.985}
              contentStyle={styles.saveFind}
              onPress={onSaveFind}
              accessibilityRole="button"
              accessibilityLabel={`Found a ${title}? Save it to your shortlist`}
              accessibilityHint="Opens the camera to photograph the piece"
            >
              <Ionicons name="camera-outline" size={15} color={shoppingSurfaces.olive.accent} />
              <Text style={styles.saveFindLabel}>Found one? Save it to your shortlist</Text>
              <Ionicons name="arrow-forward" size={13} color={shoppingSurfaces.olive.accent} />
            </PressableScale>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/**
 * "Where to look" as chips rather than a run of inert text. There is no
 * product link yet at this seam, so each chip opens a web search for the
 * retailer and the piece — a real next step, honestly labelled as a search,
 * not an availability claim.
 */
function RetailerChips({ retailers, query, targetKey }: { retailers: string[]; query: string; targetKey: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>Where to look</Text>
      <View style={styles.chipRow}>
        {retailers.map((retailer) => (
          <PressableScale
            key={retailer}
            haptic={false}
            motion="crisp"
            scaleTo={0.97}
            contentStyle={styles.chip}
            onPress={() => {
              track('shopping_brief_retailer_searched', { targetKey, retailer });
              void WebBrowser.openBrowserAsync(`https://www.google.com/search?q=${encodeURIComponent(`${retailer} ${query}`)}`);
            }}
            accessibilityRole="link"
            accessibilityLabel={`Search ${retailer} for ${query}`}
          >
            <Text style={styles.chipLabel}>{retailer}</Text>
            <Ionicons name="search-outline" size={12} color={shoppingSurfaces.olive.accent} />
          </PressableScale>
        ))}
      </View>
    </View>
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
        {linked ? <Ionicons name="open-outline" size={13} color={shoppingSurfaces.olive.accent} /> : null}
      </View>
    </View>
  );
}

/**
 * One complete look as a contact sheet: the look's name, then a strip of
 * tiles with a caption under each — the piece you'd buy first, as an empty
 * frame holding only its colour, then the pieces you already own.
 *
 * Tiles are a fixed width rather than flexed, so a two-piece look does not
 * blow its images up to fill the row — the group's size should say how many
 * pieces it takes, not how much space is going spare. Past four the strip
 * scrolls rather than wrapping.
 */
function UnlockedLook({
  look,
  newPiece,
  targetTitle,
  wardrobe,
  swatch,
  wash,
}: {
  look: ShoppingPriorityOutfitIdea;
  newPiece: string;
  targetTitle: string;
  wardrobe: ReadonlyMap<number, Item>;
  swatch: { primary: string; secondary?: string };
  wash: string;
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
      <ScrollView
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lookStrip}
      >
        <View style={styles.tile}>
          <View style={[styles.ghostFrame, { backgroundColor: wash }]}>
            <View style={[styles.ghostSwatch, { backgroundColor: swatch.primary }]} />
          </View>
          {/* "+ Tan Leather Sneaker": the one frame in the strip that is not
              yet in the wardrobe, said so, rather than an unlabeled swatch. */}
          <Text style={[styles.tileCaption, styles.tileCaptionNew]} numberOfLines={2}>+ {newPiece}</Text>
        </View>
        {pieces.map(({ id, item }, pieceIndex) => (
          <View key={id} style={styles.tile}>
            <WardrobeThumbnail item={item} />
            <Text style={styles.tileCaption} numberOfLines={2}>{names[pieceIndex]}</Text>
          </View>
        ))}
      </ScrollView>
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
      {(!cover.uri || imageFailed || cover.isCatalogStyle) ? <ShoppingSurfaceLight tile /> : null}
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
  // No horizontal padding of its own: the screen's content gutter is the
  // margin, so the numeral rail lines up with the hero and the deck above.
  card: {
    paddingVertical: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  cardLast: { borderBottomWidth: 0 },
  heading: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  rail: { width: RAIL_WIDTH, alignItems: 'center', gap: spacing.sm, paddingTop: 4, paddingBottom: 2 },
  railNumber: { ...typography.text.editorialNumeral, color: colors.mutedForeground },
  spine: {
    width: 3,
    flex: 1,
    minHeight: 24,
    overflow: 'hidden',
    borderRadius: radii.full,
    backgroundColor: colors.hairline,
  },
  spineHalf: { flex: 1 },
  headingBody: { flex: 1, minWidth: 0, gap: spacing.sm },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  rationale: { ...typography.text.body, color: shoppingSurfaces.secondaryInk },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  // One grey for the descriptors, ink for the number: the price is the axis
  // the three directions are compared on, so it is the one thing in the row
  // set in the foreground colour.
  metaText: { flexGrow: 1, flexShrink: 1, flexBasis: 120, ...typography.text.meta, color: colors.mutedForeground },
  // Fixed width so the three directions' prices stack into one column rather
  // than drifting with the length of the colour name beside them.
  metaPrice: { minWidth: 78, textAlign: 'right', ...typography.text.data, color: colors.foreground },
  disclosureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minHeight: 24 },
  disclosureLabel: { ...typography.text.caption, color: colors.mutedForeground },
  // Indented to the text column so the rail keeps reading as one spine down
  // the whole card, open or closed.
  body: { gap: spacing.xl, paddingTop: spacing.md, paddingLeft: RAIL_WIDTH + spacing.md },
  details: { gap: spacing.lg },
  detailRow: { gap: spacing.xs, minHeight: 44, justifyContent: 'center' },
  detailLabel: { ...typography.text.meta, color: colors.mutedForeground },
  detailValueRow: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailValue: { flexShrink: 1, ...typography.text.bodySmall, lineHeight: 20, color: shoppingSurfaces.secondaryInk },
  detailValueLinked: { color: shoppingSurfaces.olive.accent, fontWeight: typography.weight.medium },
  looksSection: { gap: spacing.lg },
  looksLabel: { ...typography.text.meta, color: colors.mutedForeground },
  look: { gap: spacing.sm },
  lookLabel: { ...typography.text.label, color: colors.foreground },
  lookStrip: { flexDirection: 'row', gap: spacing.md, paddingRight: spacing.lg },
  tile: { width: TILE_WIDTH, gap: 6 },
  // Reference marks under a look name, not hero imagery: a contact-sheet
  // frame, flat plate, hairline edge, no rounding beyond `photo`. Rounded
  // corners are for controls, and these are photographs.
  thumbnail: {
    width: '100%',
    aspectRatio: editorial.garmentAspectRatio,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.photo,
    backgroundColor: shoppingSurfaces.bone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shoppingSurfaces.edge,
  },
  catalogThumbnail: { padding: spacing.xs },
  // The piece you'd buy: the same frame, empty, holding only its colour.
  ghostFrame: {
    width: '100%',
    aspectRatio: editorial.garmentAspectRatio,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.photo,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: shoppingSurfaces.edge,
  },
  ghostSwatch: { width: 10, height: 10, borderRadius: radii.full },
  tileCaption: { fontSize: 11, lineHeight: 14, color: colors.mutedForeground },
  tileCaptionNew: { color: shoppingSurfaces.olive.accent, fontWeight: typography.weight.medium },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shoppingSurfaces.edge,
    backgroundColor: shoppingSurfaces.alabaster,
  },
  chipLabel: { ...typography.text.bodySmall, color: shoppingSurfaces.olive.accent, fontWeight: typography.weight.medium },
  saveFind: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs },
  saveFindLabel: { ...typography.text.bodySmall, fontWeight: typography.weight.semibold, color: shoppingSurfaces.olive.accent },
});
