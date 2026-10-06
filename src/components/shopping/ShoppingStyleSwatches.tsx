import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, shoppingSurfaces, spacing, typography } from '../../theme';
import { targetOutfitIdeas, type ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import type { Item } from '../../types/item';
import { ShoppingStyleVisual } from './ShoppingStyleVisual';

/** Distinct owned pieces the style's outfit ideas actually draw on. */
export function ownedPairingCount(target: ShoppingPriorityTarget, wardrobe: ReadonlyMap<number, Item>) {
  return new Set(targetOutfitIdeas(target).flatMap(look => look.itemIds).filter(id => wardrobe.has(id))).size;
}

/**
 * Whole units with the symbol once ("CA$105–250"), so a span fits one line
 * of a three-across tile. Falls back to the retailer's own formatting when
 * the symbol isn't a plain prefix (e.g. "105,00 €").
 */
function compactPrice(low: { price: number; formattedPrice: string }, high: { price: number; formattedPrice: string }) {
  const prefix = (formatted: string) => formatted.slice(0, formatted.search(/\d/));
  const symbol = prefix(low.formattedPrice);
  const whole = (price: number) => Math.round(price).toLocaleString('en-US');
  if (!symbol || symbol !== prefix(high.formattedPrice) || /\d\s*\D+$/.test(low.formattedPrice))
    return low.formattedPrice === high.formattedPrice ? low.formattedPrice : `${low.formattedPrice}–${high.formattedPrice}`;
  const [from, to] = [whole(low.price), whole(high.price)];
  return from === to ? `${symbol}${from}` : `${symbol}${from}–${to}`;
}

/** What the real listings cost, cheapest to dearest. */
export function offerPriceSpan(target: ShoppingPriorityTarget) {
  const priced = (target.offers ?? []).filter(offer => offer.inStock !== false && offer.price != null && offer.formattedPrice)
    .sort((a, b) => a.price! - b.price!);
  if (!priced.length) return null;
  const low = priced[0], high = priced[priced.length - 1];
  return compactPrice({ price: low.price!, formattedPrice: low.formattedPrice }, { price: high.price!, formattedPrice: high.formattedPrice });
}

/**
 * The guide's directions side by side, so the real decision — which one —
 * is made by comparing, not by scrolling three chapters. Tap jumps to one.
 */
export function ShoppingStyleSwatches({ targets, budgets, wardrobe, onSelect }: {
  targets: ShoppingPriorityTarget[];
  /** Per-target budget, present only where it differs from the guide's shared budget. */
  budgets?: Record<string, string | undefined>;
  wardrobe?: ReadonlyMap<number, Item>;
  onSelect: (key: string) => void;
}) {
  const { fontScale } = useWindowDimensions();
  // Every title reserves two lines, so prices sit on one baseline across the row.
  const titleHeight = styles.title.lineHeight! * 2 * fontScale;
  const columns = targets.length === 2 || targets.length === 4 ? 2 : 3;
  const pairings = targets.map(target => wardrobe ? ownedPairingCount(target, wardrobe) : 0);
  const best = Math.max(0, ...pairings);
  // Only call one out when it genuinely leads.
  const versatileKey = best > 0 && pairings.filter(count => count === best).length === 1 ? targets[pairings.indexOf(best)].key : null;
  return <View style={styles.grid}>
    {targets.map((target, index) => {
      const price = offerPriceSpan(target) ?? budgets?.[target.key];
      const details = price ? [price] : [];
      return <Pressable key={target.key} onPress={() => onSelect(target.key)}
        accessibilityRole="button" accessibilityLabel={[target.title, versatileKey === target.key ? 'Most versatile' : null, ...details].filter(Boolean).join(', ')} accessibilityHint="Jumps to this style"
        style={({ pressed }) => [styles.tile, { width: `${100 / columns}%` }, pressed && styles.pressed]}>
        <View style={styles.inner}>
          <ShoppingStyleVisual plain fill target={target} />
          {versatileKey ? <Text style={styles.flag} accessibilityElementsHidden={versatileKey !== target.key}>{versatileKey === target.key ? 'Most versatile' : ' '}</Text> : null}
          <Text style={[styles.title, { minHeight: titleHeight }]} numberOfLines={2}>{target.title}</Text>
          {details.map(detail => <Text key={detail} style={styles.detail}>{detail}</Text>)}
        </View>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, rowGap: spacing.lg },
  tile: { paddingHorizontal: spacing.xs },
  inner: { gap: spacing.xs },
  pressed: { opacity: 0.6 },
  flag: { ...typography.text.meta, color: shoppingSurfaces.olive.accent, paddingTop: spacing.xs },
  title: { ...typography.text.cardTitle, color: colors.foreground },
  detail: { ...typography.text.meta, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
});
