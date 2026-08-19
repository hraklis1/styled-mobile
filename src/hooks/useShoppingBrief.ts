import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { api } from '../lib/api';
import { parseShoppingBrief } from '../lib/shopDecisionWorkspace';
import { toLocalDateKey } from '../lib/dailyStylistPick';

export const SHOPPING_BRIEF_QUERY_KEY = ['shop', 'brief'] as const;

/**
 * The brief and every focused edit share this prefix. Any wardrobe or event
 * mutation can change both the ranked priorities and the evidence behind a
 * previously generated edit, so invalidate the whole decision subtree.
 */
export function invalidateShoppingBriefQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: SHOPPING_BRIEF_QUERY_KEY });
}

/**
 * Shared by Shop and Home's `HomeBriefBand` under one query key, so whichever
 * mounts first pays for the request and the other reads the same cache.
 * `enabled` is the caller's premium check — the endpoint is premium-gated.
 */
export function useShoppingBrief(enabled: boolean) {
  const [localDate, setLocalDate] = useState(() => toLocalDateKey(new Date()));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const refreshLocalDate = useCallback(() => setLocalDate(toLocalDateKey(new Date())), []);

  useEffect(() => {
    refreshLocalDate();
    const timer = setInterval(refreshLocalDate, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshLocalDate();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refreshLocalDate]);

  useFocusEffect(useCallback(() => {
    refreshLocalDate();
  }, [refreshLocalDate]));

  return useQuery({
    queryKey: [...SHOPPING_BRIEF_QUERY_KEY, localDate],
    queryFn: () => api.get('/api/shop/brief', { params: { localDate, timezone } }).then((response) => parseShoppingBrief(response.data)),
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

export function useNotNowShoppingPriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recommendationKey, localDate }: { recommendationKey: string; localDate: string }) =>
      api.post('/api/shop/brief/priorities/not-now', { recommendationKey, localDate })
        .then((response) => parseShoppingBrief(response.data)),
    onSuccess: (brief: import('../lib/shopDecisionWorkspace').ShoppingBrief) => {
      queryClient.setQueryData([...SHOPPING_BRIEF_QUERY_KEY, brief.localDate], brief);
      void queryClient.invalidateQueries({ queryKey: SHOPPING_BRIEF_QUERY_KEY });
    },
  });
}
