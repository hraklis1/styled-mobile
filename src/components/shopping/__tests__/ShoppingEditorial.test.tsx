jest.mock('../../../hooks/useWishlist', () => ({ useWishlist: () => ({ data: [] }), saveProductOffer: jest.fn() }));
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { ShoppingPriorityTarget } from '../../../lib/shoppingPriorityEdit';
import type { Item } from '../../../types/item';
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image', () => ({ Image: 'ExpoImage' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path' }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  useReducedMotion: () => true,
}));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../primitives/PressableScale', () => ({ PressableScale: 'PressableScale' }));
jest.mock('../WardrobeThumbnail', () => ({ WardrobeThumbnail: 'WardrobeThumbnail' }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn().mockResolvedValue({}) }));
import { ShoppingStyleVisual } from '../ShoppingStyleVisual';
import { ShoppingOutfitPreview } from '../ShoppingOutfitPreview';
import { ShoppingPriorityTargetCard } from '../ShoppingPriorityTargetCard';
const target: ShoppingPriorityTarget = {
  key: 'charcoal',
  title: 'Charcoal wool',
  color: 'charcoal',
  category: 'bottom',
  material: 'wool',
  silhouette: 'tapered',
  priceRange: '$120–220 CAD',
  retailerExamples: ['Uniqlo'],
  rationale: 'An easy partner for your jacket.',
  unlocks: [],
  outfitIdeas: [{ label: 'Office ready', itemIds: [1, 2] }],
};
let renderer: TestRenderer.ReactTestRenderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
});
function render(element: React.ReactElement) {
  act(() => {
    renderer = TestRenderer.create(element);
  });
}

test('image failures fall back to a silhouette and reduced motion disables image fades', () => {
  render(
    <ShoppingStyleVisual target={{ ...target, imageUrl: 'https://example.com/trousers.jpg' }} />,
  );
  const image = renderer.root.findByType('ExpoImage' as any);
  expect(image.props.transition).toBe(0);
  act(() => image.props.onError());
  expect(renderer.root.findAllByType('ExpoImage' as any)).toHaveLength(0);
  expect(renderer.root.findAllByType('Svg' as any)).toHaveLength(1);
});

test('deleted wardrobe references downgrade an outfit to an honest pairing', () => {
  render(
    <ShoppingOutfitPreview
      look={target.outfitIdeas[0]}
      target={target}
      wardrobe={new Map([[1, { id: 1, name: 'My navy jacket' } as Item]])}
    />,
  );
  const json = JSON.stringify(renderer.toJSON());
  expect(json).toContain('Pair it with');
  expect(json).not.toContain('Office ready');
  expect(json).toContain('My navy jacket');
  expect(json).toContain('Recommended piece to add');
  expect(renderer.root.findAllByType('WardrobeThumbnail' as any)).toHaveLength(1);
});

test('style directions expose wardrobe evidence, products and shopping notes together', () => {
  const wardrobe = new Map([
    [1, { id: 1, name: 'Jacket' } as Item],
    [2, { id: 2, name: 'Shoes' } as Item],
  ]);
  render(<ShoppingPriorityTargetCard target={target} index={1} wardrobe={wardrobe} />);
  const json = JSON.stringify(renderer.toJSON());
  expect(json).toContain('Office ready');
  expect(json).toContain('Uniqlo');
  expect(json).toContain('What to look for');
  expect(json.indexOf('With your wardrobe')).toBeLessThan(json.indexOf('Pieces to consider'));
  expect(json.indexOf('Pieces to consider')).toBeLessThan(json.indexOf('What to look for'));
  expect(renderer.root.findAll(node => node.props.accessibilityRole === 'tab')).toHaveLength(0);
});

test('missing outfit and retailer data leaves useful guidance without empty sections', () => {
  render(
    <ShoppingPriorityTargetCard
      target={{ ...target, retailerExamples: [], outfitIdeas: [] }}
      index={1}
      wardrobe={new Map()}
      expanded
    />,
  );
  const json = JSON.stringify(renderer.toJSON());
  expect(json).not.toContain('With your wardrobe');
  expect(json).not.toContain('Pieces to consider');
  expect(json).toContain('What to look for');
});
