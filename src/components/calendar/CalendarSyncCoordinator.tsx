import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  CONNECTIONS_KEY,
  syncCalendarConnection,
  useConnectedCalendars,
} from '../../hooks/useCalendarConnections';
import { deviceCalendarProvider } from '../../lib/device-calendar';
import { EVENTS_QUERY_KEY } from '../../hooks/useEvents';
import { invalidateShoppingBriefQueries } from '../../hooks/useShoppingBrief';

export function CalendarSyncCoordinator() {
  const { user } = useAuth();
  const connections = useConnectedCalendars(!!user);
  const qc = useQueryClient();
  const attempts = useRef(new Map<string, number>());
  useEffect(() => {
    if (!user || !connections.data) return;
    let stopped = false,
      running = false;
    const tick = async () => {
      if (running || stopped || AppState.currentState !== 'active') return;
      running = true;
      let attempted = false;
      try {
        const device = await deviceCalendarProvider();
        for (const connection of connections.data.connections) {
          if (stopped) break;
          if (
            !connection.settings.automatic ||
            !connection.settings.calendarIds.length
          )
            continue;
          if (
            connection.provider.startsWith('device:') &&
            connection.provider !== device
          )
            continue;
          if (
            connection.last_synced_at &&
            Date.now() - +new Date(connection.last_synced_at) < 5 * 60000
          )
            continue;
          const key = `${user.id}:${connection.provider}`;
          if (Date.now() - (attempts.current.get(key) ?? 0) < 5 * 60000)
            continue;
          attempts.current.set(key, Date.now());
          attempted = true;
          try {
            await syncCalendarConnection(connection, true);
            if (stopped) break;
            void qc.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
            invalidateShoppingBriefQueries(qc);
          } catch {
            /* Provider status is visible in Calendars & sync. Retry on next foreground. */
          }
        }
        if (!stopped && attempted)
          void qc.invalidateQueries({ queryKey: CONNECTIONS_KEY });
      } finally {
        running = false;
      }
    };
    void tick();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void tick();
    });
    const timer = setInterval(() => void tick(), 5 * 60000);
    return () => {
      stopped = true;
      subscription.remove();
      clearInterval(timer);
    };
  }, [user?.id, connections.data, qc]);
  return null;
}
