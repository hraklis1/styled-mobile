import { useSyncExternalStore } from 'react';
import type { api } from './api';
import { track } from './analytics';
import type { OfferContext, ProductOffer } from '../types/commerce';
import { recordPromptSignal } from '../features/profilePrompts/signals';

export const productFeedbackOptions = [
  { id: 'not_my_style', title: 'Not my style' },
  { id: 'too_expensive', title: 'Too expensive' },
  { id: 'wrong_color', title: 'Wrong colour' },
  { id: 'wrong_shape', title: 'Wrong fit or shape' },
  { id: 'brand', title: 'Not this brand' },
  { id: 'already_have_similar', title: 'Have something similar' },
] as const;
export type ProductFeedbackReason = (typeof productFeedbackOptions)[number]['id'];

type Entry = { offerId: string; reason: ProductFeedbackReason | null; request: Promise<string | null> };
type Snapshot = ReadonlyMap<string, Entry>;

/**
 * Products the user hid this session. The server is told immediately (so the
 * next offer refresh already excludes them); this store only hides them locally
 * until that refresh arrives, and lets Undo find the server key.
 */
// `api` is required lazily: queryClient imports this module (to reset it on
// sign-out) and api imports queryClient, so a static import would be a cycle.
export function createProductFeedbackStore(override?: Pick<typeof api, 'post' | 'delete'>) {
  const http = (): Pick<typeof api, 'post' | 'delete'> => override ?? require('./api').api;
  let snapshot: Snapshot = new Map();
  const listeners = new Set<() => void>();
  const set = (next: Map<string, Entry>) => { snapshot = next; listeners.forEach((listener) => listener()); };
  const body = (offer: ProductOffer, context: OfferContext, reason: ProductFeedbackReason | null) => ({
    ...(context.wishlistId ? { wishlistId: context.wishlistId } : { reference: context.reference }),
    ...(context.conversationId ? { conversationId: context.conversationId } : {}),
    targetKey: context.targetKey,
    offerId: offer.id,
    ...(reason ? { reason } : {}),
  });
  const send = (offer: ProductOffer, context: OfferContext, reason: ProductFeedbackReason | null) =>
    http().post<{ productKey: string }>('/api/shop/product-feedback', body(offer, context, reason)).then((response) => response.data.productKey).catch(() => null);

  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    canHide: (context: OfferContext) => !!(context.reference || context.wishlistId),
    hide(offer: ProductOffer, context: OfferContext) {
      if (snapshot.has(offer.id)) return;
      set(new Map(snapshot).set(offer.id, { offerId: offer.id, reason: null, request: send(offer, context, null) }));
      track('curated_product_hidden', { surface: context.surface, targetKey: context.targetKey, offerId: offer.id });
      void recordPromptSignal('product_hidden');
    },
    setReason(offer: ProductOffer, context: OfferContext, reason: ProductFeedbackReason) {
      const entry = snapshot.get(offer.id);
      if (!entry) return;
      // Chained so the reason never lands before the first write.
      const request = entry.request.then(() => send(offer, context, reason));
      set(new Map(snapshot).set(offer.id, { ...entry, reason, request }));
      track('curated_product_hidden_reason', { surface: context.surface, reason });
    },
    async undo(offerId: string) {
      const entry = snapshot.get(offerId);
      if (!entry) return;
      const next = new Map(snapshot); next.delete(offerId); set(next);
      const productKey = await entry.request;
      if (productKey) await http().delete(`/api/shop/product-feedback/${productKey}`).catch(() => undefined);
    },
    reset() { set(new Map()); },
  };
}

export const productFeedbackStore = createProductFeedbackStore();

export function useHiddenProducts() {
  return useSyncExternalStore(productFeedbackStore.subscribe, productFeedbackStore.getSnapshot);
}
