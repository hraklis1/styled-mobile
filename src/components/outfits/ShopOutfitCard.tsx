import { useState } from 'react';
import { Image } from 'expo-image';
import { useStylistCardState } from '../stylist/StylistCardState';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, curatedProducts, spacing, typography } from '../../theme';
import type { ShopOutfit } from '../../types/shop';
import { useProductOffers } from '../../hooks/useProductOffers';
import { CuratedItemRail } from '../shopping/CuratedItemRail';
import { openShoppingLink } from '../shopping/ShoppingRetailerLinks';
import { ProductImage } from '../shopping/CuratedItemCard';
import { track } from '../../lib/analytics';
import { productMerchantLabel } from '../../lib/productPresentation';

// Every outbound tap from the stylist is attributed, matching curated_product_opened in the rail.
function openTracked(url: string, props: Record<string, unknown>) {
  track('curated_product_opened', { surface: 'stylist', ...props });
  void openShoppingLink(url);
}

type Props = { compact?: boolean; outfit: ShopOutfit; onRemove?: () => void; onSave?: () => Promise<void>; onSaved?: () => void; onViewSaved?: () => void; onSaveToBoard?: () => void; saveLabel?: string; wishlistId?: string };
export function ShopOutfitCard({ compact = false, outfit, onRemove, onSave, onSaved, onViewSaved, onSaveToBoard, saveLabel, wishlistId }: Props) {
  const [saved, setSaved] = useStylistCardState('shopping-saved', false);
  const [showAll, setShowAll] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const query = useProductOffers({ reference: outfit.commerceReference, conversationId: outfit.commerceConversationId, wishlistId, surface: 'stylist' });
  async function save() {
    if (!onSave || saved || saving) return;
    setSaving(true); setSaveError(false);
    try { await onSave(); setSaved(true); onSaved?.(); } catch { setSaveError(true); } finally { setSaving(false); }
  }
  return <View style={styles.root}>
    {!!outfit.intro && <Text style={styles.intro}>{outfit.intro}</Text>}
    {(compact && !showAll ? outfit.items.slice(0, 3) : outfit.items).map((item, index) => {
      const key = item.key ?? `stylist-${index}`;
      const state = query.data?.[key] ?? item.offerState;
      const hasReference = !!(outfit.commerceReference || wishlistId);
      const offers = state?.offers ?? item.offers ?? [];
      const offer = offers[0];
      if (compact && offer && offers.length === 1) return (
        <View key={key}>
        <Pressable style={({ pressed }) => [styles.compactProduct, pressed && styles.pressed]} onPress={() => openTracked(offer.url, { offerId: offer.id, provider: offer.provider, monetized: offer.monetized, targetKey: key, position: index, layout: 'feature' })} accessibilityRole="link" accessibilityLabel={`${item.name}, ${offer.merchant}, ${offer.formattedPrice}. Shop at ${offer.merchant}`}>
          <View style={styles.compactImage}><ProductImage offer={offer} aspectRatio={4 / 5} /></View>
          <View style={styles.compactDetails}>
            {!!item.brand && <Text style={styles.eyebrow} numberOfLines={1}>{item.brand}</Text>}
            <Text style={styles.compactTitle} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.compactPrice}>{offer.formattedPrice || 'See price'}</Text>
            {!!item.whyItFitsYou && <Text style={styles.copy} numberOfLines={expandedProduct === key ? undefined : 2}>{item.whyItFitsYou}</Text>}
            <View style={styles.cta}><Text style={styles.ctaText} numberOfLines={1}>{`Shop at ${productMerchantLabel(offer.merchant)}`}</Text></View>
          </View>
        </Pressable>
        {!!item.whyItFitsYou && <Pressable accessibilityRole="button" accessibilityState={{ expanded: expandedProduct === key }} accessibilityLabel={`Why ${item.name} suits you`} onPress={() => setExpandedProduct(expandedProduct === key ? null : key)} style={styles.detailAction}><Text style={styles.link}>{expandedProduct === key ? 'Less detail' : 'Why this pick'}</Text></Pressable>}
        </View>
      );
      return <View key={key} style={styles.direction}>
        <Text style={styles.title}>{item.name}</Text>
        {!!item.whyItFitsYou && <Text style={styles.copy}>{item.whyItFitsYou}</Text>}
        {!!item.priceRange && <Text style={styles.copy}>Suggested budget {item.priceRange}</Text>}
        {hasReference || item.offers?.length ? <CuratedItemRail browserTitle={item.name} reason={item.whyItFitsYou} offers={state?.offers ?? item.offers ?? []} status={query.isError || query.fetchStatus === 'paused' ? 'unavailable' : state?.status ?? 'pending'} context={{ reference: outfit.commerceReference, conversationId: outfit.commerceConversationId, wishlistId, targetKey: key, surface: 'stylist' }} onRetry={() => void query.refetch()} /> : <Pressable onPress={() => openTracked(item.retailerUrl || `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${item.brand} ${item.name}`)}`, { targetKey: key, position: index, layout: item.retailerUrl ? 'retailer' : 'search' })} accessibilityRole="link" accessibilityLabel={item.retailerUrl ? `View product: ${item.name}` : `Find similar to ${item.name} on Google Shopping`} style={styles.action}><Text style={styles.link}>{item.retailerUrl ? 'View product' : 'Find similar'}</Text></Pressable>}
      </View>;
    })}
    {compact && outfit.items.length > 3 && <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }} onPress={() => setShowAll(!showAll)} style={styles.action}><Text style={styles.link}>{showAll ? 'Show fewer' : `Show ${outfit.items.length - 3} more options`}</Text></Pressable>}
    {!!outfit.totalBudget && <Text style={styles.copy}>Suggested total budget {outfit.totalBudget}</Text>}
    {onSave ? <Pressable onPress={() => void save()} disabled={saved || saving} accessibilityRole="button" accessibilityState={{ disabled: saved || saving, busy: saving }} style={styles.action}><Text style={styles.link}>{saved ? (outfit.recommendationType === 'piece' ? 'Added to wishlist' : 'List saved') : saving ? 'Saving…' : saveLabel ?? (outfit.recommendationType === 'piece' ? 'Add to wishlist' : 'Save list')}</Text></Pressable> : null}
    {saved && (onViewSaved || onSaveToBoard) ? <View style={styles.savedActions}>
      {onViewSaved ? <Pressable onPress={onViewSaved} accessibilityRole="button" style={styles.action}><Text style={styles.link}>View wishlist</Text></Pressable> : null}
      {onSaveToBoard ? <Pressable onPress={onSaveToBoard} accessibilityRole="button" style={styles.action}><Text style={styles.link}>Add to board</Text></Pressable> : null}
    </View> : null}
    {saveError ? <Text accessibilityRole="alert" style={styles.copy}>Couldn’t save. Try again.</Text> : null}
    {onRemove ? <Pressable onPress={onRemove} accessibilityRole="button" style={styles.action}><Text style={styles.copy}>Remove</Text></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  detailAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginLeft: 128 + spacing.lg },
  compactProduct: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, paddingVertical: spacing.sm },
  pressed: { opacity: 0.85 },
  compactImage: { width: 128 },
  compactDetails: { flex: 1, gap: spacing.xs, paddingTop: spacing.xs },
  eyebrow: { ...typography.text.eyebrow, color: colors.mutedForeground },
  compactTitle: { ...curatedProducts.cardTitle, color: colors.foreground },
  compactPrice: { ...typography.text.label, color: colors.foreground, fontVariant: ['tabular-nums'] },
  cta: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center', borderRadius: 999, backgroundColor: colors.foreground },
  ctaText: { ...typography.text.label, color: colors.background },
  root: { gap: spacing.lg }, intro: { ...typography.text.body, color: colors.inkSubtle },
  direction: { gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  title: { ...typography.text.editorialCompact, color: colors.foreground }, copy: { ...typography.text.bodySmall, color: colors.mutedForeground },
  savedActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  action: { minHeight: 48, justifyContent: 'center' }, link: { ...typography.text.label, color: curatedProducts.accent },
});
