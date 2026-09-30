import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { FlatList, Text } from 'react-native';
import { ItemInspectionModal } from '../scan-review/ItemInspectionModal';
import { SpecSheet } from '../scan-review/SpecSheet';
import { colors } from '../../../theme';
import type { ScanReviewPiece } from '../scan-review/types';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: jest.requireActual('react-native').View, FlatList: jest.requireActual('react-native').FlatList },
  useSharedValue: (value: unknown) => jest.requireActual('react').useRef({ value }).current,
  useAnimatedStyle: (fn: () => Record<string, unknown>) => new Proxy({}, { get: (_target, key: string) => fn()[key] }),
  useAnimatedScrollHandler: (handlers: unknown) => handlers,
  interpolate: () => 1,
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock('react-native-keyboard-controller', () => ({ KeyboardAwareScrollView: 'KeyboardScroll' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-blur', () => ({ BlurView: 'Blur' }));
jest.mock('../scan-review/SpecSheet', () => ({ SpecSheet: 'SpecSheet' }));
jest.mock('../scan-review/feedback', () => ({ selectionFeedback: jest.fn() }));

const pieces: ScanReviewPiece[] = Array.from({ length: 35 }, (_, index) => ({
  id: String(index), name: `Piece ${index}`, brand: '', included: true, extraction: 'not-started',
  photo: 'file:///photo.jpg', cutout: null, useCutout: false, canAdjustCrop: true, cropSource: 'file:///source.jpg',
  cropBbox: { x: 0, y: 0, width: 1, height: 1 }, category: null, subcategory: null, color: null, style: null,
  seasons: [], occasions: [], material: null, fit: null, sizeProfile: null, sleeveLength: null,
}));
it('commits paging only at settlement and disables metadata during the gesture', () => {
  const active = jest.fn(), toggle = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<ItemInspectionModal pieces={pieces} activeId="0" stage="pre-extract" states={{}}
    disabled={false} reduceMotion bottomPadding={20} footerHeight={60} onActiveChange={active}
    onUpdate={jest.fn()} onOpenSheet={jest.fn()} onCrop={jest.fn()} onToggleCutout={jest.fn()} onToggleIncluded={toggle} />); });
  const handlers = renderer.root.findByType(FlatList).props.onScroll as any;
  const interval = renderer.root.findByType(FlatList).props.snapToInterval;
  act(() => handlers.onBeginDrag());
  expect(renderer.root.findByType(SpecSheet).props.disabled).toBe(true);
  const dotColor = (slot: number) => renderer.root.findAll(n => n.props.testID === `inspection-page-dot-${slot}`)[0].props.style[1].backgroundColor;
  expect(dotColor(0)).toBe(colors.foreground);
  act(() => handlers.onScroll({ contentOffset: { x: interval * 0.6 } }));
  expect(dotColor(1)).toBe(colors.foreground);
  expect(dotColor(0)).toBe(colors.border);
  // Reversing a swipe updates the indicator before any settlement callback.
  act(() => handlers.onScroll({ contentOffset: { x: interval * 0.3 } }));
  expect(dotColor(0)).toBe(colors.foreground);
  act(() => handlers.onScroll({ contentOffset: { x: interval * 34 } }));
  expect(dotColor(6)).toBe(colors.foreground);
  act(() => handlers.onScroll({ contentOffset: { x: interval } }));
  expect(active).not.toHaveBeenCalled();
  act(() => handlers.onMomentumEnd({ contentOffset: { x: interval } }));
  expect(active).toHaveBeenCalledWith('1');
  expect(renderer.root.findByType(SpecSheet).props.disabled).toBe(false);
  const status = renderer.root.findAll(n => n.props.accessibilityLabel === 'Include Piece 0' && n.props.onPress)[0];
  act(() => status.props.onPress());
  expect(toggle).toHaveBeenCalledWith('0');
  expect(renderer.root.findAllByType(Text).some(n => n.props.children === 'Previous' || n.props.children === 'Next')).toBe(false);
  const dots = renderer.root.findAll(n => n.props.accessibilityRole === 'adjustable')[0];
  expect(dots.props.children).toHaveLength(7);
  act(() => renderer.unmount());
});
