import { useMemo } from 'react';
import { useItems } from '../../hooks/useItems';
import { wearableWardrobe } from '../../lib/shopClarity';
import type { ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import { StyleSheet, Text, View } from 'react-native';
import type { WishlistEntry } from '../../lib/wishlist';
import { useProductOffers } from '../../hooks/useProductOffers';
import { ProductDetailContent } from './CuratedProductDetail';
import { CuratedItemRail } from './CuratedItemRail';
import { openShoppingLink } from './ShoppingRetailerLinks';
import { track } from '../../lib/analytics';
import { colors, spacing, typography } from '../../theme';
export function SavedProductDetail({ entry }: { entry: WishlistEntry }) {
  const product = entry.outfit.product!;
  const { data: items = [] } = useItems();
  const wardrobe = useMemo(() => wearableWardrobe(items), [items]);
  const storedTarget = entry.outfit.shoppingBrief?.targets.find(target => target.key === product.target.key);
  const target: ShoppingPriorityTarget = storedTarget ?? { ...product.target, rationale: '', unlocks: [], outfitIdeas: [] };
  const styleContext = storedTarget?.rationale || [product.target.color, product.target.material, product.target.silhouette].filter(Boolean).join(' · ');
  const query = useProductOffers({ wishlistId: entry.id, surface: 'saved_product' });
  const result = query.data?.[product.target.key];
  const exact = result?.offers.find((offer) => offer.id === product.offer.id && offer.provider === product.offer.provider);
  const alternatives = result?.offers.filter((offer) => offer.id !== product.offer.id || offer.provider !== product.offer.provider) ?? [];
  const offer = exact ? { ...exact, title: product.offer.title, url: product.offer.url } : product.offer;
  return <View style={styles.root}>
    <ProductDetailContent offer={offer} reason={styleContext} target={target} wardrobe={wardrobe} priceNote={`${exact ? 'Listing refreshed' : `Saved price · ${new Date(product.savedPriceAt).toLocaleDateString()}`}. Confirm price and availability at the listing.`} onRetailer={() => {
      track('curated_product_opened', { surface: 'saved_product', targetKey: product.target.key, offerId: product.offer.id, provider: product.offer.provider, monetized: product.offer.monetized });
      void openShoppingLink(product.offer.url);
    }} />
    {!exact && result && result.status !== 'pending' ? <Text style={styles.caption}>We couldn’t confirm this exact listing. Your wishlist product is unchanged.</Text> : null}
    <CuratedItemRail offers={alternatives} status={query.isError ? 'unavailable' : result?.status ?? 'pending'} heading="Other options" browserTitle={product.target.title} reason={styleContext} target={target} wardrobe={wardrobe} context={{ wishlistId: entry.id, targetKey: product.target.key, surface: 'saved_product' }} onRetry={() => void query.refetch()} />
  </View>;
}
const styles = StyleSheet.create({ root: { gap: spacing.lg }, caption: { ...typography.text.bodySmall, color: colors.mutedForeground } });
