import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { parseShoppingBrief } from '../lib/shopDecisionWorkspace';

export const SHOPPING_BRIEF_QUERY_KEY = ['shop', 'brief'] as const;

/**
 * Shared by Shop and Home's `HomeBriefBand` under one query key, so whichever
 * mounts first pays for the request and the other reads the same cache.
 * `enabled` is the caller's premium check — the endpoint is premium-gated.
 */
export function useShoppingBrief(enabled: boolean) {
  return useQuery({
    queryKey: SHOPPING_BRIEF_QUERY_KEY,
    queryFn: () => api.get('/api/shop/brief').then((response) => parseShoppingBrief(response.data)),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
