import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { parseShoppingPriorityEdit } from '../lib/shoppingPriorityEdit';
import type { ShoppingBriefPriority } from '../lib/shopDecisionWorkspace';

export const SHOPPING_PRIORITY_EDIT_QUERY_KEY = ['shop', 'brief', 'priority-edit'] as const;

export function useShoppingPriorityEdit(priority: ShoppingBriefPriority) {
  return useQuery({
    queryKey: [...SHOPPING_PRIORITY_EDIT_QUERY_KEY, priority],
    queryFn: () => api.post('/api/shop/brief/priority-edit', { priority }).then((response) => parseShoppingPriorityEdit(response.data)),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
