import * as Calendar from 'expo-calendar';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { getDeviceValue, setDeviceValue } from './deviceStorage';

export type ConnectedCalendar = {
  id: string;
  name: string;
  color?: string;
  primary?: boolean;
};
export type CalendarSnapshotEvent = {
  key: string;
  calendarId: string;
  title: string;
  date: string;
  endDate: string;
  location: string | null;
  notes: string | null;
  allDay: boolean;
  allDayDate?: string;
  timeZone?: string;
};
let deviceIdPromise: Promise<string> | undefined;
export function deviceCalendarProvider() {
  deviceIdPromise ??= (async () => {
    const saved = await getDeviceValue('calendarDeviceId');
    if (saved) return `device:${saved}`;
    const id = Crypto.randomUUID();
    await setDeviceValue('calendarDeviceId', id);
    return `device:${id}`;
  })();
  return deviceIdPromise;
}
export async function listDeviceCalendars(
  request = false,
): Promise<ConnectedCalendar[]> {
  if (Platform.OS === 'web')
    throw new Error('Connect device calendars from the iOS or Android app.');
  const permission = request
    ? await Calendar.requestCalendarPermissions()
    : await Calendar.getCalendarPermissions();
  if (!permission.granted)
    throw new Error(
      'Calendar access is off. Allow access in your device settings, then try again.',
    );
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return calendars.map((c) => ({
    id: c.id,
    name: `${c.title}${c.source?.name ? ` · ${c.source.name}` : ''}`,
    color: c.color,
    primary: c.isPrimary,
  }));
}
export async function deviceCalendarSnapshot(
  ids: string[],
): Promise<CalendarSnapshotEvent[]> {
  const available = await listDeviceCalendars();
  if (ids.some((id) => !available.some((c) => c.id === id)))
    throw new Error(
      'A selected calendar is unavailable. Choose calendars again before syncing.',
    );
  if (ids.length === 0) return [];
  const start = new Date(Date.now() - 30 * 86400000),
    end = new Date(Date.now() + 365 * 86400000);
  const events = await Calendar.listEvents(ids, start, end);
  return events.map((e) => {
    const date = new Date(e.startDate);
    // The OS expands recurrence. Include occurrence identity so a series never
    // collapses to a single Styled event; use original occurrence for overrides.
    const occurrence =
      e.recurrenceRule || e.originalStartDate
        ? new Date(e.originalStartDate ?? e.startDate).toISOString()
        : '';
    return {
      key: JSON.stringify([e.calendarId, e.id, occurrence]),
      calendarId: e.calendarId,
      title: (e.title || 'Untitled event').slice(0, 200),
      date: date.toISOString(),
      endDate: new Date(e.endDate).toISOString(),
      location: e.location?.slice(0, 200) ?? null,
      notes: e.notes?.slice(0, 1000) ?? null,
      allDay: !!e.allDay,
      allDayDate: e.allDay
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : undefined,
      timeZone: e.timeZone || undefined,
    };
  });
}
