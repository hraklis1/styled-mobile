import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('../scan-review/MarkedPhoto', () => ({ MarkedPhoto: 'MarkedPhoto' }));
jest.mock('../scan-review/feedback', () => ({ selectionFeedback: jest.fn() }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain: Record<string, unknown> = {};
  chain.duration = () => chain;
  return {
    __esModule: true, default: { View }, FadeIn: chain, Easing: { inOut: () => 0, quad: 0, out: () => 0, cubic: 0 },
    useSharedValue: (v: number) => ({ get: () => v, set: () => {}, value: v }), useAnimatedStyle: () => ({}),
    withRepeat: (v: unknown) => v, withSequence: (v: unknown) => v, withTiming: (v: unknown) => v,
  };
});

import { DetectionState, type FilmFrame } from '../scan-review/LoadingStates';

const frames = (doneCount: number): FilmFrame[] => ['a', 'b', 'c'].map((uri, i) => ({ id: uri, uri, state: i < doneCount ? 'done' : i === doneCount ? 'active' : 'pending' }));
const detected = new Map([['a', [{ id: 'p1', box: null, label: 'Shirt', number: 1 }]]]);

it('holds a photo that just finished with its pieces marked, then moves on', () => {
  jest.useFakeTimers();
  let tree!: ReactTestRenderer;
  const render = (done: number) => <DetectionState previewImage="b" photos={frames(done)} progress={{ current: done, total: 3 }} heroHeight={300} reduceMotion detected={detected} foundCount={1} />;
  act(() => { tree = create(render(0)); });
  expect(tree.root.findAllByType('MarkedPhoto' as never)).toHaveLength(0);
  act(() => tree.update(render(1)));
  expect(tree.root.findByType('MarkedPhoto' as never).props.source).toBe('a');
  act(() => { jest.advanceTimersByTime(1300); });
  expect(tree.root.findAllByType('MarkedPhoto' as never)).toHaveLength(0);
  jest.useRealTimers();
});
