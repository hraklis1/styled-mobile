import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { api, isNetworkError } from '../lib/api';
import type { Outfit } from '../types/outfit';

export const OUTFITS_QUERY_KEY = ['outfits'] as const;

function invalidateOutfitQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: OUTFITS_QUERY_KEY });
}

export type CreateOutfitInput = {
  name: string;
  description?: string | null;
  event?: string | null;
  notes?: string | null;
  tags?: string[];
  topId?: number | null;
  bottomId?: number | null;
  shoesId?: number | null;
  outerwearId?: number | null;
  accessoryId?: number | null;
};

export function useOutfits() {
  return useQuery({
    queryKey: OUTFITS_QUERY_KEY,
    queryFn: () => api.get<Outfit[]>('/api/outfits').then((r) => r.data),
  });
}

export function useCreateOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOutfitInput) =>
      api.post<Outfit>('/api/outfits', input).then((r) => r.data),
    onSuccess: (newOutfit) => {
      qc.setQueryData<Outfit[]>(OUTFITS_QUERY_KEY, (old = []) => [newOutfit, ...old]);
    },
    onError: () => {
      Alert.alert('Error', "Couldn't save outfit. Please try again.");
    },
    onSettled: () => invalidateOutfitQueries(qc),
  });
}

export function useUpdateOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Outfit> & { id: number }) =>
      api.patch<Outfit>(`/api/outfits/${id}`, patch).then((r) => r.data),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: OUTFITS_QUERY_KEY });
      const previous = qc.getQueryData<Outfit[]>(OUTFITS_QUERY_KEY);
      qc.setQueryData<Outfit[]>(OUTFITS_QUERY_KEY, (old) =>
        old?.map((o) => (o.id === id ? { ...o, ...patch } : o)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(OUTFITS_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't update outfit. Please try again.");
    },
    onSettled: () => invalidateOutfitQueries(qc),
  });
}

export function useMarkOutfitWorn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/api/outfits/${id}/worn`).then((r) => r.data as Outfit),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: OUTFITS_QUERY_KEY });
      const previous = qc.getQueryData<Outfit[]>(OUTFITS_QUERY_KEY);
      qc.setQueryData<Outfit[]>(OUTFITS_QUERY_KEY, (old) =>
        old?.map((o) =>
          o.id === id
            ? { ...o, wearCount: o.wearCount + 1, lastWornAt: new Date().toISOString() }
            : o
        ) ?? []
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(OUTFITS_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't mark outfit as worn. Please try again.");
    },
    onSettled: () => invalidateOutfitQueries(qc),
  });
}

export type GenerateOutfitResult = {
  outfit: { id: number; name: string };
  outfitName: string;
  stylistNotes: string | null;
  itemIds: number[];
};

export function useGenerateOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { eventId: number; lat?: number; lon?: number }) =>
      api.post<GenerateOutfitResult>('/api/outfits/generate', args).then((r) => r.data),
    retry: (failureCount, error) => isNetworkError(error) && failureCount < 2,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OUTFITS_QUERY_KEY });
    },
  });
}

export function useVisualizeOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      // MOCK — bypass DALL-E backend during simulator prototyping
      // return api
      //   .post<{ aiGeneratedImageUrl: string }>(`/api/outfits/${id}/visualize`, undefined, { timeout: 120_000 })
      //   .then((r) => r.data);

      // Simulate 3–4 s network delay to test FlatLayLoadingOverlay animations
      await new Promise<void>((resolve) =>
        setTimeout(resolve, 3000 + Math.random() * 1000)
      );

      const dest = `${FileSystem.documentDirectory}mock-flatlay-${id}-${Date.now()}.jpg`;
      const { uri } = await FileSystem.downloadAsync('https://picsum.photos/1024', dest);
      return { aiGeneratedImageUrl: uri };
    },
    onSuccess: (data, id) => {
      qc.setQueryData<Outfit[]>(OUTFITS_QUERY_KEY, (old) =>
        old?.map((o) => (o.id === id ? { ...o, aiGeneratedImageUrl: data.aiGeneratedImageUrl } : o)) ?? []
      );
    },
  });
}

export function useDeleteOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/outfits/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: OUTFITS_QUERY_KEY });
      const previous = qc.getQueryData<Outfit[]>(OUTFITS_QUERY_KEY);
      qc.setQueryData<Outfit[]>(OUTFITS_QUERY_KEY, (old) => old?.filter((o) => o.id !== id) ?? []);
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(OUTFITS_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't delete outfit. Please try again.");
    },
    onSettled: () => invalidateOutfitQueries(qc),
  });
}
