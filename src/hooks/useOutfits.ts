import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { api, isNetworkError } from '../lib/api';
import { track } from '../lib/analytics';
import type { Outfit, OutfitItemEntry } from '../types/outfit';

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
  itemIds?: OutfitItemEntry[];
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
      track('outfit_created', { outfitId: newOutfit.id });
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
  candidateId: string;
  outfitName: string;
  stylistNotes: string | null;
  itemIds: number[];
  missingEssentials: Array<{
    label: string;
    category: string;
    reason: string;
    context: string;
    priority: number;
  }>;
  recommendationId: number | null;
};

export function useGenerateEventOutfitPlan() {
  return useMutation({
    mutationFn: ({
      eventId,
      ...input
    }: {
      eventId: number;
      lat?: number;
      lon?: number;
      previousCandidateId?: string;
    }) =>
      api.post<GenerateOutfitResult>(`/api/events/${eventId}/outfit-plan`, input).then((r) => r.data),
    retry: (failureCount, error) => isNetworkError(error) && failureCount < 2,
    onSuccess: (_result, { eventId, previousCandidateId }) => {
      track('calendar_outfit_plan_generated', {
        eventId,
        isAlternative: !!previousCandidateId,
      });
    },
  });
}

export function useAcceptEventOutfitPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, candidateId }: { eventId: number; candidateId: string }) =>
      api
        .post<{ outfit: Outfit; itemIds: number[] }>(`/api/events/${eventId}/outfit-plan/accept`, {
          candidateId,
        })
        .then((r) => r.data),
    onSuccess: (_result, { eventId }) => {
      qc.invalidateQueries({ queryKey: OUTFITS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['events'] });
      track('calendar_outfit_plan_accepted', { eventId });
    },
  });
}

export function useVisualizeOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force = false }: { id: number; force?: boolean }) =>
      api
        .post<{ aiGeneratedImageUrl: string }>(`/api/outfits/${id}/visualize`, { force }, { timeout: 180_000 })
        .then((r) => r.data),
    onSuccess: (data, { id }) => {
      qc.setQueryData<Outfit[]>(OUTFITS_QUERY_KEY, (old) =>
        old?.map((o) => (o.id === id ? { ...o, aiGeneratedImageUrl: data.aiGeneratedImageUrl } : o)) ?? []
      );
      track('outfit_visualized', { outfitId: id });
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
