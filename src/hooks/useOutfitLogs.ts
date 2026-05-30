import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../lib/api';
import { ITEMS_QUERY_KEY } from './useItems';

export type OutfitScanResult = {
  detected_type: string;
  match_id: number | null;
  confidence: 'High' | 'Medium' | 'Low';
  suggested_metadata: {
    name: string;
    color: string;
    category: string;
    material?: string | null;
    style?: string | null;
  };
  potential_match_ids: number[];
  bbox: { x: number; y: number; width: number; height: number } | null;
};

export type OutfitLog = {
  id: number;
  userId: number;
  date: string;
  itemIds: number[];
  notes: string | null;
  location: string | null;
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
};

export function useCreateOutfitLog() {
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
      Alert.alert('Error', "Couldn't log outfit. Please try again.");
    },
  });
}

export function useScanOutfitLog() {
  return useMutation({
    mutationFn: (imageData: string) =>
      api
        .post<{ items: OutfitScanResult[] }>('/api/outfit-logs/scan', { imageData })
        .then((r) => r.data.items),
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
