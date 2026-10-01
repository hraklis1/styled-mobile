import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { parseShoppingPriorityEdit } from '../lib/shoppingPriorityEdit';
import type { ShoppingBriefPriority } from '../lib/shopDecisionWorkspace';
import { SHOPPING_BRIEF_QUERY_KEY } from './useShoppingBrief';

export const SHOPPING_PRIORITY_EDIT_QUERY_KEY = ['shop', 'brief', 'priority-edit'] as const;

type ShoppingPriorityEditRequestContext = {
  origin?: 'shopping_brief' | 'daily_look';
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

// Backs off rather than polling flat: the commerce provider soft-blocks for
// ~60s after a burst, and every re-ask re-fires each missing search, so quick
// retries both land inside the block and extend it. The last ask comes ~95s in.
const OFFER_REFETCH_DELAYS_MS = [8_000, 25_000, 60_000];

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
    // few times, backing off, so they appear without waiting out the 24h staleTime; repeat
    // asks hit the server's edit and offer caches, so they cost nothing.
    refetchInterval: (current) =>
      current.state.data?.offersPending
        ? OFFER_REFETCH_DELAYS_MS[current.state.dataUpdateCount - 1] ?? false
        : false,
  });

  useEffect(() => {
    if (!query.data?.briefUpdated || !query.data.updatedBrief) return;
    queryClient.setQueriesData({ queryKey: SHOPPING_BRIEF_QUERY_KEY }, query.data.updatedBrief);
  }, [query.data, queryClient]);

  return query;
}
