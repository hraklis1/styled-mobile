jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), usePreventRemove: jest.fn() }));
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { ShoppingPriorityEdit } from '../../../lib/shoppingPriorityEdit';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  useReducedMotion: () => true,
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: (fn: () => object) => fn(),
  withTiming: (value: number) => value,
  withRepeat: (value: number) => value,
  cancelAnimation: () => undefined,
  Easing: { inOut: () => undefined, quad: undefined },
}));
jest.mock('../../../components/primitives/PressableScale', () => ({
  PressableScale: 'PressableScale',
}));
jest.mock('../../../components/shopping/ShopSubpageHeader', () => ({
  ShopSubpageHeader: 'ShopSubpageHeader',
}));
jest.mock('../../../components/shopping/ShoppingPriorityTargetCard', () => ({
  ShoppingPriorityTargetCard: 'ShoppingPriorityTargetCard',
}));
jest.mock('../../../hooks/useItems', () => ({ useItems: () => ({ data: [] }) }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
const mockSave = jest.fn().mockResolvedValue({ id: 'saved-guide' });
jest.mock('../../../hooks/useWishlist', () => ({
  useWishlist: () => ({ data: [] }),
  addOutfitToWishlist: (...args: unknown[]) => mockSave(...args),
}));
const mockOpen = jest.fn();
jest.mock('../../../contexts/GlobalAIStylistContext', () => ({
  useGlobalAIStylist: () => ({ openStylist: mockOpen }),
}));
let mockData: ShoppingPriorityEdit | undefined;
jest.mock('../../../hooks/useShoppingPriorityEdit', () => ({
  useShoppingPriorityEdit: () => ({ data: mockData, isLoading: false, isError: false }),
}));
import { ShoppingPriorityEditScreen } from '../ShoppingPriorityEditScreen';
const priority = {
  label: 'Tailored trousers',
  category: 'bottom',
  reason: 'wardrobe_gap' as const,
  context: 'Try with your jacket.',
  priority: 1,
  unlocks: [],
};
function fixture(count: number): ShoppingPriorityEdit {
  return {
    status: 'ready',
    headline: 'Tailored Trousers Gap',
    summary: 'Try these with your jacket.',
    generatedAt: '2026-09-28',
    priority,
    noBuyReason: null,
    targets: Array.from({ length: count }, (_, i) => ({
      key: String(i),
      title: i ? 'Deep navy' : 'Charcoal wool',
      color: i ? 'navy' : 'charcoal',
      category: 'bottom',
      material: 'wool',
      silhouette: 'tapered',
      priceRange: '$120–220 CAD',
      retailerExamples: [],
      rationale: 'An easy partner for your jacket.',
      unlocks: [],
      outfitIdeas: [],
    })),
  };
}
const props = {
  navigation: { canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() },
  route: { params: { priority } },
};
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  mockSave.mockClear();
  mockOpen.mockClear();
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
});
async function render() {
  await act(async () => {
    renderer = TestRenderer.create(<ShoppingPriorityEditScreen {...(props as any)} />);
  });
}
const cards = () => renderer.root.findAllByType('ShoppingPriorityTargetCard' as any);

test.each([1, 3, 5])('saves %i styles and displays every style without disclosure', async (count) => {
  mockData = fixture(count);
  await render();
  expect(cards()).toHaveLength(count);
  expect(cards().every(card => card.props.expanded === undefined && card.props.onToggle === undefined)).toBe(true);
  const save = renderer.root
    .findAllByType('PressableScale' as any)
    .find((node) => node.props.accessibilityLabel === 'Save list')!;
  await act(async () => {
    await save.props.onPress();
  });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave.mock.calls[0][0].shoppingBrief.targets).toHaveLength(count);
  const viewSaved = renderer.root.findAllByType('PressableScale' as any).find(node => node.props.accessibilityLabel === 'View wishlist list')!;
  act(() => viewSaved.props.onPress());
  expect(props.navigation.navigate).toHaveBeenCalledWith('Wishlist', { section: 'lists', selectedId: 'saved-guide' });
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Trousers Gap');
});

test('all styles remain visible across an unchanged refresh and stylist return', async () => {
  mockData = fixture(3);
  await render();
  expect(cards()).toHaveLength(3);
  mockData = { ...mockData, targets: [...mockData.targets] };
  await act(async () => renderer.update(<ShoppingPriorityEditScreen {...(props as any)} />));
  expect(cards()).toHaveLength(3);
  const ask = renderer.root.findAllByProps({ accessibilityLabel: 'Ask your stylist' })[0];
  act(() => ask.props.onPress());
  expect(mockOpen).toHaveBeenCalledWith(
    expect.objectContaining({
      initialQuery: undefined,
      context: { kind: 'shopping_brief_edit', priority, targets: mockData.targets },
    }),
  );
  expect(cards()).toHaveLength(3);
});

test('a suggested follow-up is dispatched exactly once with actual guide context', async () => {
  mockData = fixture(3);
  await render();
  const question = renderer.root.findAllByProps({
    accessibilityLabel: 'Would navy work better for me?',
  })[0];
  act(() => question.props.onPress());
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockOpen).toHaveBeenCalledWith(
    expect.objectContaining({
      initialMode: 'advice',
      initialQuery: 'Would navy work better for me?',
      context: expect.objectContaining({ targets: mockData.targets }),
    }),
  );
});

test.each([1, 3])('a guide with %i styles uses chapter contents only when useful', async count => {
  mockData = fixture(count);
  await render();
  const contents = renderer.root.findAllByType(require('../../../components/shopping/ShoppingStyleSwatches').ShoppingStyleSwatches);
  expect(contents).toHaveLength(count > 1 ? 1 : 0);
  if (count > 1) expect(contents[0].props.targets.map((target: any) => target.key)).toEqual(mockData.targets.map(target => target.key));
  expect(cards().every(card => card.props.editorial)).toBe(true);
  const scroll = renderer.root.findByType(require('react-native').ScrollView);
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe('never');
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Back' }).some(node => node.parent !== scroll)).toBe(true);
});

test('contents tracks refreshed targets instead of linking to removed chapters', async () => {
  mockData = fixture(3);
  await render();
  mockData = { ...mockData, targets: mockData.targets.slice(1) };
  await act(async () => renderer.update(<ShoppingPriorityEditScreen {...(props as any)} />));
  const contents = renderer.root.findByType(require('../../../components/shopping/ShoppingStyleSwatches').ShoppingStyleSwatches);
  expect(contents.props.targets.map((target: any) => target.key)).toEqual(['1', '2']);
  expect(cards()).toHaveLength(2);
});

test('style tabs appear once the comparison scrolls away and follow the current chapter', async () => {
  mockData = fixture(3);
  await render();
  const { ScrollView } = require('react-native');
  const scroll = () => renderer.root.findAllByType(ScrollView).find(node => !node.props.horizontal)!;
  const contents = renderer.root.findAll(node => typeof node.type === 'string' && typeof node.props.onLayout === 'function');
  act(() => contents.forEach(node => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } } })));
  expect(renderer.root.findAllByProps({ accessibilityRole: 'tab' })).toHaveLength(0);
  act(() => scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 400 } } }));
  const tabs = renderer.root.findAll(node => node.props.accessibilityRole === 'tab' && typeof node.type !== 'string' && node.props.onPress);
  expect(tabs.map(tab => tab.props.accessibilityLabel)).toEqual(['Charcoal wool', 'Deep navy', 'Deep navy', 'Questions for your stylist']);
  act(() => scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } }));
  expect(renderer.root.findAllByProps({ accessibilityRole: 'tab' })).toHaveLength(0);
});
