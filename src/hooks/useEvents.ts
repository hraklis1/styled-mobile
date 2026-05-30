import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../lib/api';
import type { Event } from '../types/event';

export const EVENTS_QUERY_KEY = ['events'] as const;

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
    },
    onError: () => {
      Alert.alert('Error', "Couldn't create event. Please try again.");
    },
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
      Alert.alert('Error', "Couldn't update event. Please try again.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: EVENTS_QUERY_KEY }),
  });
}

export function useAssignEventItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemIds }: { id: number; itemIds: number[] | null }) =>
      api.patch<Event>(`/api/events/${id}`, { itemIds }).then((r) => r.data),
    onMutate: async ({ id, itemIds }) => {
      await qc.cancelQueries({ queryKey: EVENTS_QUERY_KEY });
      const previous = qc.getQueryData<Event[]>(EVENTS_QUERY_KEY);
      qc.setQueryData<Event[]>(EVENTS_QUERY_KEY, (old) =>
        old?.map((e) => (e.id === id ? { ...e, itemIds } : e)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(EVENTS_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't assign items to event. Please try again.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: EVENTS_QUERY_KEY }),
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
    onSettled: () => qc.invalidateQueries({ queryKey: EVENTS_QUERY_KEY }),
  });
}
