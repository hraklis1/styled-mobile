import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { ProductFeedbackPanel, REASON_WINDOW_MS } from '../ProductFeedbackPanel';
import type { ProductOffer } from '../../../types/commerce';
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => { const React = jest.requireActual('react'); return { __esModule: true, default: function MockPressable({ children, ...props }: any) { return React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children); } }; });
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
jest.mock('../../../lib/api', () => ({ api: {} }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));

const offer = { id: 'serper:1', title: 'Jacket', imageUrl: 'https://example.com/a.jpg' } as ProductOffer;
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => jest.useFakeTimers());
afterEach(() => { act(() => renderer?.unmount()); jest.useRealTimers(); });
const text = () => renderer.root.findAllByType(Text).map((node) => node.props.children).join(' | ');
const press = (label: string) => act(() => renderer.root.findAllByType(Pressable).find((node) => node.findAllByType(Text).some((child) => child.props.children === label))!.props.onPress());
function render(reason: any = null, onReason = jest.fn(), onUndo = jest.fn()) {
  act(() => { renderer = TestRenderer.create(<ProductFeedbackPanel offer={offer} width={200} imageAspectRatio={0.8} reason={reason} onReason={onReason} onUndo={onUndo} />); });
  return { onReason, onUndo };
}

test('chips fold away after the reason window, leaving Undo and a way back', () => {
  const { onUndo } = render();
  expect(text()).toContain('Not my style');
  expect(renderer.root.findAllByType('Image' as any)).toHaveLength(1);
  act(() => { jest.advanceTimersByTime(REASON_WINDOW_MS); });
  expect(text()).not.toContain('Not my style');
  expect(text()).toContain('Give a reason');
  press('Give a reason');
  expect(text()).toContain('Not my style');
  press('Undo');
  expect(onUndo).toHaveBeenCalledTimes(1);
});

test('a chosen reason is shown once folded and can be changed', () => {
  const onReason = jest.fn();
  render(null, onReason);
  press('Wrong colour');
  expect(onReason).toHaveBeenCalledWith('wrong_color');
  act(() => renderer.update(<ProductFeedbackPanel offer={offer} width={200} imageAspectRatio={0.8} reason="wrong_color" onReason={onReason} onUndo={jest.fn()} />));
  expect(text()).toContain('Thanks');
  act(() => { jest.advanceTimersByTime(1500); });
  expect(text()).toContain('Wrong colour');
  press('Change reason');
  expect(text()).toContain('Not my style');
});
