import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity, Text } from 'react-native';
import { CalendarSyncSheet } from '../CalendarSyncSheet';
import { listDeviceCalendars } from '../../../lib/device-calendar';
import {
  useCalendarActions,
  useConnectedCalendars,
  useAvailableCalendars,
} from '../../../hooks/useCalendarConnections';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@expo/ui', () => ({ Host: 'NativeHost', Switch: 'NativeSwitch' }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('../../../lib/device-calendar', () => ({
  deviceCalendarProvider: () => Promise.resolve('device:fixture'),
  listDeviceCalendars: jest.fn(),
}));
jest.mock('../../../lib/api', () => ({
  api: {},
  API_BASE_URL: 'https://api.styled.test',
}));
jest.mock('../../../hooks/useCalendarConnections', () => ({
  useCalendarActions: jest.fn(),
  useConnectedCalendars: jest.fn(),
  useAvailableCalendars: jest.fn(),
  connectOutlookCalendar: jest.fn(),
}));
const save = jest.fn(),
  sync = jest.fn();
let renderer: TestRenderer.ReactTestRenderer;
function button(label: string) {
  return renderer.root
    .findAllByType(TouchableOpacity)
    .find((node) =>
      node.findAllByType(Text).some((t) => t.props.children === label),
    )!;
}
async function render() {
  await act(async () => {
    renderer = TestRenderer.create(
      <CalendarSyncSheet visible onClose={jest.fn()} />,
    );
  });
}
beforeEach(() => {
  jest.resetAllMocks();
  save.mockResolvedValue({});
  sync.mockResolvedValue({});
  jest
    .mocked(useConnectedCalendars)
    .mockReturnValue({
      data: {
        connections: [
          {
            provider: 'google',
            settings: { calendarIds: ['primary'], automatic: true },
            last_synced_at: null,
            last_error: null,
          },
        ],
        outlookAvailable: false,
      },
      refetch: jest.fn(),
    } as any);
  jest.mocked(useAvailableCalendars).mockReturnValue({
    data: [
      { id: 'owner@example.test', name: 'Personal', primary: true },
      { id: 'work', name: 'Work' },
    ],
  } as any);
  jest
    .mocked(useCalendarActions)
    .mockReturnValue({
      save: { mutateAsync: save },
      sync: { mutateAsync: sync },
      disconnect: {},
      feed: {},
    } as any);
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
});
it('keeps the calendar selection open with its draft when a save fails', async () => {
  await render();
  await act(async () => button('Choose calendars').props.onPress());
  save.mockRejectedValueOnce(new Error('Please try again.'));
  await act(async () => button('Sync 1 calendar').props.onPress());
  expect(save).toHaveBeenCalledWith({
    provider: 'google',
    calendarIds: ['primary'],
    automatic: true,
  });
  expect(sync).not.toHaveBeenCalled();
  expect(button('Sync 1 calendar')).toBeDefined();
  expect(
    renderer.root
      .findAllByType(Text)
      .some((t) => t.props.children === 'Please try again.'),
  ).toBe(true);
  await act(async () => button('Sync 1 calendar').props.onPress());
  expect(sync).toHaveBeenCalledTimes(1);
  expect(button('Choose calendars')).toBeDefined();
});
it('an empty selection saves without importing or clearing prior events', async () => {
  await render();
  await act(async () => button('Choose calendars').props.onPress());
  const primary = renderer.root
    .findAllByType(TouchableOpacity)
    .find(
      (node) =>
        node.props.accessibilityRole === 'checkbox' &&
        node.props.accessibilityState.checked,
    )!;
  await act(async () => primary.props.onPress());
  await act(async () => button('Save without syncing').props.onPress());
  expect(save).toHaveBeenCalledWith({
    provider: 'google',
    calendarIds: [],
    automatic: true,
  });
  expect(sync).not.toHaveBeenCalled();
});

it('opens the device chooser immediately while calendar access is pending', async () => {
  let finish!: (calendars: any[]) => void;
  jest.mocked(listDeviceCalendars).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await render();
  await act(async () => button('Apple & device calendars').props.onPress());
  expect(listDeviceCalendars).toHaveBeenCalledWith(true);
  expect(renderer.root.findAllByType(Text).some((t) => t.props.children === 'Choose calendars')).toBe(true);
  expect(button('Save without syncing').props.disabled).toBe(true);
  await act(async () => finish([{ id: 'device-work', name: 'Device work' }]));
  expect(renderer.root.findAllByType(Text).some((t) => t.props.children === 'Device work')).toBe(true);
});
it('shows permission failures inside the device chooser and allows retrying', async () => {
  jest.mocked(listDeviceCalendars)
    .mockRejectedValueOnce(new Error('Calendar access is off. Allow access in your device settings, then try again.'))
    .mockResolvedValueOnce([{ id: 'work', name: 'Device work' }]);
  await render();
  await act(async () => button('Apple & device calendars').props.onPress());
  expect(button('Open settings')).toBeDefined();
  expect(button('Try again')).toBeDefined();
  await act(async () => button('Try again').props.onPress());
  expect(renderer.root.findAllByType(Text).some((t) => t.props.children === 'Device work')).toBe(true);
});

function hasText(text: string) {
  return renderer.root.findAllByType(Text).some((node) => node.props.children === text);
}
it('leads with management for existing connections without an onboarding introduction', async () => {
  await render();
  expect(hasText('CONNECTED CALENDARS')).toBe(true);
  expect(hasText('Your plans, beautifully in sync.')).toBe(false);
  expect(button('Choose calendars')).toBeDefined();
  expect(button('Outlook')).toBeUndefined();
});
it('does not flash onboarding while loading connections', async () => {
  jest.mocked(useConnectedCalendars).mockReturnValue({ isPending: true } as any);
  await render();
  expect(hasText('Your plans, beautifully in sync.')).toBe(false);
  expect(hasText('ADD A CALENDAR')).toBe(false);
});
it('offers a short introduction only after loading an empty connection list', async () => {
  jest.mocked(useConnectedCalendars).mockReturnValue({ data: { connections: [], outlookAvailable: true } } as any);
  await render();
  expect(hasText('Your plans, beautifully in sync.')).toBe(true);
  expect(button('Google Calendar')).toBeDefined();
  expect(button('Outlook')).toBeDefined();
});
it('keeps zero-selected connections in management and guides setup', async () => {
  const query = jest.mocked(useConnectedCalendars).getMockImplementation()!();
  jest.mocked(useConnectedCalendars).mockReturnValue({ ...query, data: { ...query.data, connections: [{ ...query.data!.connections[0], settings: { calendarIds: [], automatic: true } }] } } as any);
  await render();
  expect(hasText('Your plans, beautifully in sync.')).toBe(false);
  expect(hasText('Choose calendars to begin')).toBe(true);
  expect(button('Sync now').props.disabled).toBe(true);
  expect(button('Choose calendars').props.disabled).toBe(false);
});
it('offers retry instead of introduction when connections fail to load', async () => {
  const refetch = jest.fn();
  jest.mocked(useConnectedCalendars).mockReturnValue({ isError: true, refetch } as any);
  await render();
  expect(hasText('Your plans, beautifully in sync.')).toBe(false);
  expect(hasText('Could not load your calendar connections.')).toBe(true);
  await act(async () => button('Try again').props.onPress());
  expect(refetch).toHaveBeenCalledTimes(1);
});
it('lets an empty device calendar list refresh without leaving the chooser', async () => {
  jest.mocked(listDeviceCalendars).mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'work', name: 'Device work' }]);
  jest.mocked(useAvailableCalendars).mockReturnValue({ isPending: true } as any);
  await render();
  await act(async () => button('Apple & device calendars').props.onPress());
  await act(async () => button('Refresh calendars').props.onPress());
  expect(hasText('Device work')).toBe(true);
  expect(listDeviceCalendars).toHaveBeenCalledTimes(2);
});
