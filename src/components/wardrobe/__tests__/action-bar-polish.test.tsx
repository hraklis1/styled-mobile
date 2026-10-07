import React from 'react';
import { Switch, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { Text: jest.requireActual('react-native').Text }, FadeIn: { duration: () => undefined } }));

import { ActionBar, type PolishRowState } from '../scan-review/ActionBar';

function render(polish: Partial<PolishRowState>, count = 5) {
  const state: PolishRowState = { count: 0, total: count, cost: 0, balance: 40, locked: false, onToggle: jest.fn(), ...polish };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<ActionBar bottomInset={0} mode={{ kind: 'save', count, flagged: 0, onSave: jest.fn(), onReviewFlagged: jest.fn(), polish: state }} />);
  });
  const texts = tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
  return { tree, texts, state };
}

it('offers polish off by default with the plain save label', () => {
  const { texts, tree } = render({});
  expect(texts).toContain('Polish photos');
  expect(texts).toContain('Add 5 pieces to closet');
  expect(tree.root.findByType(Switch).props.value).toBe(false);
});

it('prices the polishes against the balance and marks the save', () => {
  const { texts } = render({ count: 5, cost: 20 });
  expect(texts).toContain('20 credits · 40 available');
  expect(texts).toContain('Add 5 pieces to closet · Polish');
});

it('names the partial count on the button and shows a shortfall', () => {
  const { texts } = render({ count: 3, cost: 12, balance: 5 });
  expect(texts).toContain('Polish 3 of 5');
  expect(texts).toContain('Add 5 pieces · Polish 3');
  expect(texts).toContain('Needs 12 credits · you have 5');
});

it('a partial set turns the rest on; a full set turns off', () => {
  const partial = render({ count: 2 });
  act(() => partial.tree.root.findByType(Switch).props.onValueChange(false));
  expect(partial.state.onToggle).toHaveBeenCalledWith(true);
  const full = render({ count: 5 });
  act(() => full.tree.root.findByType(Switch).props.onValueChange(false));
  expect(full.state.onToggle).toHaveBeenCalledWith(false);
});

it('offers an example only when there is one', () => {
  expect(render({}).texts).not.toContain('See example');
  expect(render({ onExample: jest.fn() }).texts).toContain('See example');
});

it('reads as Premium when locked, and the switch still asks', () => {
  const { texts, tree, state } = render({ locked: true });
  expect(texts).toContain('Studio-quality covers · Premium');
  act(() => tree.root.findByType(Switch).props.onValueChange(true));
  expect(state.onToggle).toHaveBeenCalledWith(true);
});
