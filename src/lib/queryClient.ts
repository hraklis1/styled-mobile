import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
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

// Persists the full query cache to AsyncStorage between app sessions.
// Bump the `key` string whenever query shapes change to invalidate stale caches.
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'STYLED_QUERY_CACHE_v1',
  throttleTime: 1000, // debounce writes to AsyncStorage (ms)
});
