import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import type { Event } from '../../../types/event';

jest.mock('@react-navigation/native', () => ({ useScrollToTop: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: require('react-native').View }, useReducedMotion: () => true }));
const mockScroll = jest.fn();
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  return { FlashList: React.forwardRef(function MockFlashList(props: any, ref: any) {
    React.useImperativeHandle(ref, () => ({ scrollToIndex: mockScroll }));
    return React.createElement('FlashList', props, props.data.map((item: any, index: number) =>
      React.createElement(React.Fragment, { key: item.key }, props.renderItem({ item, index, target: 'Cell' })),
    ));
  }) };
});
jest.mock('../../../components/primitives/ConfirmSheet', () => ({ confirmSheet: jest.fn() }));
jest.mock('../../../components/primitives/ErrorState', () => ({ ErrorState: 'ErrorState' }));
jest.mock('../../../components/primitives/ActionMenuSheet', () => ({ ActionMenuSheet: 'ActionMenuSheet' }));
jest.mock('../../../components/calendar/CalendarSyncSheet', () => ({ CalendarSyncSheet: 'CalendarSyncSheet' }));
jest.mock('../../../components/calendar/WeekStrip', () => ({ WeekStrip: 'WeekStrip' }));
jest.mock('../../../components/calendar/NextEventHero', () => ({ NextEventHero: 'NextEventHero' }));
jest.mock('../../../components/calendar/AgendaEventRow', () => ({ AgendaEventRow: 'AgendaEventRow', AllDayLine: 'AllDayLine' }));
jest.mock('../../../components/calendar/EventFormModal', () => ({ EventFormModal: 'EventFormModal' }));
jest.mock('../../../components/calendar/EventDetailModal', () => ({ EventDetailModal: 'EventDetailModal' }));
jest.mock('../../../components/calendar/EventItemPickerModal', () => ({ EventItemPickerModal: 'EventItemPickerModal' }));
jest.mock('../../../components/calendar/EventOutfitPickerModal', () => ({ EventOutfitPickerModal: 'EventOutfitPickerModal' }));
jest.mock('../../../hooks/useEntitlement', () => ({ useEntitlement: () => ({ isPremium: true }) }));
jest.mock('../../../hooks/useActiveStylingLocation', () => ({ useActiveStylingLocation: () => ({ activeLocation: null }) }));
jest.mock('../../../hooks/useItems', () => ({ useItems: () => ({ data: [] }) }));
jest.mock('../../../hooks/useOutfits', () => ({ useOutfits: () => ({ data: [] }) }));
let mockTrips: any[] = [];
jest.mock('../../../hooks/useTrips', () => ({ useTrips: () => ({ data: mockTrips }) }));
jest.mock('../../../components/trips/TripDetailModal', () => ({ TripDetailModal: 'TripDetailModal' }));
let mockLogs: { date: string; itemIds: number[] }[] = [];
const mockCreateLog = jest.fn();
jest.mock('../../../hooks/useOutfitLogs', () => ({
  useOutfitLogs: () => ({ data: mockLogs }),
  useCreateOutfitLog: () => ({ mutate: mockCreateLog }),
}));
jest.mock('../../../lib/haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));
jest.mock('../../../hooks/useBoards', () => ({ useBoards: () => ({ data: [] }) }));
const mockOpenLogger = jest.fn();
jest.mock('../../../contexts/GlobalOutfitLoggerContext', () => ({ useGlobalOutfitLogger: () => ({ openLogger: mockOpenLogger }) }));
const mockOpenStylist = jest.fn();
jest.mock('../../../contexts/GlobalAIStylistContext', () => ({ useGlobalAIStylist: () => ({ openStylist: mockOpenStylist }) }));
jest.mock('../../../lib/dailyLookPresentation', () => ({ shoppingPriorityFromDailyLookGap: jest.fn() }));
jest.mock('../../../lib/entitlementGate', () => ({ ensureEntitled: jest.fn() }));
jest.mock('../../../lib/api', () => ({ API_BASE_URL: 'https://api.styled.test', api: {} }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
let mockEvents: Event[];
jest.mock('../../../hooks/useEvents', () => ({
  useEvents: () => ({ data: mockEvents, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn() }),
  useDeleteEvent: () => ({ mutate: jest.fn() }),
  useSetEventBoard: () => ({ mutateAsync: jest.fn() }),
}));
import { CalendarScreen } from '../CalendarScreen';

const event = (id: number, title: string, date: string, extra: Partial<Event> = {}): Event => ({
  id, title, date, userId: 1, occasion: 'casual', location: null, notes: null,
  environment: null, itemIds: null, outfitId: null, ...extra,
});
const allDay = (date: string) => ({ calendarMetadata: {
  calendarId: 'work', calendarName: 'Work', allDay: true, allDayDate: date, cancelled: false, syncedAt: '2026-10-13T12:00:00Z',
} });
const navigation = { navigate: jest.fn(), setParams: jest.fn() };
let renderer: TestRenderer.ReactTestRenderer;
const nodes = (name: string) => renderer.root.findAllByType(name as any);
const strip = () => nodes('WeekStrip')[0];
const list = () => nodes('FlashList')[0];
const scrollIntoHistory = () => act(() => { list().props.onScrollBeginDrag(); list().props.onStartReached(); });
const texts = () => renderer.root.findAllByType(Text).map((node) => node.props.children);
const rowTitles = () => list().props.data
  .flatMap((item: any) => item.event ? [`${item.kind}:${item.event.title}`]
    : item.events ? [`${item.kind}:${item.events.map((e: Event) => e.title).join('+')}`] : []);
const button = (label: string) => renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === label);
function render() {
  act(() => { renderer = TestRenderer.create(<CalendarScreen navigation={navigation as any} route={{ params: undefined } as any} />); });
}
function select(date: string) {
  act(() => { strip().props.onSelectDate(date); });
  act(() => { jest.advanceTimersByTime(20); });
}
const indexOfDay = (date: string) => list().props.data.findIndex((item: any) => item.kind === 'day-heading' && item.date === date);
const userScrollsTo = (date: string) => act(() => {
  list().props.onScrollBeginDrag();
  list().props.onViewableItemsChanged({ viewableItems: [{ item: list().props.data[indexOfDay(date)] }] });
});
beforeEach(() => {
  mockLogs = [];
  mockTrips = [];
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-13T12:00:00'));
  mockEvents = [
    event(1, 'Tuesday appointment', '2026-10-13T09:00:00'),
    event(2, 'Wednesday late', '2026-10-14T16:00:00', { itemIds: [4] }),
    event(3, 'Wednesday early', '2026-10-14T07:00:00'),
    event(4, 'Wednesday all day', '2026-10-14T23:00:00', allDay('2026-10-14')),
    event(5, 'Last week', '2026-10-06T09:00:00'),
  ];
});
afterEach(() => { act(() => renderer?.unmount()); jest.useRealTimers(); jest.clearAllMocks(); });

it('shows one timeline from today with the hero, an all-day line and timed rows, without mode tabs or counts', () => {
  render();
  expect(rowTitles()).toEqual([
    'hero:Tuesday appointment',
    'all-day-line:Wednesday all day',
    'event:Wednesday early',
    'event:Wednesday late',
  ]);
  expect(renderer.root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityRole === 'tab')).toHaveLength(0);
  expect(texts().join(' ')).not.toMatch(/View all|Past events/);
  expect(strip().props.selectedDate).toBe('2026-10-13');
});
it('passes one planning signal per day to the strip', () => {
  mockEvents.push(event(6, 'Planned Friday', '2026-10-16T10:00:00', { itemIds: [1] }));
  render();
  const status = strip().props.planningStatus as Map<string, string>;
  expect(status.get('2026-10-14')).toBe('needs');
  expect(status.get('2026-10-16')).toBe('planned');
  expect(status.has('2026-10-15')).toBe(false);
});
it('scrolls the agenda to a tapped date and keeps the timeline intact', () => {
  render(); select('2026-10-14');
  expect(strip().props.selectedDate).toBe('2026-10-14');
  expect(mockScroll).toHaveBeenLastCalledWith({ index: indexOfDay('2026-10-14'), animated: false, viewPosition: 0 });
  expect(rowTitles()).toContain('hero:Tuesday appointment');
});
it('follows user scrolling in the strip but ignores its own programmatic scroll', () => {
  render(); select('2026-10-14');
  act(() => list().props.onViewableItemsChanged({ viewableItems: [{ item: list().props.data[indexOfDay('2026-10-13')] }] }));
  expect(strip().props.selectedDate).toBe('2026-10-14');
  userScrollsTo('2026-10-13');
  expect(strip().props.selectedDate).toBe('2026-10-13');
});
it('turns an empty future day into a styling prompt and prefills adding an event', async () => {
  render(); select('2026-10-18');
  expect(texts()).toEqual(expect.arrayContaining(['Free day.', 'Nothing on the calendar. Want a weekend look?']));
  expect(mockScroll).toHaveBeenLastCalledWith({ index: indexOfDay('2026-10-18'), animated: false, viewPosition: 0 });
  act(() => button('Style a weekend look')!.props.onPress());
  expect(mockOpenStylist).toHaveBeenCalledWith(expect.objectContaining({
    initialQuery: expect.stringContaining('weekend look for Sunday, October 18'), source: 'calendar_card',
  }));
  expect(button('What did you wear on this day')).toBeUndefined();
  await act(async () => { await button('Add event on this day')!.props.onPress(); });
  expect(nodes('EventFormModal')[0].props.visible).toBe(true);
  expect(nodes('EventFormModal')[0].props.initialDate.getDate()).toBe(18);
});
it('asks what was worn on an empty past day', () => {
  render(); select('2026-10-08');
  expect(texts()).toContain('No occasions.');
  act(() => button('What did you wear on this day')!.props.onPress());
  expect(mockOpenLogger).toHaveBeenCalledWith({ date: '2026-10-08', quickStart: true });
});
it('marks a past event worn only when its own planned look was logged', () => {
  mockEvents.push(
    event(6, 'Planned and worn', '2026-10-06T12:00:00', { itemIds: [7, 8] }),
    event(7, 'Planned, other look worn', '2026-10-06T15:00:00', { itemIds: [9] }),
  );
  mockLogs = [{ date: '2026-10-06', itemIds: [7, 8] }];
  render();
  scrollIntoHistory();
  const row = (id: number) => nodes('AgendaEventRow').find((node) => node.props.event.id === id)!;
  expect(row(5).props.past).toBe(true);
  // A day's wear log is never pinned onto an event that didn't plan it.
  expect(row(5).props.wornItemIds).toBeNull();
  expect(row(6).props.wornItemIds).toEqual([7, 8]);
  expect(row(7).props.wornItemIds).toBeNull();
  const future = nodes('AgendaEventRow').find((node) => node.props.event.id === 3)!;
  expect(future.props.past).toBe(false);
  expect(future.props.wornItemIds).toBeNull();
});
it('gives the month grid the lead piece of planned days', () => {
  render();
  // Item lookups are empty in this harness, so no planned day has an image.
  expect(strip().props.dayThumbs).toBeInstanceOf(Map);
});
it('reveals past days on scroll-up and loads them when the strip jumps back', () => {
  render();
  expect(rowTitles()).not.toContain('event:Last week');
  // Reaching the top without a drag (mount, tab re-tap) loads nothing.
  act(() => list().props.onStartReached());
  expect(rowTitles()).not.toContain('event:Last week');
  scrollIntoHistory();
  expect(rowTitles()[0]).toBe('event:Last week');
  expect(texts()).not.toContain('Show earlier');

  act(() => renderer.unmount());
  render(); select('2026-10-06');
  expect(rowTitles()).toContain('event:Last week');
  expect(strip().props.weekOffset).toBe(-1);
});
it('says the calendar is clear when only past events remain', () => {
  mockEvents = [event(9, 'Past appointment', '2026-10-12T09:00:00')];
  render();
  expect(texts()).toContain('Your calendar is clear');
  expect(nodes('NextEventHero')).toHaveLength(0);
  scrollIntoHistory();
  expect(rowTitles()).toEqual(['event:Past appointment']);
});
it('collapses month selection to the selected week and Today returns to today', () => {
  render();
  act(() => strip().props.onToggleExpanded());
  act(() => strip().props.onChangeMonthOffset(2));
  expect(strip().props.expanded).toBe(true);
  select('2026-12-31');
  expect(strip().props.expanded).toBe(false);
  expect(strip().props.monthOffset).toBe(0);
  expect(strip().props.weekOffset).toBeGreaterThan(0);
  expect(strip().props.selectedDate).toBe('2026-12-31');
  act(() => strip().props.onToday());
  act(() => { jest.advanceTimersByTime(20); });
  expect(strip().props.selectedDate).toBe('2026-10-13');
  expect(strip().props.weekOffset).toBe(0);
  expect(mockScroll).toHaveBeenLastCalledWith({ index: indexOfDay('2026-10-13'), animated: false, viewPosition: 0 });
});
it('routes row actions to details, the outfit, and planning', () => {
  render();
  const late = nodes('AgendaEventRow').find((node) => node.props.event.id === 2)!;
  act(() => late.props.onPress());
  expect(nodes('EventDetailModal')[0].props.event.id).toBe(2);
  act(() => nodes('EventDetailModal')[0].props.onClose());
  act(() => late.props.onOpenOutfit());
  expect(nodes('EventDetailModal')[0].props.event.id).toBe(2);
});
it('keeps its place when returning from the featured outfit', () => {
  mockEvents[0] = { ...mockEvents[0], outfitId: 12, itemIds: [1, 2] };
  render();
  act(() => nodes('NextEventHero')[0].props.onOpenOutfit());
  expect(navigation.navigate).toHaveBeenCalledWith('Closet', {
    screen: 'OutfitDetail', params: {
      outfitId: 12, returnTo: 'Calendar', returnToEventId: 1, returnToEventDetail: false,
    },
  });
  mockScroll.mockClear();
  act(() => renderer.update(<CalendarScreen navigation={navigation as any} route={{ params: { eventId: 1, openDetail: false } } as any} />));
  act(() => { jest.advanceTimersByTime(20); });
  expect(mockScroll).not.toHaveBeenCalled();
  expect(nodes('NextEventHero')[0].props.event.id).toBe(1);
  expect(nodes('EventDetailModal')[0].props.visible).toBe(false);
});
it('opens a deep-linked event on its day', () => {
  render();
  act(() => renderer.update(<CalendarScreen navigation={navigation as any} route={{ params: { eventId: 3 } } as any} />));
  act(() => { jest.advanceTimersByTime(20); });
  expect(strip().props.selectedDate).toBe('2026-10-14');
  expect(nodes('EventDetailModal')[0].props.event.id).toBe(3);
});
it('preserves the selected day and browsed week across a Sunday midnight boundary', () => {
  jest.setSystemTime(new Date('2026-10-18T23:59:45'));
  render(); select('2026-10-18');
  expect(strip().props.weekDays[0].getDate()).toBe(12);
  act(() => { jest.advanceTimersByTime(30_000); });
  expect(strip().props.selectedDate).toBe('2026-10-18');
  expect(strip().props.weekDays[0].getDate()).toBe(12);
  expect(strip().props.weekOffset).toBe(-1);
});
it('logs today\'s planned look as worn once, then reports it worn', () => {
  mockEvents[0] = { ...mockEvents[0], outfitId: 12, itemIds: [1, 2], location: 'Studio' };
  render();
  act(() => nodes('NextEventHero')[0].props.onWear());
  expect(mockCreateLog).toHaveBeenCalledWith(
    { itemIds: [1, 2], date: '2026-10-13', location: 'Studio' },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
  expect(nodes('NextEventHero')[0].props.isWearing).toBe(true);
  act(() => nodes('NextEventHero')[0].props.onWear());
  expect(mockCreateLog).toHaveBeenCalledTimes(1);

  act(() => renderer.unmount());
  mockLogs = [{ date: '2026-10-13', itemIds: [2, 1] }];
  render();
  expect(nodes('NextEventHero')[0].props.worn).toBe(true);
});

const trip = (extra: Record<string, unknown> = {}) => ({
  id: 7, destination: 'Lisbon', startDate: '2026-10-14', endDate: '2026-10-16',
  looks: 3, packed: 0, packable: 7, eventId: null, eventDatesChanged: false, ...extra,
});
it('pins day headings and names the trip in them instead of a band', () => {
  mockTrips = [trip()];
  render();
  const data = list().props.data;
  expect(list().props.stickyHeaderIndices).toEqual(
    data.flatMap((item: any, index: number) => (item.kind === 'day-heading' ? [index] : [])),
  );
  expect(texts()).toContain('Leaving for Lisbon · 0 of 7 packed');
  act(() => button('Leaving for Lisbon · 0 of 7 packed. Open trip')!.props.onPress());
  expect(nodes('TripDetailModal')[0].props.tripId).toBe(7);
  expect(strip().props.trips).toEqual(mockTrips);
});
it('hides the calendar event a trip plan was made from on the trip days', () => {
  mockEvents.push(event(8, 'Lisbon trip', '2026-10-15T00:00:00', allDay('2026-10-15')));
  mockTrips = [trip({ eventId: 8 })];
  render();
  expect(rowTitles().join(' ')).not.toContain('Lisbon trip');
});
it('features no all-day shift and offers a quiet prompt on an all-day-only today', () => {
  mockEvents = [event(1, 'Shift', '2026-10-13T00:00:00', allDay('2026-10-13')), event(2, 'Next week dinner', '2026-10-20T19:00:00')];
  render();
  expect(nodes('NextEventHero')).toHaveLength(0);
  expect(list().props.data.map((item: any) => item.kind)).toContain('today-prompt');
  act(() => button('Log what you wore today')!.props.onPress());
  expect(mockOpenLogger).toHaveBeenCalledWith({ date: '2026-10-13', quickStart: true });
});
it('leads with the trip on a departure day with nothing timed', () => {
  mockEvents = [event(1, 'Shift', '2026-10-14T00:00:00', allDay('2026-10-14'))];
  mockTrips = [trip()];
  render();
  expect(list().props.data[0].kind).toBe('trip-hero');
});
it('adds an event or a trip from the add button', () => {
  render();
  act(() => strip().props.onAddEvent());
  const sheet = nodes('ActionMenuSheet').find((node) => node.props.title === 'Add to your calendar')!;
  expect(sheet.props.visible).toBe(true);
  act(() => sheet.props.options[1].onPress());
  expect(mockOpenStylist).toHaveBeenCalledWith(expect.objectContaining({ workflow: expect.objectContaining({ kind: 'trip' }) }));
});
