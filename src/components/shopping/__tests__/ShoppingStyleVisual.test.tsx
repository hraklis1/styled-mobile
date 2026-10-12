import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ShoppingStyleVisual, ShoppingImageSearchStatus } from '../ShoppingStyleVisual';
import type { ShoppingPriorityTarget } from '../../../lib/shoppingPriorityEdit';
jest.mock('expo-image', () => ({ Image: 'ExpoImage' }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: require('react-native').View },
  useReducedMotion: () => true, useSharedValue: (value: number) => require('react').useRef({ value }).current,
  useAnimatedStyle: (callback: () => unknown) => callback(), cancelAnimation: jest.fn(),
  withTiming: (value: number) => value, withRepeat: (value: number) => value,
  Easing: { inOut: (value: unknown) => value, quad: jest.fn() },
}));
const target: ShoppingPriorityTarget = { key: 'trousers', title: 'Trousers', category: 'trousers', color: 'black', material: '', silhouette: '', priceRange: '', retailerExamples: [], rationale: '', unlocks: [], outfitIdeas: [], offerState: { status: 'pending', offers: [], retrievedAt: null, expiresAt: null } };
let renderer: TestRenderer.ReactTestRenderer;
afterEach(() => { act(() => renderer?.unmount()); jest.useRealTimers(); });
const skeletons = () => renderer.root.findAllByProps({ testID: 'shopping-image-skeleton' });
test('keeps the skeleton through search and download, then reveals the photo', () => {
  act(() => { renderer = TestRenderer.create(<ShoppingStyleVisual target={target} />); });
  expect(skeletons().length).toBeGreaterThan(0);
  act(() => renderer.update(<ShoppingStyleVisual target={{ ...target, imageUrl: 'https://example.com/a.jpg' }} />));
  expect(skeletons().length).toBeGreaterThan(0);
  act(() => renderer.root.findByType('ExpoImage' as any).props.onLoad());
  expect(skeletons()).toHaveLength(0);
  act(() => renderer.update(<ShoppingStyleVisual target={{ ...target, imageUrl: 'https://example.com/b.jpg' }} />));
  expect(skeletons().length).toBeGreaterThan(0);
});
test('uses a static illustration when search settles or a photo fails', () => {
  act(() => { renderer = TestRenderer.create(<ShoppingStyleVisual target={{ ...target, offerState: { ...target.offerState!, status: 'unavailable' } }} />); });
  expect(skeletons()).toHaveLength(0);
  act(() => renderer.update(<ShoppingStyleVisual target={{ ...target, offerState: undefined, imageUrl: 'https://example.com/a.jpg' }} />));
  act(() => renderer.root.findByType('ExpoImage' as any).props.onError());
  expect(skeletons()).toHaveLength(0);
  expect(renderer.root.findAllByType('ExpoImage' as any)).toHaveLength(0);
});
test('shows delayed search context and clears it on completion', () => {
  jest.useFakeTimers();
  act(() => { renderer = TestRenderer.create(<ShoppingImageSearchStatus pending />); });
  expect(renderer.toJSON()).toBeNull();
  act(() => jest.advanceTimersByTime(3000));
  expect(JSON.stringify(renderer.toJSON())).toContain('Finding pieces for you');
  act(() => renderer.update(<ShoppingImageSearchStatus pending={false} />));
  expect(renderer.toJSON()).toBeNull();
});
