import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { parseShoppingPriorityEdit } from '../lib/shoppingPriorityEdit';
import type { ShoppingBriefPriority } from '../lib/shopDecisionWorkspace';
import { SHOPPING_BRIEF_QUERY_KEY } from './useShoppingBrief';

export const SHOPPING_PRIORITY_EDIT_QUERY_KEY = ['shop', 'brief', 'priority-edit'] as const;

type ShoppingPriorityEditRequestContext = {
  origin?: 'shopping_brief';
  briefGeneratedAt?: string;
};

export function shoppingPriorityEditQueryKey(
  priority: ShoppingBriefPriority,
  context: ShoppingPriorityEditRequestContext = {},
) {
  return [
    ...SHOPPING_PRIORITY_EDIT_QUERY_KEY,
    'editorial-v1',
    priority,
    context.origin ?? null,
    context.briefGeneratedAt ?? null,
  ] as const;
}

const OFFER_REFETCH_INTERVAL_MS = 8_000;
const OFFER_REFETCH_ATTEMPTS = 3;

export function useShoppingPriorityEdit(
  priority: ShoppingBriefPriority,
  context: ShoppingPriorityEditRequestContext = {},
) {
  const queryClient = useQueryClient();
  const { origin, briefGeneratedAt } = context;
  const query = useQuery({
    queryKey: shoppingPriorityEditQueryKey(priority, { origin, briefGeneratedAt }),
    queryFn: () => api.post('/api/shop/brief/priority-edit', {
      priority,
      ...(origin ? { origin } : {}),
      ...(briefGeneratedAt ? { briefGeneratedAt } : {}),
    }).then((response) => parseShoppingPriorityEdit(response.data)),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    // Products can land in the server's offer cache a few seconds after the
    // guide is served (a slow search finishes in the background). Re-ask a
    // few times so they appear without waiting out the 24h staleTime; repeat
    // asks hit the server's edit and offer caches, so they cost nothing.
    refetchInterval: (current) =>
      current.state.data?.offersPending && current.state.dataUpdateCount < OFFER_REFETCH_ATTEMPTS + 1
        ? OFFER_REFETCH_INTERVAL_MS
        : false,
  });

  useEffect(() => {
    if (!query.data?.briefUpdated || !query.data.updatedBrief) return;
    queryClient.setQueriesData({ queryKey: SHOPPING_BRIEF_QUERY_KEY }, query.data.updatedBrief);
  }, [query.data, queryClient]);

  return query;
}
