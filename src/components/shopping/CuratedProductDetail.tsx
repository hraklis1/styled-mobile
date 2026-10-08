import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, curatedProducts, radii, spacing, typography } from '../../theme';
import { productDisclosure, productDisplayTitle, productListingAction, productMerchantLabel } from '../../lib/productPresentation';
import { targetOutfitIdeas, type ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import type { ProductOffer } from '../../types/commerce';
import type { Item } from '../../types/item';
import { ProductImage } from './CuratedItemCard';
import { ShoppingOutfitPreview } from './ShoppingOutfitPreview';
import { ActionButton } from '../primitives/Editorial';

export type ProductDetailProps = {
  offer: ProductOffer;
  reason?: string;
  target?: ShoppingPriorityTarget;
  wardrobe?: ReadonlyMap<number, Item>;
  saved?: boolean;
  saving?: boolean;
  error?: string | null;
  onSave?: () => void;
  onRetailer: () => void;
  priceNote?: string;
};

/** Shop now, plus a bookmark that doesn't compete with it. */
export function ProductDetailActions({ offer, saved, saving, onSave, onRetailer }: Pick<ProductDetailProps, 'offer' | 'saved' | 'saving' | 'onSave' | 'onRetailer'>) {
  return <View style={styles.actions}>
    <ActionButton label={productListingAction(offer)} icon="open-outline" onPress={onRetailer} style={styles.primary} />
    {onSave ? <Pressable onPress={onSave} disabled={saving} accessibilityRole="button" accessibilityLabel={saving ? 'Updating wishlist' : saved ? 'Remove from wishlist' : 'Add to wishlist'} accessibilityState={{ disabled: saving, busy: saving, selected: saved }} style={({ pressed }) => [styles.bookmark, pressed && styles.pressed]}>
      {saving ? <ActivityIndicator size="small" color={curatedProducts.accent} /> : <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={curatedProducts.accent} />}
    </Pressable> : null}
  </View>;
}

/** Shared content also used inside the existing saved-product sheet. Actions render inline unless a host pins them. */
export function ProductDetailContent({ offer, reason, target, wardrobe, saved, saving, error, onSave, onRetailer, priceNote, inlineActions = true }: ProductDetailProps & { inlineActions?: boolean }) {
  const looks = target && wardrobe ? targetOutfitIdeas(target).filter(look => look.itemIds.some(id => wardrobe.has(id))) : [];
  const brand = offer.brand || productMerchantLabel(offer.merchant);
  return <View style={styles.content}>
    <ProductImage offer={offer} />
    <View style={styles.identity}>
      {brand ? <Text style={styles.brand}>{brand}</Text> : null}
      <Text selectable accessibilityRole="header" style={styles.title}>{productDisplayTitle(offer)}</Text>
      <Text selectable style={styles.price}>{offer.formattedPrice || 'See price at the listing'}<Text style={styles.merchant}>{` · ${productMerchantLabel(offer.merchant)}`}</Text></Text>
    </View>
    {inlineActions ? <ProductDetailActions offer={offer} saved={saved} saving={saving} onSave={onSave} onRetailer={onRetailer} /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {reason ? <View style={styles.context}><Text accessibilityRole="header" style={styles.heading}>Why I’d consider this style</Text><Text selectable style={styles.copy}>{reason}</Text></View> : null}
    {looks.length && target && wardrobe ? <View style={styles.context}>
      <Text accessibilityRole="header" style={styles.heading}>With your wardrobe</Text>
      <Text style={styles.caption}>Ways to wear this suggested style with pieces you own.</Text>
      {looks.map((look, index) => <ShoppingOutfitPreview key={`${target.key}-${index}`} look={look} target={target} wardrobe={wardrobe} />)}
    </View> : null}
    <View style={styles.notes}>
      <Text selectable style={styles.caption}>{priceNote ?? 'Confirm price and availability at the listing.'}{offer.inStock === false ? ' This listing is currently unavailable.' : ''}</Text>
      {offer.monetized ? <Text selectable style={styles.caption}>{productDisclosure}</Text> : null}
    </View>
  </View>;
}

/** Embedded when browsing a collection, avoiding stacked native modals. */
export function CuratedProductDetail({ embedded = false, onClose, ...props }: ProductDetailProps & { embedded?: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const content = <View style={[styles.root, embedded && styles.overlay, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]} accessibilityViewIsModal>
    <View style={styles.header}>
      <Text style={styles.eyebrow}>THE SHOPPING EDIT</Text>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Back to product options" style={styles.close}><Ionicons name="close" size={22} color={colors.foreground} /></Pressable>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.page, paddingBottom: spacing.xl }}>
      <ProductDetailContent {...props} inlineActions={false} />
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <ProductDetailActions offer={props.offer} saved={props.saved} saving={props.saving} onSave={props.onSave} onRetailer={props.onRetailer} />
    </View>
  </View>;
  return embedded ? content : <Modal visible presentationStyle="fullScreen" animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>{content}</Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
  header: { paddingHorizontal: spacing.page, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.sm },
  eyebrow: { ...typography.text.masthead, color: colors.accentInk },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.lg }, identity: { gap: spacing.xs },
  brand: { ...typography.text.eyebrow, color: colors.mutedForeground },
  merchant: { ...typography.text.caption, fontWeight: typography.text.caption.fontWeight, color: colors.mutedForeground },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  price: { ...typography.text.label, color: colors.foreground, fontVariant: ['tabular-nums'] },
  copy: { ...typography.text.bodySmall, color: colors.inkSubtle },
  caption: { ...curatedProducts.metadata, color: colors.mutedForeground },
  heading: { ...typography.text.label, color: colors.foreground },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primary: { flex: 1 },
  bookmark: { width: 48, height: 48, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.controlOutline },
  pressed: { opacity: 0.6 },
  notes: { gap: spacing.xs },
  footer: { paddingHorizontal: spacing.page, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, backgroundColor: colors.background },
  context: { gap: spacing.md, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  error: { ...typography.text.bodySmall, color: colors.error },
});
