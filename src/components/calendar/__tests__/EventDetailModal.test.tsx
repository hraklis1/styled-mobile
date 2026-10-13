import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Modal, Text, TouchableOpacity } from 'react-native';
import { EventDetailModal } from '../EventDetailModal';
import { PressableScale } from '../../primitives/PressableScale';
import { ActionMenuSheet } from '../../primitives/ActionMenuSheet';
import { EventBoardPickerModal } from '../EventBoardPickerModal';
import type { Event } from '../../../types/event';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('../../../lib/api', () => ({ api: {}, API_BASE_URL: 'https://api.styled.test' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../primitives/PressableScale', () => ({
  PressableScale: ({ children, contentStyle, ...rest }: any) => {
    const { Pressable } = require('react-native');
    return <Pressable {...rest} style={contentStyle}>{children}</Pressable>;
  },
}));
jest.mock('../../../hooks/useWeather', () => ({ useEventWeatherForecast: () => ({ data: null, isFetching: false }) }));
jest.mock('../../../hooks/useTempUnit', () => ({ useTempUnit: () => 'C' }));
// Media rendering and the board's data fetching are boundaries of this detail test.
// The real action sheet and its dismissal handoff remain in use.
jest.mock('../EventLookCollage', () => ({ EventLookCollage: () => null }));
jest.mock('../EventBoardPickerModal', () => ({ EventBoardPickerModal: () => null }));

const fixture: Event = {
  id: 7, userId: 1, title: 'Dinner with friends', date: '2026-10-14T19:00:00',
  occasion: 'casual', location: 'Downtown', environment: null, notes: 'Arrive at the side entrance.',
  itemIds: null, outfitId: null,
  calendarMetadata: { calendarId: 'personal', calendarName: 'Personal', allDay: false, cancelled: false, syncedAt: '2026-10-13T12:00:00Z', url: 'https://calendar.google.com/event/7' },
};
let renderer: TestRenderer.ReactTestRenderer;
let props: React.ComponentProps<typeof EventDetailModal>;
async function render(event = fixture) {
  props = {
    event, visible: true, onClose: jest.fn(), onEdit: jest.fn(), onDelete: jest.fn(),
    onAssign: jest.fn(), onChooseOutfit: jest.fn(), onOpenOutfit: jest.fn(),
    onOpenStylist: jest.fn(), onSelectBoard: jest.fn().mockResolvedValue(undefined),
    allItems: [], outfit: null, weatherFallback: null,
  };
  await act(async () => { renderer = TestRenderer.create(<EventDetailModal {...props} />); });
}
function pressable(label: string) {
  return renderer.root.findAllByType(PressableScale).find(node => node.props.accessibilityLabel === label)!;
}
function chooser() {
  return renderer.root.findAllByType(ActionMenuSheet).find(node => node.props.title === 'Choose a look')!;
}
async function select(label: string) {
  const link = renderer.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === `Choose a look for ${fixture.title}`)!;
  await act(async () => link.props.onPress());
  const sheet = chooser();
  expect(sheet.props.visible).toBe(true);
  const row = sheet.findAllByType(TouchableOpacity).find(node => node.findAllByType(Text).some(text => text.props.children === label))!;
  await act(async () => row.props.onPress());
  // iOS executes the selected action only once the native sheet has dismissed.
  expect(sheet.props.visible).toBe(false);
  expect(props.onChooseOutfit).not.toHaveBeenCalled();
  expect(props.onAssign).not.toHaveBeenCalled();
  await act(async () => sheet.findByType(Modal).props.onDismiss());
}
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
});

it.each(['Saved outfits', 'Choose items'])('hands %s to the correct picker after menu dismissal', async label => {
  await render();
  await select(label);
  const callback = label === 'Saved outfits' ? props.onChooseOutfit : props.onAssign;
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(fixture);
  expect(props.onOpenStylist).not.toHaveBeenCalled();
  expect(label === 'Saved outfits' ? props.onAssign : props.onChooseOutfit).not.toHaveBeenCalled();
});

it('keeps board planning in the consolidated chooser and opens its nested picker', async () => {
  await render();
  const eventOptions = renderer.root.findAllByType(ActionMenuSheet).find(node => node.props.title === 'Event options')!;
  expect(eventOptions.props.options.some((option: { label: string }) => option.label === 'Plan from a board')).toBe(false);
  await select('Plan from a board');
  expect(renderer.root.findByType(EventBoardPickerModal).props.visible).toBe(true);
  expect(props.onSelectBoard).not.toHaveBeenCalled();
  expect(props.onOpenStylist).not.toHaveBeenCalled();
});

it('puts the look under the title, ahead of logistics, notes and the source footer', async () => {
  const planned = { ...fixture, itemIds: [11, 12], outfitId: 4 };
  await render(planned);
  const labels = renderer.root.findAllByType(Text).map(node => React.Children.toArray(node.props.children).join(''));
  expect(labels.indexOf('Look planned')).toBeLessThan(labels.indexOf('Your look · 2 pieces'));
  expect(labels.indexOf('Your look · 2 pieces')).toBeLessThan(labels.indexOf('Casual'));
  expect(labels.indexOf('Casual')).toBeLessThan(labels.indexOf('Event details'));
  expect(labels.indexOf('Event details')).toBeLessThan(labels.indexOf('Synced from Personal'));
  expect(labels).not.toContain('Edit calendar details in your source calendar. Styling stays in Styled.');
  await act(async () => pressable(`View outfit for ${fixture.title}, 2 pieces`).props.onPress());
  expect(props.onOpenOutfit).toHaveBeenCalledWith(planned);
  expect(props.onAssign).not.toHaveBeenCalled();
  expect(props.onOpenStylist).not.toHaveBeenCalled();
});

it('guards a rapid double tap and resets the handoff when the detail is reopened', async () => {
  await render();
  const action = pressable(`Plan my look for ${fixture.title}`).props.onPress;
  act(() => { action(); action(); });
  expect(props.onOpenStylist).toHaveBeenCalledTimes(1);
  expect(pressable(`Plan my look for ${fixture.title}`).props.accessibilityState).toEqual({ disabled: true, busy: true });
  await act(async () => renderer.update(<EventDetailModal {...props} visible={false} />));
  await act(async () => renderer.update(<EventDetailModal {...props} visible />));
  act(() => pressable(`Plan my look for ${fixture.title}`).props.onPress());
  expect(props.onOpenStylist).toHaveBeenCalledTimes(2);
});

it('collapses event notes to a one-line preview until expanded', async () => {
  await render();
  const texts = () => renderer.root.findAllByType(Text).map(node => node.props.children);
  expect(texts()).toContain('Arrive at the side entrance.');
  const toggle = renderer.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === 'Event details')!;
  expect(toggle.props.accessibilityState).toEqual({ expanded: false });
  await act(async () => toggle.props.onPress());
  expect(toggle.props.accessibilityState).toEqual({ expanded: true });
  expect(renderer.root.findAllByType(Text).filter(node => node.props.selectable && node.props.children === 'Arrive at the side entrance.')).toHaveLength(1);
});

it('styles an unplanned look from the empty canvas', async () => {
  await render();
  expect(renderer.root.findAllByType(Text).map(node => node.props.children)).toEqual(expect.arrayContaining(['Needs a look', 'Top', 'Bottom', 'Shoes']));
  await act(async () => pressable(`Style a look for ${fixture.title}`).props.onPress());
  expect(props.onOpenStylist).toHaveBeenCalledWith(fixture);
});

it('offers Wear this beside Refine only on the event day', async () => {
  jest.setSystemTime(new Date('2026-10-14T09:00:00'));
  const planned = { ...fixture, itemIds: [11, 12], outfitId: 4 };
  const onWear = jest.fn();
  props = undefined as never;
  await act(async () => {
    renderer = TestRenderer.create(<EventDetailModal
      event={planned} visible onClose={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()}
      onAssign={jest.fn()} onChooseOutfit={jest.fn()} onOpenOutfit={jest.fn()} onOpenStylist={jest.fn()}
      allItems={[]} outfit={null} weatherFallback={null} onWear={onWear}
    />);
  });
  await act(async () => pressable(`Wear this look for ${fixture.title}`).props.onPress());
  expect(onWear).toHaveBeenCalledWith(planned);
  expect(pressable(`Refine my look for ${fixture.title}`)).toBeDefined();
  expect(renderer.root.findAllByType(TouchableOpacity).some(node => node.props.accessibilityLabel === `Choose a look for ${fixture.title}`)).toBe(false);

  await act(async () => renderer.update(<EventDetailModal
    event={planned} visible onClose={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()}
    onAssign={jest.fn()} onChooseOutfit={jest.fn()} onOpenOutfit={jest.fn()} onOpenStylist={jest.fn()}
    allItems={[]} outfit={null} weatherFallback={null} onWear={onWear} worn
  />));
  expect(pressable(`${fixture.title} look logged as worn`).props.disabled).toBe(true);

  jest.setSystemTime(new Date('2026-10-12T09:00:00'));
  await act(async () => renderer.update(<EventDetailModal
    event={{ ...planned, id: 8 }} visible onClose={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()}
    onAssign={jest.fn()} onChooseOutfit={jest.fn()} onOpenOutfit={jest.fn()} onOpenStylist={jest.fn()}
    allItems={[]} outfit={null} weatherFallback={null} onWear={onWear}
  />));
  expect(pressable(`Wear this look for ${fixture.title}`)).toBeUndefined();
});
