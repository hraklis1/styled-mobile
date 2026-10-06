import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, curatedProducts, radii, spacing, typography } from '../../theme';
import type { OfferContext, OfferStatus, ProductOffer } from '../../types/commerce';
import type { WishlistEntry } from '../../lib/wishlist';
import { apiErrorMessage } from '../../lib/apiErrors';
import { track } from '../../lib/analytics';
import { productDisclosure, productKey } from '../../lib/productPresentation';
import { saveProductOffer, unsaveProductEntry, useWishlist } from '../../hooks/useWishlist';
import { CuratedItemCard } from './CuratedItemCard';
import { ProductFeedbackPanel } from './ProductFeedbackPanel';
import { productFeedbackStore, useHiddenProducts } from '../../lib/productFeedback';
import { CuratedProductBrowser } from './CuratedProductBrowser';
import { CuratedProductDetail } from './CuratedProductDetail';
import type { ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import type { Item } from '../../types/item';
import { WishlistNavigationContext } from '../../contexts/WishlistNavigationContext';
import { openShoppingLink } from './ShoppingRetailerLinks';

/** Surfaces where a listing can be hidden as "Not for me" (learned server-side). */
const HIDEABLE_SURFACES = new Set(['shopping_guide', 'saved_guide']);

export function CuratedItemRail({ editorial = false, offers, status = 'ready', heading = 'Pieces to consider', context, onRetry, savedDetail = false, reason, browserTitle, collectionAction = 'rail', exploreRequest = 0, target, wardrobe, openDirect = false, previewLimit = 3, hero = false }: {
  editorial?: boolean; offers: ProductOffer[]; status?: OfferStatus; heading?: string; context: OfferContext; onRetry?: () => void; savedDetail?: boolean;
  reason?: string; browserTitle?: string; collectionAction?: 'rail' | 'external'; exploreRequest?: number;
  target?: ShoppingPriorityTarget; wardrobe?: ReadonlyMap<number, Item>;
  /** Tapping a card opens the retailer listing directly instead of the detail sheet. */
  openDirect?: boolean;
  previewLimit?: number;
  /** Large, swipeable cards that lead a chapter; "see all" becomes the rail's last card. */
  hero?: boolean;
}) {
  const viewWishlist = useContext(WishlistNavigationContext);
  const { width } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(width - spacing.page * 2);
  const cardWidth = hero ? Math.round(Math.min(320, contentWidth * 0.72)) : editorial ? Math.min(240, Math.max(160, (contentWidth - spacing.md) / 1.5)) : Math.min(contentWidth, Math.max(curatedProducts.minWidth, Math.min(curatedProducts.maxWidth, contentWidth * curatedProducts.previewFraction)));
  const [browserOpen, setBrowserOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<ProductOffer | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [savedLocally, setSavedLocally] = useState<Map<string, WishlistEntry>>(new Map());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pending = useRef(new Set<string>());
  const scroll = useRef<ScrollView>(null);
  const lastRequest = useRef(exploreRequest);
  const generation = useRef(0);
  const { data: wishlist = [] } = useWishlist();
  const hidden = useHiddenProducts();
  // Hidden offers keep their slot (an outline + reason panel) until the user
  // leaves the page, so nothing jumps under their finger. The rail holds the offer itself: upstream (useProductOffers) drops hidden
  // offers immediately, so it may no longer be in `offers`.
  const [panels, setPanels] = useState<ReadonlyMap<string, { offer: ProductOffer; index: number }>>(new Map());
  const closePanel = useCallback((offerId: string) => setPanels(old => { const next = new Map(old); next.delete(offerId); return next; }), []);
  const canHide = !savedDetail && HIDEABLE_SURFACES.has(context.surface) && productFeedbackStore.canHide(context);
  useEffect(() => {
    setSavedLocally(old => {
      const next = new Map(old);
      for (const [key, entry] of old) if (wishlist.some(saved => saved.id === entry.id)) next.delete(key);
      return next.size === old.size ? old : next;
    });
  }, [wishlist]);
  const eligible = (savedDetail ? offers : offers.filter(offer => offer.inStock !== false)).filter(offer => !hidden.has(offer.id));
  for (const { offer, index } of [...panels.values()].sort((a, b) => a.index - b.index)) if (!eligible.some(entry => entry.id === offer.id)) eligible.splice(Math.min(index, eligible.length), 0, offer);
  const preview = eligible.slice(0, previewLimit);
  const seeAllCard = hero && collectionAction === 'rail' && eligible.length > preview.length;
  function explore() {
    if (!eligible.length) return;
    track('curated_product_browser_opened', { surface: context.surface, targetKey: context.targetKey, eligibleResultCount: eligible.length });
    setBrowserOpen(true);
  }
  useEffect(() => {
    generation.current += 1;
    setBrowserOpen(false); setSelectedOffer(null); setErrors({}); setPanels(new Map()); setSavedLocally(new Map()); setSaving(new Set()); pending.current.clear();
    scroll.current?.scrollTo({ x: 0, animated: false });
  }, [context.reference, context.wishlistId, context.targetKey]);
  useEffect(() => {
    if (exploreRequest !== lastRequest.current) { lastRequest.current = exploreRequest; if (exploreRequest > 0) explore(); }
  });
  useEffect(() => { if (!eligible.length) setBrowserOpen(false); }, [eligible.length]);
  if (status === 'disabled' && !offers.length) return null;
  async function save(offer: ProductOffer) {
    const key = productKey(offer), currentGeneration = generation.current;
    if (pending.current.has(key)) return;
    const savedEntry = wishlist.find(entry => entry.outfit.product && productKey(entry.outfit.product.offer) === key) ?? savedLocally.get(key);
    pending.current.add(key); setSaving(new Set(pending.current)); setErrors(old => { const next = { ...old }; delete next[key]; return next; });
    try {
      if (savedEntry) {
        await unsaveProductEntry(savedEntry.id);
        if (currentGeneration !== generation.current) return;
        setSavedLocally(old => { const next = new Map(old); next.delete(key); return next; });
      } else {
        const entry = await saveProductOffer(offer, context);
        if (currentGeneration !== generation.current) return;
        setSavedLocally(old => new Map(old).set(key, entry));
      }
      track(savedEntry ? 'curated_product_unsaved' : 'curated_product_saved', { surface: context.surface, targetKey: context.targetKey, offerId: offer.id });
    } catch (error) {
      if (currentGeneration === generation.current) setErrors(old => ({ ...old, [key]: apiErrorMessage(error, savedEntry ? 'Couldn’t unsave this piece. Try again.' : 'Couldn’t save this piece. Try again.') }));
    } finally {
      if (currentGeneration === generation.current) { pending.current.delete(key); setSaving(new Set(pending.current)); }
    }
  }
  function openRetailer(offer: ProductOffer) {
    track('curated_product_opened', { surface: context.surface, targetKey: context.targetKey, offerId: offer.id, position: offers.indexOf(offer), provider: offer.provider, monetized: offer.monetized });
    void openShoppingLink(offer.url);
  }
  function renderCard(offer: ProductOffer, size: number) {
    const key = productKey(offer);
    if (panels.has(offer.id)) return <View key={key} style={{ width: size }}><ProductFeedbackPanel offer={offer} width={size}
      imageAspectRatio={editorial || hero ? 0.8 : curatedProducts.imageAspectRatio} reason={hidden.get(offer.id)?.reason ?? null}
      onReason={reason => productFeedbackStore.setReason(offer, context, reason)}
      onUndo={() => { void productFeedbackStore.undo(offer.id); closePanel(offer.id); }} /></View>;
    const savedEntry = savedLocally.get(key) ?? wishlist.find(entry => entry.outfit.product && productKey(entry.outfit.product.offer) === key);
    return <View key={key} style={{ width: size }}><CuratedItemCard editorial={editorial} offer={offer} width={size}
      saved={savedLocally.has(key) || wishlist.some(entry => entry.outfit.product && productKey(entry.outfit.product.offer) === key)}
      saving={saving.has(key)} saveFailed={!!errors[key]}
      onHide={canHide ? () => { const index = eligible.indexOf(offer); setPanels(old => new Map(old).set(offer.id, { offer, index })); productFeedbackStore.hide(offer, context); } : undefined}
      onSave={!savedDetail && (context.reference || context.wishlistId || savedLocally.has(key) || wishlist.some(entry => entry.outfit.product && productKey(entry.outfit.product.offer) === key)) ? () => void save(offer) : undefined}
      onOpen={() => openDirect ? openRetailer(offer) : (track('curated_product_detail_viewed', { surface: context.surface, targetKey: context.targetKey, offerId: offer.id, position: offers.indexOf(offer), provider: offer.provider, monetized: offer.monetized }), setSelectedOffer(offer))} />
      {savedEntry && !savedDetail ? <Pressable accessibilityRole="button" accessibilityLabel={`View ${offer.title} in wishlist`} style={styles.quiet} onPress={() => viewWishlist(savedEntry.id)}><Text style={styles.link}>View wishlist</Text></Pressable> : null}
    </View>;
  }
  const selectedKey = selectedOffer ? productKey(selectedOffer) : '';
  const selectedSaved = savedLocally.has(selectedKey) || wishlist.some(entry => entry.outfit.product && productKey(entry.outfit.product.offer) === selectedKey);
  const canSave = !savedDetail && !!(context.reference || context.wishlistId || selectedSaved);
  const detail = selectedOffer ? <CuratedProductDetail embedded={browserOpen} offer={selectedOffer} reason={reason} target={target} wardrobe={wardrobe}
    saved={selectedSaved} saving={saving.has(selectedKey)} error={errors[selectedKey]}
    onSave={canSave ? () => void save(selectedOffer) : undefined} onClose={() => setSelectedOffer(null)}
    onRetailer={() => openRetailer(selectedOffer)} /> : null;
  function retry() { track('curated_options_retried', { surface: context.surface }); onRetry?.(); }
  const error = Object.values(errors)[0];
  return <View style={styles.section} onLayout={event => { if (event.nativeEvent.layout.width > 0) setContentWidth(event.nativeEvent.layout.width); }}>
    {heading ? <Text style={styles.heading}>{heading}</Text> : null}
    {preview.length ? <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} style={hero && styles.bleed} contentContainerStyle={[styles.rail, hero && styles.bleedRail]} snapToInterval={cardWidth + spacing.md} decelerationRate="fast">
      {preview.map(offer => renderCard(offer, cardWidth))}
      {seeAllCard ? <Pressable onPress={explore} accessibilityRole="button" accessibilityLabel={`See all ${eligible.length} options`}
        style={({ pressed }) => [styles.seeAll, { width: Math.round(cardWidth * 0.6) }, pressed && styles.pressed]}>
        <Text style={styles.seeAllCount}>{eligible.length}</Text>
        <Text style={styles.link}>See all options →</Text>
      </Pressable> : null}
    </ScrollView> : status === 'pending' ? <View style={styles.rail} accessibilityLabel="Finding considered pieces" accessibilityState={{ busy: true }}>{[0, 1].map(key => <View key={key} style={{ width: cardWidth }}><View style={[styles.skeleton, { aspectRatio: editorial || hero ? 0.8 : curatedProducts.imageAspectRatio }]} /><View style={styles.skeletonLine} /><View style={[styles.skeletonLine, { width: '65%' }]} /></View>)}</View> : <Text style={styles.copy}>{status === 'unavailable' ? 'Shopping options are unavailable right now. Your styling guide is still here.' : 'No suitable listings right now. Use the style notes as your shopping guide.'}</Text>}
    {collectionAction === 'rail' && eligible.length && !hero ? <Pressable onPress={explore} style={({ pressed }) => [styles.quiet, editorial && styles.collectionButton, pressed && styles.pressed]} accessibilityRole="button"><Text style={styles.link}>{editorial ? `Browse all ${eligible.length} ${eligible.length === 1 ? 'option' : 'options'}` : 'Explore all options'}</Text></Pressable> : null}
    {status === 'unavailable' && onRetry ? <Pressable onPress={retry} accessibilityRole="button" style={styles.quiet}><Text style={styles.link}>Try again</Text></Pressable> : null}
    {error ? <Text style={styles.copy} accessibilityRole="alert">{error}</Text> : null}
    {preview.some(offer => offer.monetized) ? <Text style={styles.copy}>{productDisclosure}</Text> : null}
    {browserOpen ? <CuratedProductBrowser editorial={editorial} visible title={browserTitle ?? (heading || 'Pieces to consider')} reason={reason} offers={eligible} status={status} context={context} onRetry={onRetry ? retry : undefined} onClose={() => { setSelectedOffer(null); setBrowserOpen(false); }} onCloseDetail={() => setSelectedOffer(null)} detail={detail} renderCard={renderCard} error={error} /> : null}
    {!browserOpen ? detail : null}
  </View>;
}
const styles = StyleSheet.create({
  collectionButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.controlOutline, borderRadius: radii.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  seeAll: { aspectRatio: 0.48, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radii.photo, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.controlOutline },
  seeAllCount: { ...typography.text.editorialCompact, color: colors.foreground, fontVariant: ['tabular-nums'] },
  section: { gap: spacing.md }, heading: { ...typography.text.label, color: colors.foreground },
  bleed: { marginHorizontal: -spacing.page }, bleedRail: { paddingHorizontal: spacing.page },
  rail: { flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.xs },
  copy: { ...typography.text.bodySmall, color: colors.mutedForeground },
  quiet: { minWidth: 44, minHeight: 44, justifyContent: 'center' }, pressed: { opacity: 0.5 }, link: { ...typography.text.label, color: curatedProducts.accent },
  skeleton: { backgroundColor: colors.surfaceSubtle, borderRadius: radii.photo },
  skeletonLine: { backgroundColor: colors.surfaceSubtle, height: spacing.md, marginTop: spacing.sm, borderRadius: radii.sm },
});
