import { QueryClient } from '@tanstack/react-query';
import { isNetworkError } from './api';

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

// User-owned API responses must never survive an auth boundary.
export async function clearUserQueryCache(): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
}
