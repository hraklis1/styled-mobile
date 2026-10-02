import { QueryClient } from '@tanstack/react-query';
import { shoppingFeedbackQueue } from './shoppingFeedback';
import { isNetworkError } from './networkError';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // data considered fresh for 5 min
      gcTime: 1000 * 60 * 60 * 24,  // keep in memory 24 hr so persistence can flush it
      retry: (failureCount, error) => isNetworkError(error) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

let userCacheEpoch = 0;
export function getUserCacheEpoch(): number { return userCacheEpoch; }

// User-owned API responses must never survive an auth boundary.
export async function clearUserQueryCache(): Promise<void> {
  userCacheEpoch += 1;
  shoppingFeedbackQueue.clear();
  await queryClient.cancelQueries();
  queryClient.clear();
}
