import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, curatedProducts, radii, spacing, typography } from '../../theme';
import { offerImageCachePolicy, type ProductOffer } from '../../types/commerce';

import { productCardTitle, productDisplayTitle, productMerchantLabel } from '../../lib/productPresentation';

export function ProductImage({ offer, editorial = false }: { offer: ProductOffer; editorial?: boolean }) {
  const [failed, setFailed] = useState(false);
  const reduceMotion = useReducedMotion();
  useEffect(() => setFailed(false), [offer.imageUrl]);
  return <View style={[styles.image, editorial && styles.editorialImage]}>
    {offer.imageUrl && !failed ? <Image source={{ uri: offer.imageUrl }} style={editorial ? styles.insetImage : StyleSheet.absoluteFill} contentFit="contain" cachePolicy={offerImageCachePolicy(offer)} transition={reduceMotion ? 0 : 150} onError={() => setFailed(true)} accessible={false} /> : <View style={styles.fallback} accessibilityElementsHidden><Svg width={64} height={80} viewBox="0 0 100 120"><Path d="M33 18L16 28L6 53L24 60L29 45V105H71V45L76 60L94 53L84 28L67 18Q50 34 33 18Z" fill={colors.hairline} stroke={colors.controlOutline} /></Svg></View>}
  </View>;
}

export function CuratedItemCard({ offer, editorial = false, saved = false, saving = false, saveFailed = false, onSave, onHide, onOpen, width = curatedProducts.minWidth }: {
  offer: ProductOffer; editorial?: boolean; saved?: boolean; saving?: boolean; saveFailed?: boolean; onSave?: () => void; onHide?: () => void; onOpen: () => void; width?: number;
}) {
  return <View style={[styles.card, { width }]}>
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${offer.title}, ${offer.merchant}, ${offer.formattedPrice || 'see price'}. View product`} style={({ pressed }) => [styles.open, pressed && styles.pressed]}>
      <ProductImage offer={offer} editorial={editorial} />
      {editorial ? <View style={styles.copy}>
        <Text style={styles.metadata} numberOfLines={1}>{offer.brand || productMerchantLabel(offer.merchant)}</Text>
        <Text style={[styles.title, styles.editorialTitle]} numberOfLines={2}>{productCardTitle(offer)}</Text>
        <Text style={styles.price}>{offer.formattedPrice || 'See price'}{offer.inStock === false ? ' · Unavailable' : ''}</Text>
      </View> : <View style={styles.copy}>
        {offer.brand ? <Text style={styles.brand}>{offer.brand}</Text> : null}
        <Text style={styles.title}>{productDisplayTitle(offer)}</Text>
        <Text style={styles.price}>{offer.formattedPrice || 'See price'}</Text>
        {offer.inStock === false ? <Text style={styles.metadata}>Unavailable</Text> : null}
        <Text style={styles.metadata}>{productMerchantLabel(offer.merchant)}</Text>
        <View style={styles.action}><Text style={styles.link}>View product</Text><Ionicons name="arrow-forward" size={14} color={curatedProducts.accent} /></View>
      </View>}
    </Pressable>
    {onSave ? <Pressable onPress={onSave} disabled={saving} accessibilityRole="button" accessibilityLabel={`${saving ? saved ? 'Unsaving' : 'Saving' : saveFailed ? saved ? 'Retry unsaving' : 'Retry saving' : saved ? 'Remove from wishlist:' : 'Add to wishlist:'} ${offer.title}`} accessibilityState={{ disabled: saving, busy: saving, selected: saved }} style={({ pressed }) => [styles.save, pressed && styles.pressed]}>
      {saving ? <ActivityIndicator size="small" color={curatedProducts.accent} /> : <Ionicons name={saveFailed ? 'refresh-outline' : saved ? 'bookmark' : 'bookmark-outline'} size={18} color={curatedProducts.accent} />}
    </Pressable> : null}
    {onHide ? <Pressable onPress={onHide} accessibilityRole="button" accessibilityLabel={`Not for me: hide ${offer.title}`} style={({ pressed }) => [styles.hide, pressed && styles.pressed]}>
      <Ionicons name="close" size={18} color={colors.mutedForeground} />
    </Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  editorialImage: { aspectRatio: 0.8, backgroundColor: colors.surfaceElevated },
  insetImage: { position: 'absolute', top: 8, bottom: 8, left: 8, right: 8 },
  editorialTitle: { ...typography.text.cardTitle },
  card: { alignSelf: 'flex-start' },
  open: {}, pressed: { backgroundColor: colors.surfaceSelected },
  image: { aspectRatio: curatedProducts.imageAspectRatio, backgroundColor: curatedProducts.background, borderRadius: radii.photo, overflow: 'hidden' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { paddingTop: spacing.md, gap: spacing.xs }, metadata: { ...curatedProducts.metadata, color: colors.mutedForeground },
  brand: { ...typography.text.label, color: colors.foreground },
  title: { ...curatedProducts.title, color: colors.foreground }, price: { ...typography.text.label, color: colors.foreground, fontVariant: ['tabular-nums'] },
  action: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', paddingVertical: spacing.xs },
  link: { ...typography.text.caption, color: curatedProducts.accent, flexShrink: 1 },
  hide: { position: 'absolute', top: spacing.sm, left: spacing.sm, width: 44, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  save: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 44, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
