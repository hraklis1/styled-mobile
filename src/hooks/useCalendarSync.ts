import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { EVENTS_QUERY_KEY } from './useEvents';

export interface CalendarConnections {
  google: { connected: boolean; tokenExpiry: string | null };
  apple: { connected: boolean };
}

export interface CalendarPreviewEvent {
  externalId: string;
  title: string;
  date: string;
  location: string | null;
  occasion: string;
  alreadyImported: boolean;
}

export const CALENDAR_CONNECTIONS_KEY = ['/api/calendar/connections'] as const;

export function useCalendarConnections() {
  return useQuery<CalendarConnections>({
    queryKey: CALENDAR_CONNECTIONS_KEY,
    queryFn: () => api.get<CalendarConnections>('/api/calendar/connections').then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useGoogleCalendarPreview(enabled: boolean) {
  return useQuery<CalendarPreviewEvent[]>({
    queryKey: ['/api/calendar/google/preview'],
    enabled,
    staleTime: 0,
    queryFn: () =>
      api.get<CalendarPreviewEvent[]>('/api/calendar/google/preview').then((r) => r.data),
  });
}

export function useAppleCalendarPreview(enabled: boolean) {
  return useQuery<CalendarPreviewEvent[]>({
    queryKey: ['/api/calendar/apple/preview'],
    enabled,
    staleTime: 0,
    queryFn: () =>
      api.get<CalendarPreviewEvent[]>('/api/calendar/apple/preview').then((r) => r.data),
  });
}

export function useImportGoogleCalendarEvents() {
  const qc = useQueryClient();
  return useMutation<{ created: number; updated: number; total: number }, Error, string[]>({
    mutationFn: (externalIds) =>
      api.post('/api/calendar/google/sync', { externalIds }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: CALENDAR_CONNECTIONS_KEY });
      qc.invalidateQueries({ queryKey: ['/api/calendar/google/preview'] });
    },
  });
}

export function useImportAppleCalendarEvents() {
  const qc = useQueryClient();
  return useMutation<{ created: number; updated: number; total: number }, Error, string[]>({
    mutationFn: (externalIds) =>
      api.post('/api/calendar/apple/sync', { externalIds }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['/api/calendar/apple/preview'] });
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/api/calendar/google/disconnect'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CALENDAR_CONNECTIONS_KEY });
    },
  });
}

export function useConnectAppleCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) =>
      api.post('/api/calendar/apple/connect', { url }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CALENDAR_CONNECTIONS_KEY });
    },
  });
}

export function useDisconnectAppleCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/api/calendar/apple/disconnect'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CALENDAR_CONNECTIONS_KEY });
    },
  });
}
