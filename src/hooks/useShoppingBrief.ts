import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { parseShoppingBrief } from '../lib/shopDecisionWorkspace';

export const SHOPPING_BRIEF_QUERY_KEY = ['shop', 'brief'] as const;

export function useShoppingBrief(enabled: boolean) {
  return useQuery({
    queryKey: SHOPPING_BRIEF_QUERY_KEY,
    queryFn: () => api.get('/api/shop/brief').then((response) => parseShoppingBrief(response.data)),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Passive read of the same cache entry: subscribes to updates but never
 * fetches (`enabled: false`), so mounting it never fires the brief's LLM
 * call. Only Shop, via `useShoppingBrief`, pays for that request — this is
 * for surfaces (Home) that want to show the brief only when it already
 * exists.
 */
export function useShoppingBriefCache() {
  return useQuery({
    queryKey: SHOPPING_BRIEF_QUERY_KEY,
    queryFn: () => api.get('/api/shop/brief').then((response) => parseShoppingBrief(response.data)),
    enabled: false,
    staleTime: 5 * 60 * 1000,
  });
}
