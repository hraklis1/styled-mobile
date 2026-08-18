import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../lib/api';
import type { Event } from '../types/event';
import { invalidateShoppingBriefQueries } from './useShoppingBrief';

export const EVENTS_QUERY_KEY = ['events'] as const;

function invalidateEventQueries(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
  invalidateShoppingBriefQueries(qc);
}

export function useEvents() {
  return useQuery({
    queryKey: EVENTS_QUERY_KEY,
    queryFn: () => api.get<Event[]>('/api/events').then((r) => r.data),
  });
}

export type EventInput = {
  title: string;
  date: Date;
  occasion: string;
  location: string | null;
  notes: string | null;
  environment: string | null;
};

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) =>
      api.post<Event>('/api/events', input).then((r) => r.data),
    onSuccess: () => invalidateEventQueries(qc),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: EventInput & { id: number }) =>
      api.patch<Event>(`/api/events/${id}`, input).then((r) => r.data),
    onMutate: async ({ id, ...input }) => {
      await qc.cancelQueries({ queryKey: EVENTS_QUERY_KEY });
      const previous = qc.getQueryData<Event[]>(EVENTS_QUERY_KEY);
      qc.setQueryData<Event[]>(EVENTS_QUERY_KEY, (old) =>
        old?.map((e) => (e.id === id ? { ...e, ...input, date: input.date.toISOString() } : e)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(EVENTS_QUERY_KEY, ctx.previous);
    },
    onSettled: () => invalidateEventQueries(qc),
  });
}

export function useAssignEventItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemIds, outfitId }: { id: number; itemIds: number[] | null; outfitId?: number | null }) =>
      api.patch<Event>(`/api/events/${id}`, { itemIds, ...(outfitId !== undefined ? { outfitId } : {}) }).then((r) => r.data),
    onMutate: async ({ id, itemIds, outfitId }) => {
      await qc.cancelQueries({ queryKey: EVENTS_QUERY_KEY });
      const previous = qc.getQueryData<Event[]>(EVENTS_QUERY_KEY);
      qc.setQueryData<Event[]>(EVENTS_QUERY_KEY, (old) =>
        old?.map((e) => (e.id === id
          ? { ...e, itemIds, outfitId: outfitId === undefined ? e.outfitId : outfitId }
          : e)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(EVENTS_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't assign items to event. Please try again.");
    },
    onSettled: () => invalidateEventQueries(qc),
  });
}

/**
 * Attach or detach the board an event was planned from.
 *
 * Deliberately its own narrow patch rather than a field on EventInput:
 * useUpdateEvent sends a whole EventInput, so folding boardId in there would
 * null the link on any unrelated edit (a rename, a time change).
 */
export function useSetEventBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, boardId }: { id: number; boardId: number | null }) =>
      api.patch<Event>(`/api/events/${id}`, { boardId }).then((r) => r.data),
    onMutate: async ({ id, boardId }) => {
      await qc.cancelQueries({ queryKey: EVENTS_QUERY_KEY });
      const previous = qc.getQueryData<Event[]>(EVENTS_QUERY_KEY);
      qc.setQueryData<Event[]>(EVENTS_QUERY_KEY, (old) =>
        old?.map((e) => (e.id === id ? { ...e, boardId } : e)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(EVENTS_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't link that board. Please try again.");
    },
    onSettled: () => invalidateEventQueries(qc),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/events/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: EVENTS_QUERY_KEY });
      const previous = qc.getQueryData<Event[]>(EVENTS_QUERY_KEY);
      qc.setQueryData<Event[]>(EVENTS_QUERY_KEY, (old) => old?.filter((e) => e.id !== id) ?? []);
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(EVENTS_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't delete event. Please try again.");
    },
    onSettled: () => invalidateEventQueries(qc),
  });
}
