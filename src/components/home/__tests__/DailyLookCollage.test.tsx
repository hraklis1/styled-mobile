jest.mock('../DailyLookShoppingOptions', () => ({ DailyLookShoppingOptions: 'DailyLookShoppingOptions' }));
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { DailyLookDetailSheet } from '../DailyLookDetailSheet';
import { LookMat, LookMatAction } from '../TodaysLookPlate';
import { EditorialOutfitBoard } from '../../outfits/EditorialOutfitBoard';
import type { DailyLookCandidate } from '../../../hooks/useDailyLook';
import type { Item } from '../../../types/item';

const mockScrollTo = jest.fn();
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = jest.requireActual('react');
  return { __esModule: true, default: React.forwardRef(function MockScrollView({ children, ...props }: any, ref: any) {
    React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return React.createElement('TestScrollView', props, children);
  }) };
});

jest.mock('../../../lib/api', () => ({ API_BASE_URL: 'https://example.com' }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = jest.requireActual('react');
  return { __esModule: true, default: function TestPressable({ children, ...props }: any) {
    return React.createElement('TestPressable', props, typeof children === 'function' ? children({ pressed: false }) : children);
  } };
});
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));
jest.mock('../../outfits/OutfitCollage', () => ({ OutfitCollage: 'OutfitCollage' }));
jest.mock('../../primitives/PressableScale', () => ({
  PressableScale: ({ children, contentStyle, ...props }: any) => {
    const React = jest.requireActual('react');
    const { Pressable } = jest.requireActual('react-native');
    return React.createElement(Pressable, { ...props, style: contentStyle }, children);
  },
}));
jest.mock('react-native-reanimated', () => {
  const transition = { duration: () => transition, reduceMotion: () => transition };
  return { __esModule: true, default: { View: 'AnimatedView' }, FadeIn: transition, FadeOut: transition, LinearTransition: transition, ReduceMotion: { System: 'system' } };
});

const entries = [{ id: 1, category: 'top' }, { id: 2, category: 'bottom' }, { id: 3, category: 'shoes' }];
const items = entries.map(entry => ({ ...entry, name: `Garment ${entry.id}` })) as Item[];
const candidate = {
  id: 10, userId: 1, name: 'One piece away', reason: 'A polished layer for today’s rain',
  stylistNotes: 'A polished layer for today’s rain', readinessStatus: 'incomplete',
  itemIds: entries, foundationItemIds: entries,
  missingEssentials: [{ label: 'weatherproof_layer', category: 'outerwear', context: "for today's rain", preferredColors: ['black'] }],
} as DailyLookCandidate;
const mounted: TestRenderer.ReactTestRenderer[] = [];
function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(element); });
  mounted.push(renderer);
  return renderer;
}
beforeEach(() => {
  mockScrollTo.mockClear();
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 0; });
});
afterEach(() => { act(() => { mounted.splice(0).forEach(renderer => renderer.unmount()); }); jest.restoreAllMocks(); });
const labels = (renderer: TestRenderer.ReactTestRenderer) => renderer.root.findAllByType(Text).map(node => node.props.children).filter(text => typeof text === 'string') as string[];
function sheetProps() {
  return { visible: true, candidate, items, onClose: jest.fn(), onSave: jest.fn(), onDismiss: jest.fn(), onFindPiece: jest.fn(), onOpenItem: jest.fn(), onSheetDismissed: jest.fn() };
}

test('Home collage has independent item, suggestion, shopping and look-detail targets', () => {
  const onItem = jest.fn(), onSuggestion = jest.fn(), onLook = jest.fn(), onFind = jest.fn();
  const renderer = render(<LookMat collageCaption interactivePlate title="Look" onOpen={onLook} accessibilityLabel="Look details"
    plate={<EditorialOutfitBoard width={330} pieces={entries.map((entry, index) => ({ ...entry, item: items[index] }))}
      onPressItem={onItem} suggestion={{ label: 'Weatherproof layer', category: 'outerwear' }} onPressSuggestion={onSuggestion} />}
    action={<LookMatAction icon="bag-outline" multiline label="Find a weatherproof layer" onPress={onFind} accessibilityLabel="Find layer" />} />);
  const buttons = renderer.root.findAllByType(Pressable);
  const item = buttons.find(button => button.props.accessibilityLabel === 'View Garment 1, top')!;
  let ancestor = item.parent;
  while (ancestor) { expect(ancestor.type).not.toBe(Pressable); ancestor = ancestor.parent; }
  act(() => item.props.onPress());
  act(() => buttons.find(button => button.props.accessibilityLabel.includes('Not in your closet'))!.props.onPress());
  act(() => buttons.find(button => button.props.accessibilityLabel === 'Find layer')!.props.onPress());
  act(() => buttons.find(button => button.props.accessibilityLabel === 'Look details: Look')!.props.onPress());
  expect(onItem).toHaveBeenCalledWith(1);
  expect(onSuggestion).toHaveBeenCalledTimes(1);
  expect(onFind).toHaveBeenCalledTimes(1);
  expect(onLook).toHaveBeenCalledTimes(1);
});

test('suggestion criteria precede compact closet preview, without duplicated context or full board', () => {
  const props = sheetProps();
  const renderer = render(<DailyLookDetailSheet {...props} mode="suggestion" />);
  const text = labels(renderer);
  expect(text.filter(value => value === candidate.reason)).toHaveLength(1);
  expect(text).not.toContain("For today's rain");
  expect(text.indexOf('Colours')).toBeLessThan(text.indexOf('With your closet'));
  expect(renderer.root.findAllByType(EditorialOutfitBoard)).toHaveLength(0);
  const garment = renderer.root.findAllByType(Pressable).find(button => button.props.accessibilityLabel === 'Garment 1')!;
  act(() => garment.props.onPress());
  expect(props.onOpenItem).toHaveBeenCalledWith(1);
  expect(text).not.toContain('Garment 1');
  expect(text.indexOf('With your closet')).toBeLessThan(text.indexOf('Complete your look'));
  const options = renderer.root.findByType('DailyLookShoppingOptions' as any);
  expect(props.onFindPiece).not.toHaveBeenCalled();
  act(() => options.props.onAvailabilityChange(true));
  const explore = renderer.root.findAllByType(Pressable).find(button => button.props.accessibilityLabel === 'Explore all options')!;
  act(() => explore.props.onPress());
  expect(renderer.root.findByType('DailyLookShoppingOptions' as any).props.exploreRequest).toBe(1);
  expect(props.onDismiss).not.toHaveBeenCalled();
  expect(labels(renderer)).toContain('TO COMPLETE YOUR LOOK');
  expect(labels(renderer)).not.toContain('Suggested addition');
  const guide = renderer.root.findAllByType(Pressable).find(button => button.props.accessibilityLabel === 'Read styling notes')!;
  act(() => guide.props.onPress());
  expect(props.onFindPiece).toHaveBeenCalledTimes(1);
  const dismiss = renderer.root.findAllByType(Pressable).find(button => button.props.accessibilityLabel === 'Not for me')!;
  expect(dismiss.parent).toBe(guide.parent);
  act(() => dismiss.props.onPress());
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
});

test.each(['incomplete', 'priority', 'ready'] as const)('look mode keeps %s collage interactive without duplicate wardrobe list', readinessStatus => {
  const props = sheetProps();
  const renderer = render(<DailyLookDetailSheet {...props} candidate={{ ...candidate, readinessStatus }} mode="look" />);
  expect(renderer.root.findAllByType(EditorialOutfitBoard)).toHaveLength(1);
  expect(labels(renderer)).not.toContain('From your closet');
  expect(labels(renderer)).not.toContain('The pieces');
  const suggestion = renderer.root.findAllByType(Pressable).filter(button => button.props.accessibilityLabel?.includes('Not in your closet'));
  expect(suggestion).toHaveLength(0);
  if (readinessStatus !== 'ready') {
    expect(labels(renderer).filter(label => label === 'Weatherproof layer')).toHaveLength(1);
    expect(labels(renderer)).toContain("For today's rain");
    const sequence = renderer.root.findAll(node => node.type === EditorialOutfitBoard || node.type === Text);
    expect(sequence.findIndex(node => node.props.children === candidate.reason)).toBeLessThan(sequence.findIndex(node => node.type === EditorialOutfitBoard));
    expect(sequence.findIndex(node => node.props.children === candidate.reason)).toBeLessThan(sequence.findIndex(node => node.props.children === 'Suggested addition'));
  }
});

test('flat lay retains its image and existing wardrobe list', () => {
  const renderer = render(<DailyLookDetailSheet {...sheetProps()} candidate={{ ...candidate, readinessStatus: 'ready', aiGeneratedImageUrl: 'https://example.com/flat.jpg' }} mode="look" />);
  expect(renderer.root.findAllByType('OutfitCollage' as any)).toHaveLength(1);
  expect(labels(renderer)).toContain('The pieces');
});

test('sheet scroll survives an item visit and resets for a fresh session or candidate', () => {
  const props = sheetProps();
  const renderer = render(<DailyLookDetailSheet {...props} mode="suggestion" sessionKey={1} />);
  const scroll = renderer.root.findByType(ScrollView);
  act(() => scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 160 } } }));
  act(() => renderer.update(<DailyLookDetailSheet {...props} visible={false} mode="suggestion" sessionKey={1} />));
  act(() => renderer.update(<DailyLookDetailSheet {...props} mode="suggestion" sessionKey={1} />));
  act(() => renderer.root.findByType(ScrollView).props.onContentSizeChange());
  expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 160, animated: false });
  act(() => renderer.update(<DailyLookDetailSheet {...props} mode="suggestion" sessionKey={2} />));
  expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
  act(() => renderer.update(<DailyLookDetailSheet {...props} candidate={{ ...candidate, id: 11 }} mode="suggestion" sessionKey={2} />));
  expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
});

test('unresolved clothing is visible without an item action and empty criteria are omitted', () => {
  const renderer = render(<DailyLookDetailSheet {...sheetProps()} items={[]} candidate={{ ...candidate, missingEssentials: [{ ...candidate.missingEssentials[0], preferredColors: [] }] }} mode="suggestion" />);
  expect(labels(renderer)).not.toContain('Colours');
  const previews = renderer.root.findAllByType(Pressable).filter(button => button.props.accessibilityLabel?.includes('unavailable wardrobe piece'));
  expect(previews).toHaveLength(3);
  expect(previews.every(button => button.props.disabled && !button.props.accessibilityRole)).toBe(true);
});

test('long suggestion and shopping labels can wrap without a fixed tile height', () => {
  const label = 'A lightweight weatherproof layer for formal occasions and rainy commutes';
  const renderer = render(<LookMat collageCaption interactivePlate largeText title="Look" note="A styling reason" onOpen={jest.fn()} accessibilityLabel="Look"
    plate={<EditorialOutfitBoard width={280} pieces={[]} suggestion={{ label, category: 'unknown' }} onPressSuggestion={jest.fn()} />}
    action={<LookMatAction icon="bag-outline" multiline label={`Find a ${label}`} onPress={jest.fn()} accessibilityLabel="Find" />} />);
  const text = renderer.root.findAllByType(Text).filter(node => node.props.children === label || node.props.children === `Find a ${label}`);
  expect(text).toHaveLength(2);
  expect(text.every(node => node.props.numberOfLines == null)).toBe(true);
  const tile = renderer.root.findAllByType(Pressable).find(button => button.props.accessibilityLabel.includes('Not in your closet'))!;
  const style = StyleSheet.flatten(tile.props.style({ pressed: false }));
  expect(style.minHeight).toBeGreaterThanOrEqual(44);
  expect(style.height).toBeUndefined();
});

test('a failed garment image falls back to the clothing outline while retaining its action', () => {
  const onPressItem = jest.fn();
  const renderer = render(<EditorialOutfitBoard width={300} pieces={[{ id: 1, category: 'top', item: { ...items[0], imageUrl: 'https://example.com/unavailable.jpg' } }]} onPressItem={onPressItem} />);
  act(() => renderer.root.findByType('Image' as any).props.onError());
  expect(renderer.root.findAllByType('Image' as any)).toHaveLength(0);
  expect(renderer.root.findAllByType('Ionicons' as any).some(node => node.props.name === 'shirt-outline')).toBe(true);
  act(() => renderer.root.findByType(Pressable).props.onPress());
  expect(onPressItem).toHaveBeenCalledWith(1);
});
