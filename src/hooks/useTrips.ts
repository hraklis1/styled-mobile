import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { api } from '../lib/api';
import type { Trip, TripSummary } from '../features/trips/types';

export const TRIPS_QUERY_KEY = ['trips'] as const;
export const tripQueryKey = (id: number) => ['trips', id] as const;

/** Saved trips: upcoming and current first, then past. */
export function useTrips(enabled = true) {
  return useQuery({
    queryKey: TRIPS_QUERY_KEY,
    queryFn: () => api.get<TripSummary[]>('/api/trips').then((r) => (Array.isArray(r.data) ? r.data : [])),
    enabled,
    staleTime: 60_000,
  });
}

export function useTrip(id: number | null) {
  return useQuery({
    queryKey: tripQueryKey(id ?? 0),
    queryFn: () => api.get<Trip>(`/api/trips/${id}`).then((r) => r.data),
    enabled: id != null,
  });
}

/**
 * Packed state is written whole and applied optimistically, so ticking through
 * a list never waits on the network. A failure rolls back to the last good copy.
 */
export function useSetTripPacked(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (next: { itemIds: number[]; extras: string[] }) =>
      api.put<{ packedItemIds: number[]; packedExtras: string[] }>(`/api/trips/${id}/packed`, next).then((r) => r.data),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: tripQueryKey(id) });
      const previous = qc.getQueryData<Trip>(tripQueryKey(id));
      qc.setQueryData<Trip>(tripQueryKey(id), (old) => (old ? { ...old, packedItemIds: next.itemIds, packedExtras: next.extras } : old));
      return { previous };
    },
    onError: (_err, _next, context) => {
      if (context?.previous) qc.setQueryData(tripQueryKey(id), context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: TRIPS_QUERY_KEY, exact: true }),
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/trips/${id}`),
    onSuccess: (_res, id) => {
      qc.setQueryData<TripSummary[]>(TRIPS_QUERY_KEY, (old = []) => old.filter((t) => t.id !== id));
      qc.removeQueries({ queryKey: tripQueryKey(id) });
    },
    onError: () => Alert.alert('Error', "Couldn't delete that trip. Please try again."),
  });
}
