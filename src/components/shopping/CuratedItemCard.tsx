import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, curatedProducts, radii, spacing, typography } from '../../theme';
import { offerImageCachePolicy, type ProductOffer } from '../../types/commerce';
import * as Haptics from '../../lib/haptics';

import { priceFitsBudget, productCardTitle, productMerchantLabel } from '../../lib/productPresentation';

export type ProductImageFit = 'contain' | 'cover';

/**
 * One plate for every listing. `contain` keeps the whole product on the warm
 * plate (small cards must never crop the thing being sold); `cover` fills the
 * frame from the top and is reserved for large hero cards.
 */
export function ProductImage({ offer, fit = 'contain', aspectRatio = curatedProducts.imageAspectRatio }: { offer: ProductOffer; fit?: ProductImageFit; aspectRatio?: number }) {
  const [failed, setFailed] = useState(false);
  const reduceMotion = useReducedMotion();
  useEffect(() => setFailed(false), [offer.imageUrl]);
  return <View style={[styles.image, { aspectRatio }]}>
    {offer.imageUrl && !failed ? <View style={[StyleSheet.absoluteFill, fit === 'contain' && styles.inset]}>
      <Image source={{ uri: offer.imageUrl }} style={styles.fill} contentFit={fit} contentPosition={fit === 'cover' ? 'top' : 'center'} cachePolicy={offerImageCachePolicy(offer)} transition={reduceMotion ? 0 : 220} onError={() => setFailed(true)} accessible={false} />
    </View> : <View style={styles.fallback} accessibilityElementsHidden><Svg width={64} height={80} viewBox="0 0 100 120"><Path d="M33 18L16 28L6 53L24 60L29 45V105H71V45L76 60L94 53L84 28L67 18Q50 34 33 18Z" fill={colors.hairline} stroke={colors.controlOutline} /></Svg></View>}
    <View pointerEvents="none" style={styles.edge} />
  </View>;
}

/** A small frosted disc over photography. */
function ControlDisc({ children }: { children: ReactNode }) {
  return <View style={styles.disc}><BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />{children}</View>;
}

export function CuratedItemCard({ offer, editorial = false, quietHide = false, fit = 'contain', budget, saved = false, saving = false, saveFailed = false, onSave, onHide, onOpen, width = curatedProducts.minWidth }: {
  /** "Not for me" as a text action under the price instead of a disc over the photo. */
  quietHide?: boolean;
  offer: ProductOffer; editorial?: boolean; fit?: ProductImageFit; budget?: string | null; saved?: boolean; saving?: boolean; saveFailed?: boolean; onSave?: () => void; onHide?: () => void; onOpen: () => void; width?: number;
}) {
  const reduceMotion = useReducedMotion();
  const press = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const brand = offer.brand || productMerchantLabel(offer.merchant);
  const merchant = productMerchantLabel(offer.merchant);
  const budgetFit = priceFitsBudget(offer, budget);
  const inBudget = budgetFit === true;
  function pressTo(value: number) {
    if (reduceMotion) return;
    Animated.spring(press, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  }
  function save() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!saved && !reduceMotion) Animated.sequence([
      Animated.spring(pop, { toValue: 1.18, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
    onSave?.();
  }
  return <View style={[styles.card, { width }]}>
    <Pressable onPress={onOpen} onLongPress={onHide ? () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onHide(); } : undefined}
      onPressIn={() => pressTo(curatedProducts.pressedScale)} onPressOut={() => pressTo(1)}
      accessibilityRole="button" accessibilityLabel={`${offer.title}, ${offer.merchant}, ${offer.formattedPrice || 'see price'}${offer.colorUnconfirmed ? ', check colour options' : ''}. View product`}
      style={({ pressed }) => pressed && styles.pressed}>
      <Animated.View style={{ transform: [{ scale: press }] }}><ProductImage offer={offer} fit={fit} /></Animated.View>
      <View style={styles.copy}>
        {brand ? <Text style={styles.brand} numberOfLines={1}>{brand}</Text> : null}
        <Text style={styles.title} numberOfLines={2}>{productCardTitle(offer)}</Text>
        <Text style={styles.priceRow} numberOfLines={1}>
          <Text style={styles.price}>{offer.formattedPrice || 'See price'}</Text>
          {merchant && merchant.toLowerCase() !== brand?.toLowerCase() ? <Text style={styles.metadata}>{` · ${merchant}`}</Text> : null}
          {offer.inStock === false ? <Text style={styles.metadata}> · Unavailable</Text> : inBudget ? <Text style={styles.budget}> · In budget</Text> : budgetFit === false && quietHide ? <Text style={styles.metadata}> · Over budget</Text> : null}
        </Text>
        {offer.colorUnconfirmed ? <Text style={styles.metadata} numberOfLines={1}>Check colour options</Text> : null}
      </View>
    </Pressable>
    {onSave ? <Pressable onPress={save} disabled={saving} accessibilityRole="button" accessibilityLabel={`${saving ? saved ? 'Unsaving' : 'Saving' : saveFailed ? saved ? 'Retry unsaving' : 'Retry saving' : saved ? 'Remove from wishlist:' : 'Add to wishlist:'} ${offer.title}`} accessibilityState={{ disabled: saving, busy: saving, selected: saved }} style={({ pressed }) => [styles.control, styles.save, pressed && styles.pressed]}>
      <ControlDisc>{saving ? <ActivityIndicator size="small" color={curatedProducts.accent} /> : <Animated.View style={{ transform: [{ scale: pop }] }}><Ionicons name={saveFailed ? 'refresh-outline' : saved ? 'bookmark' : 'bookmark-outline'} size={curatedProducts.control.icon} color={curatedProducts.accent} /></Animated.View>}</ControlDisc>
    </Pressable> : null}
    {onHide && quietHide ? <Pressable onPress={onHide} hitSlop={{ top: 8, bottom: 8 }} accessibilityRole="button" accessibilityLabel={`Not for me: hide ${offer.title}`} style={({ pressed }) => [styles.quietHide, pressed && styles.pressed]}>
      <Text style={styles.metadata}>Not for me</Text>
    </Pressable> : null}
    {onHide && !quietHide ? <Pressable onPress={onHide} accessibilityRole="button" accessibilityLabel={`Not for me: hide ${offer.title}`} style={({ pressed }) => [styles.control, styles.hide, pressed && styles.pressed]}>
      <ControlDisc><Ionicons name="close" size={curatedProducts.control.icon} color={colors.mutedForeground} /></ControlDisc>
    </Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { alignSelf: 'flex-start' },
  pressed: { opacity: 0.85 },
  image: { backgroundColor: curatedProducts.background, borderRadius: radii.photo, overflow: 'hidden' },
  inset: { padding: curatedProducts.imageInset },
  fill: { flex: 1 },
  edge: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radii.photo, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { paddingTop: spacing.md, gap: spacing.xs },
  brand: { ...typography.text.eyebrow, color: colors.mutedForeground },
  title: { ...curatedProducts.cardTitle, color: colors.foreground },
  priceRow: { ...curatedProducts.metadata },
  price: { ...typography.text.label, color: colors.foreground, fontVariant: ['tabular-nums'] },
  metadata: { ...curatedProducts.metadata, color: colors.mutedForeground },
  budget: { ...curatedProducts.metadata, color: curatedProducts.accent },
  control: { position: 'absolute', top: spacing.xs, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  quietHide: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginTop: spacing.xs },
  save: { right: spacing.xs }, hide: { left: spacing.xs },
  disc: { width: curatedProducts.control.size, height: curatedProducts.control.size, borderRadius: radii.full, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.55)' },
});
