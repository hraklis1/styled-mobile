import {
  deviceCalendarSnapshot,
  listDeviceCalendars,
} from '../device-calendar';
import * as Calendar from 'expo-calendar';

jest.mock('expo-calendar', () => ({
  EntityTypes: { EVENT: 'event' },
  getCalendarPermissions: jest.fn(),
  requestCalendarPermissions: jest.fn(),
  getCalendars: jest.fn(),
  listEvents: jest.fn(),
}));
jest.mock('../deviceStorage', () => ({
  getDeviceValue: jest.fn(),
  setDeviceValue: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'fixture-device' }));
const granted = { granted: true } as Awaited<
  ReturnType<typeof Calendar.getCalendarPermissions>
>;

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(Calendar.getCalendarPermissions).mockResolvedValue(granted);
  jest.mocked(Calendar.requestCalendarPermissions).mockResolvedValue(granted);
  jest
    .mocked(Calendar.getCalendars)
    .mockResolvedValue([
      { id: 'work', title: 'Work', source: { name: 'Outlook' } },
    ] as Calendar.ExpoCalendar[]);
});
it('does not prompt for permission during automatic sync', async () => {
  await listDeviceCalendars();
  expect(Calendar.requestCalendarPermissions).not.toHaveBeenCalled();
});
it('rejects revoked permission instead of posting an empty snapshot', async () => {
  jest
    .mocked(Calendar.getCalendarPermissions)
    .mockResolvedValue({ granted: false } as typeof granted);
  await expect(deviceCalendarSnapshot(['work'])).rejects.toThrow(
    'Calendar access is off',
  );
  expect(Calendar.listEvents).not.toHaveBeenCalled();
});
it('rejects a missing calendar so temporary account loss cannot cancel every linked event', async () => {
  await expect(deviceCalendarSnapshot(['missing'])).rejects.toThrow(
    'unavailable',
  );
  expect(Calendar.listEvents).not.toHaveBeenCalled();
});
it('keeps recurring occurrences distinct and uses original date for moved occurrences', async () => {
  jest.mocked(Calendar.listEvents).mockResolvedValue([
    {
      id: 'series',
      calendarId: 'work',
      title: 'Meeting',
      startDate: '2026-11-03T16:00:00Z',
      endDate: '2026-11-03T17:00:00Z',
      originalStartDate: '2026-11-03T14:00:00Z',
      recurrenceRule: {},
      allDay: false,
    },
    {
      id: 'series',
      calendarId: 'work',
      title: 'Meeting',
      startDate: '2026-11-10T14:00:00Z',
      endDate: '2026-11-10T15:00:00Z',
      originalStartDate: '2026-11-10T14:00:00Z',
      recurrenceRule: {},
      allDay: false,
    },
  ] as Calendar.ExpoCalendarEvent[]);
  const events = await deviceCalendarSnapshot(['work']);
  expect(events[0].key).toBe(
    JSON.stringify(['work', 'series', '2026-11-03T14:00:00.000Z']),
  );
  expect(new Set(events.map((e) => e.key)).size).toBe(2);
});
