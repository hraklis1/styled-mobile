import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { api } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import type { ShopOutfit } from '../types/shop';
import type { WishlistEntry } from '../lib/wishlist';

export const WISHLIST_QUERY_KEY = ['wishlist'] as const;

/** Stable, client-minted id; preserved through the server round-trip so board
 *  wishlistIds stay valid and the one-time migration is idempotent. */
function newWishlistId(): string {
  return `w_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function useWishlist() {
  return useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: () => api.get<WishlistEntry[]>('/api/wishlist').then((r) => (Array.isArray(r.data) ? r.data : [])),
  });
}

/**
 * Imperative add — usable outside React (e.g. the nested render callback in
 * StylistChatView where hooks aren't available). Writes to the server and keeps
 * the shared React Query cache in sync so `useWishlist` consumers update.
 */
export async function addOutfitToWishlist(
  outfit: ShopOutfit,
  eventContext?: { id: number; title: string } | null,
): Promise<WishlistEntry> {
  const entry: WishlistEntry = {
    id: newWishlistId(),
    savedAt: new Date().toISOString(),
    outfit,
    ...(eventContext ? { eventContext } : {}),
  };
  await api.post('/api/wishlist', { id: entry.id, outfit, eventContext: eventContext ?? null });
  queryClient.setQueryData<WishlistEntry[]>(WISHLIST_QUERY_KEY, (old = []) => [entry, ...old]);
  return entry;
}

export function useRemoveFromWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/wishlist/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: WISHLIST_QUERY_KEY });
      const previous = qc.getQueryData<WishlistEntry[]>(WISHLIST_QUERY_KEY);
      qc.setQueryData<WishlistEntry[]>(WISHLIST_QUERY_KEY, (old) => old?.filter((e) => e.id !== id) ?? []);
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(WISHLIST_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't remove from wishlist. Please try again.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY }),
  });
}
