import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  deviceCalendarSnapshot,
  type ConnectedCalendar,
} from '../lib/device-calendar';
import { EVENTS_QUERY_KEY } from './useEvents';
import { invalidateShoppingBriefQueries } from './useShoppingBrief';

export type CalendarConnection = {
  provider: string;
  settings: {
    calendarIds: string[];
    automatic: boolean;
    calendars?: ConnectedCalendar[];
  };
  last_synced_at: string | null;
  last_error: string | null;
};
export type CalendarConnectionData = {
  connections: CalendarConnection[];
};
export const CONNECTIONS_KEY = ['calendar-connections-v2'] as const;
export function useConnectedCalendars(enabled = true) {
  return useQuery({
    queryKey: CONNECTIONS_KEY,
    enabled,
    queryFn: () =>
      api
        .get<CalendarConnectionData>('/api/calendar/v2/connections')
        .then((r) => r.data),
    staleTime: 30000,
  });
}
export function useAvailableCalendars(provider: string | null) {
  return useQuery({
    queryKey: ['available-calendars', provider],
    enabled: !!provider && !provider.startsWith('device:'),
    queryFn: () =>
      api
        .get<ConnectedCalendar[]>(
          `/api/calendar/v2/${encodeURIComponent(provider!)}/calendars`,
        )
        .then((r) => r.data),
  });
}
export async function syncCalendarConnection(
  connection: CalendarConnection,
  automaticOnly = false,
) {
  let events;
  if (connection.provider.startsWith('device:')) {
    try {
      events = await deviceCalendarSnapshot(connection.settings.calendarIds);
    } catch (error) {
      const message = (error as Error).message;
      const reason = message.includes('Calendar access is off')
        ? 'permission'
        : 'unavailable';
      await api
        .post(
          `/api/calendar/v2/${encodeURIComponent(connection.provider)}/device-status`,
          { reason },
        )
        .catch(() => {});
      throw error;
    }
  }
  return api
    .post<{ created: number; updated: number; cancelled: number }>(
      `/api/calendar/v2/${encodeURIComponent(connection.provider)}/sync`,
      events ? { events, automaticOnly } : { automaticOnly },
    )
    .then((r) => r.data);
}
export function useCalendarActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    void qc.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
    invalidateShoppingBriefQueries(qc);
  };
  const sync = useMutation({
    mutationFn: (connection: CalendarConnection) =>
      syncCalendarConnection(connection),
    onSettled: refresh,
  });
  const save = useMutation({
    mutationFn: ({
      provider,
      ...settings
    }: CalendarConnection['settings'] & { provider: string }) =>
      api.put(
        `/api/calendar/v2/${encodeURIComponent(provider)}/settings`,
        settings,
      ),
    onSuccess: refresh,
  });
  const disconnect = useMutation({
    mutationFn: (provider: string) =>
      api.delete(`/api/calendar/v2/${encodeURIComponent(provider)}`),
    onSuccess: refresh,
  });
  const feed = useMutation({
    mutationFn: (url: string) => api.post('/api/calendar/v2/feed', { url }),
    onSuccess: refresh,
  });
  return { sync, save, disconnect, feed, refresh };
}
