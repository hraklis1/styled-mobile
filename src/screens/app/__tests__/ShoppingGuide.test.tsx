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
const mockSave = jest.fn().mockResolvedValue(undefined);
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

test.each([1, 3, 5])('saves %i styles and opens a single style automatically', async (count) => {
  mockData = fixture(count);
  await render();
  expect(cards()).toHaveLength(count);
  expect(cards()[0].props.expanded).toBe(count === 1);
  const save = renderer.root
    .findAllByType('PressableScale' as any)
    .find((node) => node.props.accessibilityLabel === 'Save this guide')!;
  await act(async () => {
    await save.props.onPress();
  });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave.mock.calls[0][0].shoppingBrief.targets).toHaveLength(count);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Trousers Gap');
});

test('one style stays open across an unchanged data refresh and stylist return', async () => {
  mockData = fixture(3);
  await render();
  act(() => cards()[0].props.onToggle());
  expect(cards().map((card) => card.props.expanded)).toEqual([true, false, false]);
  act(() => cards()[1].props.onToggle());
  expect(cards().map((card) => card.props.expanded)).toEqual([false, true, false]);
  mockData = { ...mockData, targets: [...mockData.targets] };
  await act(async () => renderer.update(<ShoppingPriorityEditScreen {...(props as any)} />));
  expect(cards()[1].props.expanded).toBe(true);
  const ask = renderer.root.findAllByProps({ accessibilityLabel: 'Ask your stylist' })[0];
  act(() => ask.props.onPress());
  expect(mockOpen).toHaveBeenCalledWith(
    expect.objectContaining({
      initialQuery: undefined,
      context: { kind: 'shopping_brief_edit', priority, targets: mockData.targets },
    }),
  );
  expect(cards()[1].props.expanded).toBe(true);
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
