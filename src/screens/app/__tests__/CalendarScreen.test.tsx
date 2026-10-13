import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import type { Event } from '../../../types/event';

jest.mock('@react-navigation/native', () => ({ useScrollToTop: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
const mockScroll = jest.fn();
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  return { FlashList: React.forwardRef(function MockFlashList(props: any, ref: any) {
    React.useImperativeHandle(ref, () => ({ scrollToOffset: mockScroll }));
    return React.createElement('FlashList', props, props.data.map((item: any, index: number) =>
      React.createElement(React.Fragment, { key: item.key }, props.renderItem({ item, index, target: 'Cell' })),
    ));
  }) };
});
jest.mock('../../../components/primitives/ConfirmSheet', () => ({ confirmSheet: jest.fn() }));
jest.mock('../../../components/primitives/Editorial', () => ({ ScreenHeader: 'ScreenHeader' }));
jest.mock('../../../components/primitives/ErrorState', () => ({ ErrorState: 'ErrorState' }));
jest.mock('../../../components/primitives/ActionMenuSheet', () => ({ ActionMenuSheet: 'ActionMenuSheet' }));
jest.mock('../../../components/calendar/CalendarSyncSheet', () => ({ CalendarSyncSheet: 'CalendarSyncSheet' }));
jest.mock('../../../components/calendar/WeekStrip', () => ({ WeekStrip: 'WeekStrip' }));
jest.mock('../../../components/calendar/NextEventHero', () => ({ NextEventHero: 'NextEventHero' }));
jest.mock('../../../components/calendar/ItemThumbStack', () => ({ ItemThumbStack: 'ItemThumbStack' }));
jest.mock('../../../components/calendar/EventFormModal', () => ({ EventFormModal: 'EventFormModal' }));
jest.mock('../../../components/calendar/EventDetailModal', () => ({ EventDetailModal: 'EventDetailModal' }));
jest.mock('../../../components/calendar/EventItemPickerModal', () => ({ EventItemPickerModal: 'EventItemPickerModal' }));
jest.mock('../../../components/calendar/EventOutfitPickerModal', () => ({ EventOutfitPickerModal: 'EventOutfitPickerModal' }));
jest.mock('../../../hooks/useEntitlement', () => ({ useEntitlement: () => ({ isPremium: true }) }));
jest.mock('../../../hooks/useActiveStylingLocation', () => ({ useActiveStylingLocation: () => ({ activeLocation: null }) }));
jest.mock('../../../hooks/useItems', () => ({ useItems: () => ({ data: [] }) }));
jest.mock('../../../hooks/useOutfits', () => ({ useOutfits: () => ({ data: [] }) }));
jest.mock('../../../hooks/useBoards', () => ({ useBoards: () => ({ data: [] }) }));
const mockOpenLogger = jest.fn();
jest.mock('../../../contexts/GlobalOutfitLoggerContext', () => ({ useGlobalOutfitLogger: () => ({ openLogger: mockOpenLogger }) }));
jest.mock('../../../contexts/GlobalAIStylistContext', () => ({ useGlobalAIStylist: () => ({ openStylist: jest.fn() }) }));
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
const navigation = { navigate: jest.fn(), setParams: jest.fn() };
let renderer: TestRenderer.ReactTestRenderer;
const nodes = (name: string) => renderer.root.findAllByType(name as any);
const strip = () => nodes('WeekStrip')[0];
const texts = () => renderer.root.findAllByType(Text).map((node) => node.props.children);
const tab = (label: string) => renderer.root.findAllByType(TouchableOpacity).find((node) =>
  node.props.accessibilityRole === 'tab' && node.findAllByType(Text).some((text) => text.props.children === label),
)!;
function render() {
  act(() => { renderer = TestRenderer.create(<CalendarScreen navigation={navigation as any} route={{ params: undefined } as any} />); });
}
function select(date: string) {
  act(() => { strip().props.onSelectDate(date); });
  act(() => { jest.advanceTimersByTime(20); });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-13T12:00:00'));
  mockEvents = [
    event(1, 'Tuesday appointment', '2026-10-13T09:00:00'),
    event(2, 'Wednesday late', '2026-10-14T16:00:00'),
    event(3, 'Wednesday early', '2026-10-14T07:00:00'),
    event(4, 'Wednesday all day', '2026-10-14T23:00:00', { calendarMetadata: {
      calendarId: 'work', calendarName: 'Work', allDay: true, allDayDate: '2026-10-14', cancelled: false, syncedAt: '2026-10-13T12:00:00Z',
    } }),
  ];
});
afterEach(() => { act(() => renderer?.unmount()); jest.useRealTimers(); jest.clearAllMocks(); });

it.each([0, 600])('selects only the chosen day from scroll offset %i and removes the global hero', (offset) => {
  render();
  expect(nodes('NextEventHero')[0].props.event.title).toBe('Tuesday appointment');
  act(() => nodes('ScreenHeader')[0].parent!.props.onLayout({ nativeEvent: { layout: { height: 100 } } }));
  act(() => nodes('FlashList')[0].props.onScroll({ nativeEvent: { contentOffset: { y: offset } } }));
  select('2026-10-14');
  expect(strip().props.selectedDate).toBe('2026-10-14');
  expect(nodes('NextEventHero')).toHaveLength(0);
  expect(texts()).not.toContain('Tuesday appointment');
  expect(texts()).toEqual(expect.arrayContaining(['Wednesday early', 'Wednesday late', 'Wednesday all day']));
  expect(tab('Day').props.accessibilityState.selected).toBe(true);
  expect(mockScroll).toHaveBeenLastCalledWith({ offset: offset === 0 ? 0 : 100, animated: false });
});
it('renders one day heading and sorts all-day events ahead of timed events', () => {
  render(); select('2026-10-14');
  const titles = texts().filter((value) => typeof value === 'string' && value.startsWith('Wednesday '));
  expect(titles).toEqual(['Wednesday all day', 'Wednesday early', 'Wednesday late']);
  expect(renderer.root.findAllByType(Text).filter((node) => node.props.accessibilityRole === 'header')).toHaveLength(1);
});
it('keeps an empty day actionable and prefills adding and logging for that date', async () => {
  render(); select('2026-10-18');
  expect(texts()).toContain('Nothing planned');
  expect(nodes('NextEventHero')).toHaveLength(0);
  const buttons = renderer.root.findAllByType(TouchableOpacity);
  await act(async () => { await buttons.find((node) => node.props.accessibilityLabel === 'Add event on this day')!.props.onPress(); });
  expect(nodes('EventFormModal')[0].props.visible).toBe(true);
  expect(nodes('EventFormModal')[0].props.initialDate.getDate()).toBe(18);
  act(() => buttons.find((node) => node.props.accessibilityLabel === 'What did you wear on this day')!.props.onPress());
  expect(mockOpenLogger).toHaveBeenCalledWith({ date: '2026-10-18', quickStart: true });
});
it('restores Upcoming and its featured event after viewing a day', () => {
  render(); select('2026-10-14');
  act(() => tab('Upcoming').props.onPress());
  expect(strip().props.selectedDate).toBeNull();
  expect(tab('Upcoming').props.accessibilityState.selected).toBe(true);
  expect(nodes('NextEventHero')[0].props.event.title).toBe('Tuesday appointment');
});
it('collapses month selection to the selected week and Today resets the date', () => {
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
  expect(strip().props.selectedDate).toBe('2026-10-13');
  expect(strip().props.weekOffset).toBe(0);
  expect(nodes('NextEventHero')).toHaveLength(0);
  expect(texts()).toContain('Tuesday appointment');
});
it('keeps past events reachable when there are no upcoming events', () => {
  mockEvents = [event(9, 'Past appointment', '2026-10-12T09:00:00')];
  render();
  expect(texts()).toContain('Your calendar is clear');
  expect(nodes('NextEventHero')).toHaveLength(0);
  const pastToggle = renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === 'Expand 1 past events')!;
  expect(pastToggle).toBeDefined();
  act(() => pastToggle.props.onPress());
  expect(texts()).toContain('Past appointment');
});
it('preserves Upcoming when returning from its featured outfit', () => {
  mockEvents[0] = { ...mockEvents[0], outfitId: 12, itemIds: [1, 2] };
  render();
  act(() => nodes('NextEventHero')[0].props.onOpenOutfit());
  expect(navigation.navigate).toHaveBeenCalledWith('Closet', {
    screen: 'OutfitDetail', params: {
      outfitId: 12, returnTo: 'Calendar', returnToEventId: 1, returnToEventDetail: false,
    },
  });
  act(() => renderer.update(<CalendarScreen navigation={navigation as any} route={{ params: { eventId: 1, openDetail: false } } as any} />));
  expect(strip().props.selectedDate).toBeNull();
  expect(tab('Upcoming').props.accessibilityState.selected).toBe(true);
  expect(nodes('NextEventHero')[0].props.event.id).toBe(1);
  expect(nodes('EventDetailModal')[0].props.visible).toBe(false);
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

it('keeps the masthead expanded when switching from a short day to a busy day', () => {
  render();
  act(() => nodes('ScreenHeader')[0].parent!.props.onLayout({ nativeEvent: { layout: { height: 100 } } }));
  select('2026-10-13');
  expect(texts()).toContain('Tuesday appointment');
  select('2026-10-14');
  expect(texts()).toContain('Wednesday early');
  expect(mockScroll).toHaveBeenLastCalledWith({ offset: 0, animated: false });
  select('2026-10-13');
  expect(mockScroll).toHaveBeenLastCalledWith({ offset: 0, animated: false });
});
