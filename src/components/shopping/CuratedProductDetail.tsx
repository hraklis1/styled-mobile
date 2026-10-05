import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, curatedProducts, spacing, typography } from '../../theme';
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

/** Shared content also used inside the existing saved-product sheet. */
export function ProductDetailContent({ offer, reason, target, wardrobe, saved, saving, error, onSave, onRetailer, priceNote }: ProductDetailProps) {
  const looks = target && wardrobe ? targetOutfitIdeas(target).filter(look => look.itemIds.some(id => wardrobe.has(id))) : [];
  return <View style={styles.content}>
    <ProductImage offer={offer} />
    <View style={styles.identity}>
      {offer.brand ? <Text style={styles.brand}>{offer.brand}</Text> : null}
      <Text selectable accessibilityRole="header" style={styles.title}>{productDisplayTitle(offer)}</Text>
      <Text selectable style={styles.price}>{offer.formattedPrice || 'See price at the listing'}</Text>
      <Text selectable style={styles.copy}>{productMerchantLabel(offer.merchant)}</Text>
    </View>
    {reason ? <View style={styles.context}><Text accessibilityRole="header" style={styles.heading}>Why I’d consider this style</Text><Text selectable style={styles.copy}>{reason}</Text></View> : null}
    <View style={styles.actions}>
      <ActionButton label={productListingAction(offer)} icon="open-outline" onPress={onRetailer} />
      {onSave ? <ActionButton label={saving ? 'Updating…' : saved ? 'Saved · remove' : 'Save piece'} icon={saved ? 'bookmark' : 'bookmark-outline'} variant="secondary" onPress={onSave} disabled={saving} /> : null}
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Text selectable style={styles.caption}>{priceNote ?? 'Confirm price and availability at the listing.'}{offer.inStock === false ? ' This listing is currently unavailable.' : ''}</Text>
    {offer.monetized ? <Text selectable style={styles.caption}>{productDisclosure}</Text> : null}

    {looks.length && target && wardrobe ? <View style={styles.context}>
      <Text accessibilityRole="header" style={styles.heading}>With your wardrobe</Text>
      <Text style={styles.caption}>Ways to wear this suggested style with pieces you own.</Text>
      {looks.map((look, index) => <ShoppingOutfitPreview key={`${target.key}-${index}`} look={look} target={target} wardrobe={wardrobe} />)}
    </View> : null}
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
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.page, paddingBottom: insets.bottom + spacing.xl }}>
      <ProductDetailContent {...props} />
    </ScrollView>
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
  brand: { ...typography.text.label, color: colors.foreground },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  price: { ...typography.text.label, color: colors.foreground, fontVariant: ['tabular-nums'] },
  copy: { ...typography.text.bodySmall, color: colors.inkSubtle },
  caption: { ...curatedProducts.metadata, color: colors.mutedForeground },
  heading: { ...typography.text.label, color: colors.foreground },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  context: { gap: spacing.md, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  error: { ...typography.text.bodySmall, color: colors.error },
});
