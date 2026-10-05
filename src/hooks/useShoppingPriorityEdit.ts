import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { parseShoppingPriorityEdit } from '../lib/shoppingPriorityEdit';
import type { ShoppingBriefPriority } from '../lib/shopDecisionWorkspace';
import { useProductOffers, useCommerceActive } from './useProductOffers';
import { SHOPPING_BRIEF_QUERY_KEY } from './useShoppingBrief';
import { toLocalDateKey } from '../lib/dailyStylistPick';

export const SHOPPING_PRIORITY_EDIT_QUERY_KEY = ['shop', 'brief', 'priority-edit'] as const;

type ShoppingPriorityEditRequestContext = {
  origin?: 'shopping_brief' | 'daily_look';
  briefGeneratedAt?: string;
  enabled?: boolean;
  purpose?: 'preview' | 'guide';
};

export function shoppingPriorityEditQueryKey(
  priority: ShoppingBriefPriority,
  context: ShoppingPriorityEditRequestContext = {},
) {
  return [
    ...SHOPPING_PRIORITY_EDIT_QUERY_KEY,
    'editorial-v3-commerce',
    priority,
    context.origin ?? null,
    context.briefGeneratedAt ?? null,
    context.purpose ?? 'guide',
  ] as const;
}

export function useShoppingPriorityEdit(
  priority: ShoppingBriefPriority,
  context: ShoppingPriorityEditRequestContext = {},
) {
  const queryClient = useQueryClient();
  const { origin, briefGeneratedAt, purpose = 'guide' } = context;
  const active = useCommerceActive(context.enabled !== false);
  const query = useQuery({
    enabled: active,
    queryKey: shoppingPriorityEditQueryKey(priority, { origin, briefGeneratedAt, purpose }),
    queryFn: ({ signal }) => api.post('/api/shop/brief/priority-edit', {
      priority,
      purpose,
      ...(origin ? { origin } : {}),
      ...(briefGeneratedAt ? { briefGeneratedAt } : {}),
    }, { signal }).then((response) => parseShoppingPriorityEdit(response.data)),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,

  });

  useEffect(() => {
    if (!query.data?.briefUpdated || !query.data.updatedBrief) return;
    const updatedBrief = query.data.updatedBrief;
    queryClient.setQueryData([...SHOPPING_BRIEF_QUERY_KEY, updatedBrief.localDate ?? toLocalDateKey(new Date())], updatedBrief);
  }, [query.data, queryClient]);

  const offers = useProductOffers({ reference: query.data?.commerceReference, surface: purpose === 'preview' ? 'shop_overview' : context.origin ?? 'shopping_guide' }, active && !!query.data);
  const data = query.data ? { ...query.data, targets: query.data.targets.map((target) => {
    const state = offers.isError || offers.fetchStatus === 'paused' ? { status: 'unavailable' as const, offers: offers.data?.[target.key]?.offers ?? target.offers ?? [], retrievedAt: null, expiresAt: null } : offers.data?.[target.key] ?? target.offerState;
    return state ? { ...target, offers: state.offers, offerState: state } : target;
  }) } : undefined;
  return { ...query, data, refreshOffers: offers.refetch };

}
