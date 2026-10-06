jest.mock('../../../lib/api', () => ({ api: { post: jest.fn().mockResolvedValue({ data: { productKey: 'k' } }), delete: jest.fn().mockResolvedValue({}) } }));
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

test.each([1, 2, 3])('editorial outfits always show the suggested addition with %s owned pieces', count => {
  const ids = Array.from({ length: count }, (_, index) => index + 1);
  render(<ShoppingOutfitPreview editorial look={{ label: 'Weekend walk', itemIds: ids }} target={target}
    wardrobe={new Map(ids.map(id => [id, { id, name: `Owned piece ${id}` } as Item]))} />);
  const json = JSON.stringify(renderer.toJSON());
  expect(json).toContain(`1 new · ${count} you own`);
  expect(json).not.toContain('with this piece');
  expect(renderer.root.findAllByType('WardrobeThumbnail' as any)).toHaveLength(count);
  expect(json.indexOf('Recommended piece to add')).toBeLessThan(json.indexOf('Owned piece 1'));
});

test('editorial guide teaches selection criteria before outfits and shopping', () => {
  render(<ShoppingPriorityTargetCard editorial target={{ ...target, shoppingNotes: ['Smooth wool', 'Clean hem'] }} index={2}
    wardrobe={new Map([[1, { id: 1, name: 'Jacket' } as Item], [2, { id: 2, name: 'Shoes' } as Item]])} />);
  const json = JSON.stringify(renderer.toJSON());
  expect(json.indexOf('What to look for')).toBeLessThan(json.indexOf('Ways to wear it'));
  expect(json.indexOf('Ways to wear it')).toBeLessThan(json.indexOf('Shop this style'));
  expect(json).toContain('Smooth wool');
  expect(json).toContain('1 new · 2 you own');
});

test('editorial guide omits absent budgets, criteria, outfits and shopping', () => {
  render(<ShoppingPriorityTargetCard editorial target={{ ...target, priceRange: '', color: '', material: '', silhouette: '', retailerExamples: [], outfitIdeas: [] }} index={1} wardrobe={new Map()} />);
  const json = JSON.stringify(renderer.toJSON());
  expect(json).not.toContain('Suggested budget');
  expect(json).not.toContain('What to look for');
  expect(json).not.toContain('Ways to wear it');
  expect(json).not.toContain('Shop this style');
  expect(json).toContain(target.rationale);
});

test('editorial guide hides criteria shared at guide level and links to the next style', () => {
  const onNext = jest.fn();
  render(<ShoppingPriorityTargetCard editorial hideCriteria showBudget={false} nextTitle="Stone twill" onNext={onNext} target={{ ...target, shoppingNotes: ['Smooth wool'] }} index={1} wardrobe={new Map()} />);
  const json = JSON.stringify(renderer.toJSON());
  expect(json).not.toContain('What to look for');
  expect(json).not.toContain('Suggested budget');
  act(() => renderer.root.findByProps({ accessibilityLabel: 'Next: Stone twill' }).props.onPress());
  expect(onNext).toHaveBeenCalled();
});

const offer = (id: string, price: number) => ({ id, provider: 'serper' as const, title: `Trouser ${id}`, brand: null, merchant: 'Shop', price, currency: 'CAD', formattedPrice: `$${price}`, imageUrl: null, url: `https://example.com/${id}`, inStock: true, monetized: false, imagePolicy: 'hotlink' as const });

test('editorial guide leads with real listings before the reasoning', () => {
  const offers = [offer('a', 120), offer('b', 180)];
  render(<ShoppingPriorityTargetCard editorial offerContext={{ reference: 'r', targetKey: 'charcoal', surface: 'shopping_guide' }}
    target={{ ...target, shoppingNotes: ['Smooth wool'], offers, offerState: { status: 'ready', offers, retrievedAt: null, expiresAt: null } }} index={1} wardrobe={new Map()} />);
  const json = JSON.stringify(renderer.toJSON());
  expect(json.indexOf('Trouser a')).toBeLessThan(json.indexOf(target.rationale));
  expect(json).not.toContain('Shop this style');
});

test('style comparison shows real prices and the most versatile style', () => {
  const { ShoppingStyleSwatches } = require('../ShoppingStyleSwatches');
  const wardrobe = new Map([[1, { id: 1 } as Item], [2, { id: 2 } as Item]]);
  const offers = [offer('a', 180), offer('b', 120)];
  render(<ShoppingStyleSwatches wardrobe={wardrobe} onSelect={jest.fn()} targets={[
    { ...target, offers, offerState: { status: 'ready', offers, retrievedAt: null, expiresAt: null } },
    { ...target, key: 'navy', title: 'Navy', outfitIdeas: [{ label: 'Weekend', itemIds: [1] }], offerState: { status: 'pending', offers: [], retrievedAt: null, expiresAt: null } },
  ]} />);
  const json = JSON.stringify(renderer.toJSON());
  expect(json).toContain('$120–180');
  expect(json).not.toContain('options');
  expect(json).not.toContain('of your pieces');
  expect(renderer.root.findAll(node => (node.type as unknown) === 'Text' && node.props.children === 'Most versatile')).toHaveLength(1);
});
