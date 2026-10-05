import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable, ScrollView, Text } from 'react-native';
import { CuratedItemRail } from '../CuratedItemRail';
import { CuratedProductDetail } from '../CuratedProductDetail';
import { CuratedProductBrowser } from '../CuratedProductBrowser';
import { track } from '../../../lib/analytics';
import { CuratedItemCard } from '../CuratedItemCard';
import { saveProductOffer, unsaveProductEntry } from '../../../hooks/useWishlist';
import type { ProductOffer } from '../../../types/commerce';
jest.mock('../../../hooks/useWishlist', () => ({ useWishlist: () => ({ data: [] }), saveProductOffer: jest.fn(), unsaveProductEntry: jest.fn() }));
jest.mock('../../../components/primitives/Editorial', () => ({ ActionButton: 'ActionButton' }));
jest.mock('../../../components/shopping/ShoppingOutfitPreview', () => ({ ShoppingOutfitPreview: 'ShoppingOutfitPreview' }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => { const React = jest.requireActual('react'); return { __esModule: true, default: function MockPressable({ children, ...props }: any) { return React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children); } }; });
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path' }));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
const mockViewWishlist = jest.fn();
jest.mock('../../../contexts/WishlistNavigationContext', () => ({ WishlistNavigationContext: require('react').createContext((id: string) => mockViewWishlist(id)) }));
const offers = Array.from({ length: 6 }, (_, index) => ({ id: `serper:${index}`, provider: 'serper', title: `Linen shirt ${index}`, merchant: 'Shop', price: null, currency: 'CAD', formattedPrice: '', imageUrl: null, url: 'https://shop.example/item', brand: null, inStock: null, monetized: index === 5 })) as ProductOffer[];
const context = { reference: 'ref', targetKey: 'shirt', surface: 'guide' };
let renderer: TestRenderer.ReactTestRenderer;
function render(props: Partial<React.ComponentProps<typeof CuratedItemRail>> = {}) { act(() => { renderer = TestRenderer.create(<CuratedItemRail offers={offers} context={context} {...props} />); }); }
afterEach(() => { act(() => renderer?.unmount()); jest.clearAllMocks(); });
const text = () => renderer.root.findAllByType(Text).map((node) => node.props.children).join(' ');
test('preview remains mounted while the browser shows every supplied eligible piece', () => {
  render({ offers: [...offers, { ...offers[0], id: 'seventh' }] });
  expect(renderer.root.findAllByType(CuratedItemCard)).toHaveLength(3);
  expect(text()).not.toContain('earn a commission');
  const button = renderer.root.findAllByType(Pressable).find(node => node.findAllByType(Text).some(child => child.props.children === 'Explore all options'))!;
  act(() => button.props.onPress());
  const browser = renderer.root.findByType(CuratedProductBrowser);
  expect(browser.props.offers).toHaveLength(7);
  expect(browser.findAllByType(CuratedItemCard)).toHaveLength(7);
  expect(text()).toContain('earn a commission');
  expect(track).toHaveBeenCalledWith('curated_product_browser_opened', expect.objectContaining({ eligibleResultCount: 7 }));
  act(() => browser.props.onClose());
  expect(renderer.root.findAllByType(CuratedItemCard)).toHaveLength(3);
});
test('known out of stock pieces are excluded while unknown stock remains visible', () => {
  render({ offers: [{ ...offers[0], inStock: false }, offers[1]] }); expect(renderer.root.findAllByType(CuratedItemCard)).toHaveLength(1);
});
test('empty results show guidance instead of a loading skeleton', () => {
  render({ offers: [], status: 'empty' }); expect(text()).toContain('No suitable listings'); expect(renderer.root.findAllByProps({ accessibilityLabel: 'Finding considered pieces' })).toHaveLength(0);
});
test('a failed save preserves the card and allows a retry', async () => {
  (saveProductOffer as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'product' });
  render({ offers: [offers[0]] });
  await act(async () => { renderer.root.findByType(CuratedItemCard).props.onSave(); });
  expect(text()).toContain('Couldn’t save'); expect(renderer.root.findByType(CuratedItemCard).props.saving).toBe(false);
  await act(async () => { renderer.root.findByType(CuratedItemCard).props.onSave(); }); expect(saveProductOffer).toHaveBeenCalledTimes(2);
});

test('browser and preview share pending and saved state without duplicate saves', async () => {
  let resolve!: (value: unknown) => void;
  (saveProductOffer as jest.Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  render({ offers: [offers[0]] });
  act(() => renderer.root.findAllByType(Pressable).find(node => node.findAllByType(Text).some(child => child.props.children === 'Explore all options'))!.props.onPress());
  let cards = renderer.root.findAllByType(CuratedItemCard);
  act(() => { cards[0].props.onSave(); cards[1].props.onSave(); });
  expect(saveProductOffer).toHaveBeenCalledTimes(1);
  expect(renderer.root.findAllByType(CuratedItemCard).every(card => card.props.saving)).toBe(true);
  await act(async () => resolve({ id: 'saved' }));
  cards = renderer.root.findAllByType(CuratedItemCard);
  expect(cards.every(card => card.props.saved && !card.props.saving)).toBe(true);
});
test('external collection request opens browser while hiding duplicate action', () => {
  render({ offers: [offers[0]], collectionAction: 'external' });
  expect(text()).not.toContain('Explore all options');
  expect(text()).not.toContain('of');
  act(() => renderer.update(<CuratedItemRail offers={[offers[0]]} context={context} collectionAction="external" exploreRequest={1} />));
  expect(renderer.root.findByType(CuratedProductBrowser).props.offers).toHaveLength(1);
});
test('opening a filtered offer retains its original position for analytics', () => {
  render({ offers: [{ ...offers[0], inStock: false }, offers[1]] });
  act(() => renderer.root.findByType(CuratedItemCard).props.onOpen());
  expect(track).toHaveBeenCalledWith('curated_product_detail_viewed', expect.objectContaining({ position: 1 }));
  expect(track).not.toHaveBeenCalledWith('curated_product_opened', expect.anything());
  act(() => renderer.root.findByType(CuratedProductDetail).props.onRetailer());
  expect(track).toHaveBeenCalledWith('curated_product_opened', expect.objectContaining({ position: 1 }));
});

test('carousel omits counters before and after browsing', () => {
  render();
  expect(text()).not.toMatch(/\b\d+ of \d+\b/);
  act(() => renderer.root.findAllByType(Pressable).find(node => node.findAllByType(Text).some(child => child.props.children === 'Explore all options'))!.props.onPress());
  act(() => renderer.root.findByType(CuratedProductBrowser).props.onClose());
  expect(text()).not.toMatch(/\b\d+ of \d+\b/);
});
test.each(['empty', 'unavailable', 'disabled'] as const)('%s without offers never opens an empty collection', status => {
  render({ offers: [], status });
  expect(text()).not.toContain('Explore all options');
  expect(renderer.root.findAllByType(CuratedProductBrowser)).toHaveLength(0);
});

test('saved bookmark toggles off in both preview and browser, and can be saved again', async () => {
  (saveProductOffer as jest.Mock).mockResolvedValue({ id: 'product_saved' });
  (unsaveProductEntry as jest.Mock).mockResolvedValue(undefined);
  render({ offers: [offers[0]] });
  await act(async () => renderer.root.findByType(CuratedItemCard).props.onSave());
  act(() => renderer.root.findAllByType(Pressable).find(node => node.findAllByType(Text).some(child => child.props.children === 'Explore all options'))!.props.onPress());
  expect(renderer.root.findAllByType(CuratedItemCard).every(card => card.props.saved)).toBe(true);
  await act(async () => renderer.root.findByType(CuratedProductBrowser).findByType(CuratedItemCard).props.onSave());
  expect(unsaveProductEntry).toHaveBeenCalledWith('product_saved');
  expect(renderer.root.findAllByType(CuratedItemCard).every(card => !card.props.saved)).toBe(true);
  await act(async () => renderer.root.findByType(CuratedProductBrowser).findByType(CuratedItemCard).props.onSave());
  expect(saveProductOffer).toHaveBeenCalledTimes(2);
});
test('failed unsave keeps the saved state and allows retry', async () => {
  (saveProductOffer as jest.Mock).mockResolvedValue({ id: 'product_saved' });
  (unsaveProductEntry as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  render({ offers: [offers[0]] });
  await act(async () => renderer.root.findByType(CuratedItemCard).props.onSave());
  await act(async () => renderer.root.findByType(CuratedItemCard).props.onSave());
  expect(renderer.root.findByType(CuratedItemCard).props).toMatchObject({ saved: true, saveFailed: true, saving: false });
  expect(text()).toContain('Couldn’t unsave');
  await act(async () => renderer.root.findByType(CuratedItemCard).props.onSave());
  expect(renderer.root.findByType(CuratedItemCard).props.saved).toBe(false);
});

test('details preserve the collection and share save and unsave state', async () => {
  (saveProductOffer as jest.Mock).mockResolvedValue({ id: 'product_saved' });
  render({ offers: [offers[0]], reason: 'Works with tailoring.' });
  act(() => renderer.root.findAllByType(Pressable).find(node => node.findAllByType(Text).some(child => child.props.children === 'Explore all options'))!.props.onPress());
  const browser = renderer.root.findByType(CuratedProductBrowser);
  act(() => browser.findByType(CuratedItemCard).props.onOpen());
  expect(renderer.root.findByType(CuratedProductBrowser)).toBe(browser);
  expect(renderer.root.findByType(CuratedProductDetail).props).toMatchObject({ embedded: true, reason: 'Works with tailoring.' });
  await act(async () => renderer.root.findByType(CuratedProductDetail).props.onSave());
  expect(renderer.root.findByType(CuratedProductDetail).props.saved).toBe(true);
  expect(renderer.root.findAllByType(CuratedItemCard).every(card => card.props.saved)).toBe(true);
  await act(async () => renderer.root.findByType(CuratedProductDetail).props.onSave());
  expect(unsaveProductEntry).toHaveBeenCalledWith('product_saved');
  act(() => renderer.root.findByType(CuratedProductDetail).props.onClose());
  expect(renderer.root.findAllByType(CuratedProductDetail)).toHaveLength(0);
  expect(renderer.root.findByType(CuratedProductBrowser)).toBe(browser);
});

test('offers a link to the exact independently saved product', async () => {
  (saveProductOffer as jest.Mock).mockResolvedValueOnce({ id: 'saved-product' });
  render({ offers: [offers[0]] });
  await act(async () => { renderer.root.findByType(CuratedItemCard).props.onSave(); });
  const view = renderer.root.findAllByType(Pressable).find(node => node.props.accessibilityLabel === `View ${offers[0].title} in wishlist`)!;
  act(() => view.props.onPress());
  expect(mockViewWishlist).toHaveBeenCalledWith('saved-product');
});
