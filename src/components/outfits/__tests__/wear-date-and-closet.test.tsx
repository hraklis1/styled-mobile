import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('../../wardrobe/scan-review/WorkspaceSheet', () => ({
  WorkspaceSheet: (props: { children?: React.ReactNode; headerAction?: React.ReactNode; footer?: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('WorkspaceSheet', props, props.headerAction, props.children, props.footer);
  },
}));
jest.mock('../../wardrobe/scan-review/ActionBar', () => ({ PrimaryButton: 'PrimaryButton' }));
jest.mock('../../wardrobe/scan-review/atoms', () => ({ TextLink: 'TextLink', TextSegment: 'TextSegment' }));
jest.mock('../../wardrobe/scan-review/feedback', () => ({ selectionFeedback: jest.fn() }));
jest.mock('../wear-review/PieceImage', () => ({ PieceImage: 'PieceImage' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

import { WornDateSheet, dayOffset } from '../wear-review/WornDateSheet';
import { ClosetPicker } from '../wear-review/ClosetMatchSheet';
import { closetItems, detection } from '../../../features/wear-log/__fixtures__/review';

function node(tree: TestRenderer.ReactTestRenderer, type: string, label?: string) {
  return tree.root.find((n) => (n.type as unknown) === type && (!label || n.props.label === label));
}
function press(tree: TestRenderer.ReactTestRenderer, type: string, label: string) {
  act(() => node(tree, type, label).props.onPress());
}
const mounted: TestRenderer.ReactTestRenderer[] = [];
function mount(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(element); });
  mounted.push(tree);
  return tree;
}
afterEach(() => { act(() => { for (const tree of mounted.splice(0)) tree.unmount(); }); });

it('date cancellation discards an unconfirmed earlier date', () => {
  const onSelect = jest.fn();
  const tree = mount(<WornDateSheet date={dayOffset(0)} reduceMotion onSelect={onSelect} onClose={jest.fn()} />);
  act(() => node(tree, 'DateTimePicker').props.onChange({ type: 'set' }, new Date(`${dayOffset(-4)}T12:00:00`)));
  press(tree, 'TextLink', 'Cancel');
  expect(onSelect).not.toHaveBeenCalled();
  expect(node(tree, 'WorkspaceSheet').props.dismissed).toBe(true);
});

it('confirms earlier dates explicitly and restricts dates to today or before', () => {
  const onSelect = jest.fn();
  const tree = mount(<WornDateSheet date={dayOffset(0)} reduceMotion onSelect={onSelect} onClose={jest.fn()} />);
  expect(tree.root.findAll((n) => n.props.label === 'Earlier…')).toHaveLength(0);
  const picker = node(tree, 'DateTimePicker');
  expect(picker.props.maximumDate.getTime()).toBeLessThanOrEqual(Date.now());
  act(() => picker.props.onChange({ type: 'set' }, new Date(`${dayOffset(-7)}T12:00:00`)));
  act(() => picker.props.onChange({ type: 'set' }, new Date(`${dayOffset(1)}T12:00:00`)));
  press(tree, 'PrimaryButton', 'Use this date');
  expect(onSelect).toHaveBeenCalledWith(dayOffset(-7));
});

it('offers yesterday as an immediate date selection', () => {
  const onSelect = jest.fn();
  const tree = mount(<WornDateSheet date={dayOffset(0)} reduceMotion onSelect={onSelect} onClose={jest.fn()} />);
  press(tree, 'TextLink', 'Yesterday');
  expect(onSelect).toHaveBeenCalledWith(dayOffset(-1));
});

function gridData(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll((n) => n.props.renderItem && Array.isArray(n.props.data))[0].props.data as ({ heading: string } | { items: typeof closetItems })[];
}
function visibleIds(tree: TestRenderer.ReactTestRenderer) {
  return gridData(tree).flatMap((row) => 'items' in row ? row.items.map((item) => item.id) : []);
}

it('separates ranked suggestions from the remaining closet and searches across categories', () => {
  const tree = mount(<ClosetPicker detection={detection('d0')} items={closetItems} onPick={jest.fn()} />);
  expect(visibleIds(tree)).toEqual([1, 2]);
  expect(gridData(tree).filter((row) => 'heading' in row)).toEqual([{ key: 'Suggested matches', heading: 'Suggested matches' }]);
  act(() => node(tree, 'TextSegment').props.onChange('all'));
  expect(visibleIds(tree)).toEqual([1, 2, 3]);
  act(() => node(tree, 'TextSegment').props.onChange('category'));
  const search = tree.root.findAll((n) => n.props.accessibilityLabel === 'Search name, brand or colour' && n.props.onChangeText)[0];
  act(() => search.props.onChangeText('trousers'));
  expect(visibleIds(tree)).toEqual([3]);
  act(() => search.props.onChangeText('COS'));
  expect(visibleIds(tree)).toEqual([2]);
  act(() => search.props.onChangeText('beige'));
  expect(visibleIds(tree)).toEqual([1]);
});

it('marks already selected additions as unavailable while allowing other closet picks', () => {
  const onPick = jest.fn();
  const tree = mount(<ClosetPicker items={closetItems} unavailableIds={[1]} onPick={onPick} />);
  const unavailable = tree.root.findAll((n) => n.props.accessibilityLabel === 'Linen shirt, Zara, Already selected' && n.props.accessibilityRole === 'button')[0];
  expect(unavailable.props.disabled).toBe(true);
  expect(unavailable.props.accessibilityState).toEqual({ selected: true, disabled: true });
  const trousers = tree.root.findAll((n) => n.props.accessibilityLabel === 'White trousers, Zara' && n.props.onPress)[0];
  act(() => trousers.props.onPress());
  expect(onPick).toHaveBeenCalledWith(3);
});
