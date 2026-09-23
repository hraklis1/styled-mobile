import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AskStylistButton } from '../AskStylistButton';
import { AddToClosetCard } from '../AddToClosetCard';
import { ShoppingPriorityRow } from '../../shopping/ShoppingPriorityRow';
import { PressableScale } from '../../primitives/PressableScale';
import type { ShoppingBriefPriority } from '../../../lib/shopDecisionWorkspace';

jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = jest.requireActual('react');
  return { __esModule: true, default: function TestPressable({ children, ...props }: any) {
    return React.createElement('TestPressable', { ...props, renderContent: children }, typeof children === 'function' ? children({ pressed: false }) : children);
  } };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../shopping/WardrobeThumbnail', () => ({ WardrobeThumbnail: 'WardrobeThumbnail' }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  useSharedValue: () => ({ value: 1 }),
  useReducedMotion: () => true,
  useAnimatedStyle: (callback: () => unknown) => callback(),
  withTiming: (value: number) => value,
  withSpring: (value: number) => value,
  Easing: { out: (value: unknown) => value, quad: 'quad' },
}));

const priority: ShoppingBriefPriority = {
  label: 'versatile mid-rise trousers', category: 'bottom', reason: 'wardrobe_gap',
  context: 'A polished option for cooler days.', priority: 1,
  unlocks: ['Work', 'Dinner'], impactScore: 9,
};
const mounted: TestRenderer.ReactTestRenderer[] = [];
function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(element); });
  mounted.push(renderer);
  return renderer;
}
afterEach(() => { act(() => { mounted.splice(0).forEach((renderer) => renderer.unmount()); }); });

it.each([AskStylistButton, AddToClosetCard])('keeps the launcher callback and disabled semantics', (Component) => {
  const onPress = jest.fn();
  const renderer = render(<Component onPress={onPress} />);
  const button = renderer.root.findByType(Pressable);
  act(() => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(button.props.accessibilityRole).toBe('button');
  act(() => renderer.update(<Component onPress={onPress} disabled />));
  expect(renderer.root.findByType(Pressable).props.disabled).toBe(true);
  expect(renderer.root.findByType(Pressable).props.accessibilityState.disabled).toBe(true);
});

it('exposes independent brief actions without a pressable ancestor around skip', () => {
  const onPress = jest.fn(); const onSkip = jest.fn();
  const renderer = render(<ShoppingPriorityRow index={1} priority={priority} onPress={onPress} onSkip={onSkip} />);
  const [open, skip] = renderer.root.findAllByType(Pressable);
  act(() => skip.props.onPress());
  expect(onSkip).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();
  let parent = skip.parent;
  while (parent) { expect(parent.type).not.toBe(Pressable); parent = parent.parent; }
  act(() => open.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('keeps busy skip disabled and allows retry when pending ends', () => {
  const onSkip = jest.fn();
  const renderer = render(<ShoppingPriorityRow index={1} priority={priority} onSkip={onSkip} skipping />);
  expect(renderer.root.findByType(Pressable).props.accessibilityState).toEqual({ disabled: true, busy: true });
  expect(renderer.root.findAllByType(Text).some((node) => node.props.children === 'Skipping…')).toBe(true);
  act(() => renderer.update(<ShoppingPriorityRow index={1} priority={priority} onSkip={onSkip} skipping={false} />));
  const retry = renderer.root.findByType(Pressable);
  expect(retry.props.disabled).toBe(false);
  act(() => retry.props.onPress());
  expect(onSkip).toHaveBeenCalledTimes(1);
});

it('keeps the compact teaser noninteractive and suppresses duplicate context', () => {
  const renderer = render(<ShoppingPriorityRow index={2} compact priority={{ ...priority, context: `${priority.label} would add 9 new outfits.` }} />);
  expect(renderer.root.findAllByType(Pressable)).toHaveLength(0);
  const labels = renderer.root.findAllByType(Text).map((node) => node.props.children);
  expect(labels).toContain('02');
  expect(labels).toContain('Work');
  expect(labels.join(' ')).not.toMatch(/\b9\b/);
  expect(labels).not.toContain('Not for me');
});

it('moves ladder bookkeeping to the eyebrow and drops a bare outfit claim', () => {
  const laddered = render(<ShoppingPriorityRow index={1} priority={{ ...priority, context: 'You own a blazer but cannot build a work outfit yet. Step 1 of 2: versatile mid-rise trousers.' }} />);
  const ladderText = laddered.root.findAllByType(Text).map((node) => node.props.children);
  expect(ladderText).toContain('Work · Dinner · 1 of 2');
  expect(ladderText.join(' ')).not.toMatch(/Step 1 of 2/);

  const generic = render(<ShoppingPriorityRow index={2} priority={{ ...priority, context: 'Versatile mid-rise trousers would create 9 new outfits from pieces you already own.' }} />);
  expect(generic.root.findAllByType(Text).map((node) => node.props.children).join(' ')).not.toMatch(/new outfits/);
});

it('preserves pressed surface feedback with Reduce Motion and suppresses it when disabled', () => {
  const renderer = render(<PressableScale contentStyle={{ backgroundColor: 'white' }} pressedContentStyle={{ backgroundColor: 'gray' }}><Text>Open</Text></PressableScale>);
  const button = renderer.root.findByType(Pressable);
  const pressed = button.props.children({ pressed: true });
  expect(StyleSheet.flatten(pressed.props.style)).toMatchObject({ backgroundColor: 'gray', transform: [{ scale: 1 }] });
  act(() => renderer.update(<PressableScale disabled contentStyle={{ backgroundColor: 'white' }} pressedContentStyle={{ backgroundColor: 'gray' }} />));
  const disabled = renderer.root.findByType(Pressable).props.children({ pressed: true });
  expect(StyleSheet.flatten(disabled.props.style).backgroundColor).toBe('white');
});
