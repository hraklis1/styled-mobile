import { useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { track } from '../lib/analytics';
import { parseOfferResult, type OfferResult } from '../types/commerce';
import { useHiddenProducts } from '../lib/productFeedback';

export function useCommerceActive(enabled = true) {
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const focus = navigation?.addListener('focus', () => setFocused(true));
    const blur = navigation?.addListener('blur', () => setFocused(false));
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => { focus?.(); blur?.(); subscription.remove(); };
  }, [navigation]);
  return enabled && focused && active;
}
export function useProductOffers(context: { conversationId?: number; reference?: string; wishlistId?: string; surface: string }, enabled = true) {
  const active = useCommerceActive(enabled);
  const client = useQueryClient();
  const key = ['commerce', context.reference ?? null, context.wishlistId ?? null, context.conversationId ?? null];
  // Products hidden this session drop out of every consumer (guide rails, Shop
  // previews) right away; the next server refresh excludes them for good.
  const hidden = useHiddenProducts();
  const select = useCallback((targets: Record<string, OfferResult>) => {
    if (!hidden.size) return targets;
    return Object.fromEntries(Object.entries(targets).map(([targetKey, result]) => [targetKey, { ...result, offers: result.offers.filter((offer) => !hidden.has(offer.id)) }]));
  }, [hidden]);
  const query = useQuery({
    queryKey: key,
    enabled: active && !!(context.reference || context.wishlistId),
    queryFn: async ({ signal }) => {
      const started = Date.now();
      const previous = client.getQueryData<Record<string, OfferResult>>(key);
      const pending = Object.entries(previous ?? {}).filter(([, state]) => state.status === 'pending').map(([key]) => key);
      const response = await api.post('/api/shop/offers', { ...(context.wishlistId ? { wishlistId: context.wishlistId } : { reference: context.reference }), ...(context.conversationId ? { conversationId: context.conversationId } : {}), ...(pending.length ? { targetKeys: pending } : {}) }, { signal });
      const targets: Record<string, OfferResult> = { ...previous };
      for (const row of response.data.targets ?? []) if (typeof row.key === 'string') targets[row.key] = parseOfferResult(row);
      track('curated_options_retrieved', { surface: context.surface, latencyMs: Date.now() - started, statuses: Object.values(targets).map((target) => target.status), offerCount: Object.values(targets).reduce((sum, target) => sum + target.offers.length, 0) });
      return targets;
    },
    staleTime: (query) => {
      if (Object.values(query.state.data ?? {}).some((target) => target.status === 'pending' || target.status === 'unavailable')) return 0;
      const expiries = Object.values(query.state.data ?? {}).map((target) => Date.parse(target.expiresAt ?? '')).filter(Number.isFinite);
      return expiries.length ? Math.max(0, Math.min(...expiries) - query.state.dataUpdatedAt) : 60_000;
    },
    select,
    retry: false,
    refetchInterval: (query) => active && Object.values(query.state.data ?? {}).some((target) => target.status === 'pending') ? 4_000 : false,
  });
  return query;
}
