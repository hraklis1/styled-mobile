import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../lib/api';
import { ITEMS_QUERY_KEY } from './useItems';

export type OutfitLog = {
  id: number;
  userId: number;
  date: string;
  itemIds: number[];
  notes: string | null;
  location: string | null;
  rating: number | null;
  /** The scan photo, when the log came from one. */
  imageUrl?: string | null;
  createdAt: string;
};

export const OUTFIT_LOGS_QUERY_KEY = ['outfit-logs'] as const;

export function useOutfitLogs() {
  return useQuery({
    queryKey: OUTFIT_LOGS_QUERY_KEY,
    queryFn: () => api.get<OutfitLog[]>('/api/outfit-logs').then((r) => r.data),
  });
}

export type CreateOutfitLogInput = {
  itemIds: number[];
  date?: string;
  notes?: string;
  location?: string;
  rating?: number | null;
};

export function useCreateOutfitLog({ alertOnError = true }: { alertOnError?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOutfitLogInput) =>
      api.post<OutfitLog>('/api/outfit-logs', input).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OUTFIT_LOGS_QUERY_KEY });
      // Logging wear increments wearCount on the server
      qc.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
    },
    onError: () => {
      // Callers that show the failure in place opt out of the alert.
      if (alertOnError) Alert.alert('Error', "Couldn't log outfit. Please try again.");
    },
  });
}

export function useDeleteOutfitLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/outfit-logs/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: OUTFIT_LOGS_QUERY_KEY });
      const previous = qc.getQueryData<OutfitLog[]>(OUTFIT_LOGS_QUERY_KEY);
      qc.setQueryData<OutfitLog[]>(
        OUTFIT_LOGS_QUERY_KEY,
        (old) => old?.filter((l) => l.id !== id) ?? []
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(OUTFIT_LOGS_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't delete log entry. Please try again.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: OUTFIT_LOGS_QUERY_KEY }),
  });
}
