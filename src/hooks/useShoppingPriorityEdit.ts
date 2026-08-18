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
    priority,
    context.origin ?? null,
    context.briefGeneratedAt ?? null,
  ] as const;
}

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
    }).then((response) => parseShoppingPriorityEdit(response.data)),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (!query.data?.briefUpdated || !query.data.updatedBrief) return;
    queryClient.setQueryData(SHOPPING_BRIEF_QUERY_KEY, query.data.updatedBrief);
  }, [query.data, queryClient]);

  return query;
}
