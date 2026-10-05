import { StyleSheet, Text, View } from 'react-native';
import { humanizeInlineTokens, splitPriceRange, targetOutfitIdeas, type ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import type { Item } from '../../types/item';
import { colors, spacing, typography } from '../../theme';
import { ShoppingStyleVisual } from './ShoppingStyleVisual';
import { ShoppingOutfitPreview } from './ShoppingOutfitPreview';
import { ShoppingRetailerLinks } from './ShoppingRetailerLinks';
import { ShoppingOfferRail } from './ShoppingOfferRail';

type Props = {
  target: ShoppingPriorityTarget;
  index: number;
  wardrobe: ReadonlyMap<number, Item>;
  displayTitle?: string;
  isLast?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onSaveFind?: () => void;
  offerContext?: import("../../types/commerce").OfferContext;
  onRetryOffers?: () => void;
};
export function ShoppingPriorityTargetCard({ target, wardrobe, displayTitle, isLast, offerContext, onRetryOffers }: Props) {
  const looks = targetOutfitIdeas(target).filter(look => look.itemIds.some(id => wardrobe.has(id)));
  const offers = target.offers ?? [];
  const price = splitPriceRange(target.priceRange);
  const notes = target.shoppingNotes?.length ? target.shoppingNotes : [
    target.color && `Colour: ${humanizeInlineTokens(target.color)}`,
    target.material && `Material: ${humanizeInlineTokens(target.material)}`,
    target.silhouette && `Shape: ${humanizeInlineTokens(target.silhouette)}`,
  ].filter((note): note is string => !!note);
  const hasShop = !!(target.offerState || offers.length || target.productUrl || target.retailerExamples?.length);
  return <View style={[styles.card, isLast && styles.last]}>
    <View style={styles.heading}>
      <View style={styles.visual}><ShoppingStyleVisual target={target} /></View>
      <View style={styles.identity}>
        <Text accessibilityRole="header" style={styles.title}>{displayTitle || target.title}</Text>
        {price.compact ? <Text style={styles.caption}>Suggested budget · {price.compact}{price.currency ? ` ${price.currency}` : ''}</Text> : null}
      </View>
    </View>
    {target.rationale ? <Text selectable style={styles.copy}>{humanizeInlineTokens(target.rationale)}</Text> : null}
    {looks.length ? <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.label}>With your wardrobe</Text>
      {looks.map((look, index) => <ShoppingOutfitPreview key={`${target.key}-${index}`} look={look} target={target} wardrobe={wardrobe} />)}
    </View> : null}
    {hasShop ? <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.label}>Pieces to consider</Text>
      {target.offerState || offers.length ? <ShoppingOfferRail offers={offers} status={target.offerState?.status} context={offerContext} onRetry={onRetryOffers} targetKey={target.key} targetTitle={target.title} target={target} wardrobe={wardrobe} /> : <ShoppingRetailerLinks target={target} />}
      {!offers.length && target.offerState && target.offerState.status !== 'pending' ? <ShoppingRetailerLinks target={target} /> : null}
    </View> : null}
    {notes.length ? <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.label}>What to look for</Text>
      {notes.map((note, index) => <Text key={index} selectable style={styles.copy}>{humanizeInlineTokens(note)}</Text>)}
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { paddingVertical: spacing.xl, gap: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  last: { borderBottomWidth: 0 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }, visual: { width: 80 }, identity: { flex: 1, minWidth: 150, gap: spacing.sm },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  caption: { ...typography.text.caption, color: colors.mutedForeground },
  copy: { ...typography.text.bodySmall, color: colors.inkSubtle },
  label: { ...typography.text.label, color: colors.foreground }, section: { gap: spacing.md },
});
