import { StyleSheet, Text, View } from 'react-native';
import { displayBudget, humanizeInlineTokens, splitPriceRange, targetOutfitIdeas, targetShoppingNotes, type ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import type { Item } from '../../types/item';
import { colors, spacing, typography } from '../../theme';
import { useHiddenProducts } from '../../lib/productFeedback';
import { ShoppingStyleVisual } from './ShoppingStyleVisual';
import { ShoppingOutfitGroup, ShoppingOutfitPreview } from './ShoppingOutfitPreview';
import { ShoppingRetailerLinks } from './ShoppingRetailerLinks';
import { ShoppingOfferRail } from './ShoppingOfferRail';
import { ChapterHero, ChapterOpener, NextChapterLink, SectionKicker, SpecList, StylistAsk } from './ShoppingEditorialParts';
import { styleAskQuestions } from '../../lib/shoppingEditorial';

type Props = {
  target: ShoppingPriorityTarget;
  editorial?: boolean;
  headingRef?: (node: Text | null) => void;
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
  /** Editorial: the criteria are shown once for the whole guide. */
  hideCriteria?: boolean;
  /** Editorial: shown as the chapter's budget only when it differs from the guide's. */
  showBudget?: boolean;
  nextTitle?: string;
  onNext?: () => void;
  /** Editorial: asks the stylist about this style; the question is optional. */
  onAsk?: (question?: string) => void;
};
export function ShoppingPriorityTargetCard({ target, index, wardrobe, displayTitle, isLast, offerContext, onRetryOffers, editorial = false, headingRef, hideCriteria = false, showBudget = true, nextTitle, onNext, onAsk }: Props) {
  const hidden = useHiddenProducts();
  const looks = targetOutfitIdeas(target).filter(look => look.itemIds.some(id => wardrobe.has(id)));
  const offers = target.offers ?? [];
  const price = splitPriceRange(target.priceRange);
  const notes = targetShoppingNotes(target);
  // Cards note "In budget" even when the page states one shared budget above.
  const railBudget = price.compact && price.currency ? `${price.compact} ${price.currency}` : null;
  const hasShop = !!(target.offerState || offers.length || target.productUrl || target.retailerExamples?.length);
  const criteria = notes.length ? <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.label}>What to look for</Text>
      {notes.map((note, noteIndex) => <Text key={noteIndex} selectable style={styles.copy}>{note}</Text>)}
    </View> : null;
  if (editorial) {
    const budget = showBudget ? displayBudget(target.priceRange) || null : null;
    // The case for the style comes before its listings: decide on the
    // direction, then shop it. Without listings the illustrative hero stands
    // in and shopping falls back to the end.
    const productsLead = offers.length > 0 || target.offerState?.status === 'pending';
    const optionCount = offers.filter(offer => offer.inStock !== false && !hidden.has(offer.id)).length;
    const meta = [budget ? `Budget ${budget}` : null, productsLead && optionCount ? `${optionCount} ${optionCount === 1 ? 'option' : 'options'}` : null].filter(Boolean).join(' · ');
    return <View style={styles.editorialCard}>
      <ChapterOpener index={index} title={displayTitle || target.title} headingRef={headingRef} />
      {target.rationale || meta ? <View style={styles.hero}>
        {target.rationale ? <Text selectable style={styles.lede}>{humanizeInlineTokens(target.rationale)}</Text> : null}
        {meta && productsLead ? <Text style={styles.budget}>{meta}</Text> : null}
      </View> : null}
      {productsLead ? <ShoppingOfferRail budget={railBudget} hero editorial offers={offers} status={target.offerState?.status} context={offerContext} onRetry={onRetryOffers} targetKey={target.key} targetTitle={target.title} target={target} wardrobe={wardrobe} />
        : <ChapterHero target={target} budget={budget} />}
      {notes.length && !hideCriteria ? <View style={styles.section}><SectionKicker title="What to look for" /><SpecList notes={notes} /></View> : null}
      {looks.length ? <View style={styles.section}>
        <SectionKicker title="Ways to wear it" />
        {looks.length > 1 ? <ShoppingOutfitGroup looks={looks} target={target} wardrobe={wardrobe} />
          : <View style={styles.outfits}>{looks.map((look, lookIndex) => <ShoppingOutfitPreview editorial key={`${target.key}-${lookIndex}`} look={look} target={target} wardrobe={wardrobe} />)}</View>}
      </View> : null}
      {hasShop && !productsLead ? <View style={styles.section}>
        <SectionKicker title="Shop this style" />
        {target.offerState ? <ShoppingOfferRail budget={railBudget} editorial offers={offers} status={target.offerState.status} context={offerContext} onRetry={onRetryOffers} targetKey={target.key} targetTitle={target.title} target={target} wardrobe={wardrobe} /> : null}
        <ShoppingRetailerLinks target={target} />
      </View> : null}
      {onAsk ? <StylistAsk title="Ask about this style" questions={styleAskQuestions(target)} openLabel={`Ask about the ${(displayTitle || target.title).toLowerCase()}`} onAsk={onAsk} /> : null}
      {onNext ? <NextChapterLink title={nextTitle} onPress={onNext} /> : null}
    </View>;
  }
  return <View style={[styles.card, isLast && styles.last]}>
    <View style={styles.identityGroup}>
      <View style={styles.heading}>
        <View style={styles.visual}><ShoppingStyleVisual target={target} /></View>
        <View style={styles.identity}>
          <Text accessibilityRole="header" style={styles.title}>{displayTitle || target.title}</Text>
          {price.compact ? <Text style={styles.caption}>Suggested budget · {price.compact}{price.currency ? ` ${price.currency}` : ''}</Text> : null}
        </View>
      </View>
      {target.rationale ? <Text selectable style={styles.copy}>{humanizeInlineTokens(target.rationale)}</Text> : null}
    </View>
    {looks.length ? <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.label}>With your wardrobe</Text>
      {looks.map((look, lookIndex) => <ShoppingOutfitPreview key={`${target.key}-${lookIndex}`} look={look} target={target} wardrobe={wardrobe} />)}
    </View> : null}
    {hasShop ? <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.label}>Pieces to consider</Text>
      {target.offerState || offers.length ? <ShoppingOfferRail budget={railBudget} offers={offers} status={target.offerState?.status} context={offerContext} onRetry={onRetryOffers} targetKey={target.key} targetTitle={target.title} target={target} wardrobe={wardrobe} /> : <ShoppingRetailerLinks target={target} />}
      {!offers.length && target.offerState && target.offerState.status !== 'pending' ? <ShoppingRetailerLinks target={target} /> : null}
    </View> : null}
    {criteria}
  </View>;
}
const styles = StyleSheet.create({
  identityGroup: { gap: spacing.lg },
  outfits: { gap: spacing.xl },
  editorialCard: { paddingTop: spacing.chapter, paddingBottom: spacing.xl, gap: spacing.subsection, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  hero: { gap: spacing.sm },
  budget: { ...typography.text.meta, color: colors.inkSubtle },
  lede: { ...typography.text.editorialBody, color: colors.foreground },
  card: { paddingVertical: spacing.xl, gap: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  last: { borderBottomWidth: 0 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }, visual: { width: 80 }, identity: { flex: 1, minWidth: 150, gap: spacing.sm },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  caption: { ...typography.text.caption, color: colors.mutedForeground },
  copy: { ...typography.text.bodySmall, color: colors.inkSubtle },
  label: { ...typography.text.label, color: colors.foreground }, section: { gap: spacing.md },
});
