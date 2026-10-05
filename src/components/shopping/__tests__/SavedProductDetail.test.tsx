import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SavedProductDetail } from '../SavedProductDetail';
import type { WishlistEntry } from '../../../lib/wishlist';

jest.mock('../../../hooks/useItems', () => ({ useItems: () => ({ data: [] }) }));
let mockOffers: Record<string, any> = {};
jest.mock('../../../hooks/useProductOffers', () => ({ useProductOffers: () => ({ data: mockOffers, refetch: jest.fn() }) }));
jest.mock('../CuratedProductDetail', () => ({ ProductDetailContent: 'ProductDetailContent' }));
jest.mock('../CuratedItemRail', () => ({ CuratedItemRail: 'CuratedItemRail' }));
jest.mock('../ShoppingRetailerLinks', () => ({ openShoppingLink: jest.fn() }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
import { openShoppingLink } from '../ShoppingRetailerLinks';
const offer = { id: 'original', provider: 'fixture', title: 'Original piece', url: 'https://retailer.example/original', formattedPrice: 'CA$100' };
const target = { key: 'navy', title: 'Navy trousers', category: 'bottom', color: 'navy', material: 'cotton', silhouette: 'straight', priceRange: '', retailerExamples: [] };
const entry = { id: 'saved', outfit: { product: { offer, target, savedPriceAt: '2026-10-01', source: 'shop_overview' } } } as unknown as WishlistEntry;
let renderer: TestRenderer.ReactTestRenderer;
afterEach(() => act(() => renderer?.unmount()));
beforeEach(() => { mockOffers = {}; jest.clearAllMocks(); });
function render(value = entry) { act(() => { renderer = TestRenderer.create(<SavedProductDetail entry={value} />); }); }
test('saved products retain available style context and their dated price without invented outfits', () => {
  render();
  const detail = renderer.root.findByType('ProductDetailContent' as any);
  expect(detail.props.reason).toBe('navy · cotton · straight');
  expect(detail.props.priceNote).toContain('Saved price');
  expect(detail.props.target.outfitIdeas).toEqual([]);
  expect(detail.props.offer).toBe(offer);
});
test('refresh preserves the original identity and destination while alternatives stay separate', () => {
  mockOffers = { navy: { status: 'ready', offers: [{ ...offer, title: 'Changed title', url: 'https://retailer.example/changed', formattedPrice: 'CA$110' }, { ...offer, id: 'alternative' }] } };
  render();
  const detail = renderer.root.findByType('ProductDetailContent' as any);
  expect(detail.props.offer).toMatchObject({ title: offer.title, url: offer.url, formattedPrice: 'CA$110' });
  act(() => detail.props.onRetailer());
  expect(openShoppingLink).toHaveBeenCalledWith(offer.url);
  expect(renderer.root.findByType('CuratedItemRail' as any).props.offers.map((item: any) => item.id)).toEqual(['alternative']);
});
test('saved guides supply their original rationale and outfit evidence when present', () => {
  const fullTarget = { ...target, rationale: 'Pairs with your jacket.', outfitIdeas: [{ label: 'Office', itemIds: [1] }], unlocks: [] };
  render({ ...entry, outfit: { ...entry.outfit, shoppingBrief: { targets: [fullTarget] } as any } });
  expect(renderer.root.findByType('ProductDetailContent' as any).props).toMatchObject({ reason: fullTarget.rationale, target: fullTarget });
});
