import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { StylistLookResponseCard } from '../StylistLookResponseCard';
import type { Item } from '../../../types/item';

jest.mock('../../../lib/itemImage', () => ({ itemImageUri: () => undefined, itemImageContentFit: () => 'contain' }));
jest.mock('../StylistRichText', () => ({ StylistRichText: 'StylistRichText' }));
jest.mock('../GapCard', () => ({ GapCard: 'GapCard', humanizeGeneratedCopy: (value: string) => value.charAt(0).toUpperCase() + value.slice(1) }));
jest.mock('../Reveal', () => ({ Reveal: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../ChatItemDetailSheet', () => ({ ItemDetailSheet: () => null }));
jest.mock('../../primitives/PressableScale', () => {
  const { TouchableOpacity } = jest.requireActual('react-native');
  return { PressableScale: ({ contentStyle: _c, scaleTo: _s, ...props }: any) => <TouchableOpacity {...props} /> };
});
jest.mock('../../outfits/ResolvedOutfitCollage', () => ({ ResolvedOutfitCollage: 'ResolvedOutfitCollage' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../../lib/haptics', () => ({ notificationAsync: jest.fn().mockResolvedValue(undefined), NotificationFeedbackType: { Success: 'success' } }));

const owned = { id: 1, name: 'Owned shirt', category: 'top' } as Item;
let renderer: TestRenderer.ReactTestRenderer;
const action = (label: string) => renderer.root.findAllByType(TouchableOpacity).find(node => node.findAllByType(Text).some(text => text.props.children === label))!;
afterEach(() => act(() => renderer?.unmount()));

it('saves an owned wardrobe outfit and opens its Closet record', async () => {
  const create = jest.fn().mockResolvedValue({ id: 42 }), view = jest.fn();
  act(() => { renderer = TestRenderer.create(<StylistLookResponseCard status="ready" messageText="A useful outfit" itemIds={[1]} allItems={[owned]} createOutfit={{ mutateAsync: create }} onNavigateToCloset={view} />); });
  await act(async () => action('Save outfit').props.onPress());
  expect(create.mock.calls[0][0].itemIds).toEqual([{ id: 1, category: 'top' }]);
  act(() => action('View outfit').props.onPress());
  expect(view).toHaveBeenCalledWith(42);
});

it('saves only owned foundation pieces when a recommendation includes an unowned addition', async () => {
  const create = jest.fn().mockResolvedValue({ id: 43 });
  act(() => { renderer = TestRenderer.create(<StylistLookResponseCard status="incomplete" messageText="Add a jacket" itemIds={[1, 999]} foundationItemIds={[1, 999]} allItems={[owned]} missingEssentials={[{ label: 'Jacket', category: 'outerwear', priority: 1 } as any]} createOutfit={{ mutateAsync: create }} />); });
  await act(async () => action('Save foundation').props.onPress());
  expect(create.mock.calls[0][0].itemIds).toEqual([{ id: 1, category: 'top' }]);
  expect(create.mock.calls[0][0].isDraft).toBe(true);
});

it('keeps a failed wardrobe save retryable and offers View outfit only after success', async () => {
  const create = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 44 });
  act(() => { renderer = TestRenderer.create(<StylistLookResponseCard status="ready" messageText="A useful outfit" itemIds={[1]} allItems={[owned]} createOutfit={{ mutateAsync: create }} onNavigateToCloset={jest.fn()} />); });
  await act(async () => action('Save outfit').props.onPress());
  expect(action('View outfit')).toBeUndefined();
  expect(action('Save outfit').props.disabled).toBe(false);
  await act(async () => action('Save outfit').props.onPress());
  expect(action('View outfit')).toBeDefined();
});

const texts = () => renderer.root.findAllByType(Text).map(node => [].concat(node.props.children).join(''));

it('reads as one foundation: title, meta line, no ledger, and no summary Find for a single gap', () => {
  act(() => { renderer = TestRenderer.create(<StylistLookResponseCard status="incomplete" messageText={'Rationale\n\nMissing: shoes'} rationale="Rationale" lookName="Quiet Neutrals" itemIds={[1]} foundationItemIds={[1]} allItems={[owned]} missingEssentials={[{ label: 'Shoes', category: 'shoes', reason: 'wardrobe_gap', context: 'to finish the look', priority: 1 } as any]} onNavigateToShop={jest.fn()} createOutfit={{ mutateAsync: jest.fn() }} />); });
  const all = texts();
  expect(all).toContain('Quiet Neutrals');
  expect(all).toContain('1 piece from your wardrobe · needs shoes');
  expect(all.some(text => /what already works/i.test(text))).toBe(false);
  expect(all.some(text => /missing pieces/i.test(text))).toBe(false);
  // The rationale alone is the body; requirement lines live only in gap rows.
  expect(renderer.root.findByType('StylistRichText' as any).props.text).toBe('Rationale');
});

it('offers one summary Find when several pieces are missing', () => {
  const gaps = [{ label: 'Shoes', category: 'shoes', priority: 1 }, { label: 'Rain layer', category: 'outerwear', priority: 2 }] as any;
  act(() => { renderer = TestRenderer.create(<StylistLookResponseCard status="incomplete" messageText="Text" itemIds={[1]} allItems={[owned]} missingEssentials={gaps} onNavigateToShop={jest.fn()} createOutfit={{ mutateAsync: jest.fn() }} />); });
  expect(texts()).toContain('Find 2 missing pieces');
  expect(texts()).toContain('1 piece from your wardrobe · needs shoes and rain layer');
});

it('shows a weather add-on look as wearable and saves it as a finished outfit', async () => {
  const create = jest.fn().mockResolvedValue({ id: 45 });
  act(() => { renderer = TestRenderer.create(<StylistLookResponseCard status="incomplete" completion="weather_layer" messageText="Text" itemIds={[1]} foundationItemIds={[1]} allItems={[owned]} missingEssentials={[{ label: 'Rain layer', category: 'outerwear', reason: 'weather', context: "for today's rain", priority: 1 } as any]} createOutfit={{ mutateAsync: create }} />); });
  const all = texts();
  expect(all).toContain('The look');
  expect(all).toContain("From your wardrobe · add a rain layer if you're out in it");
  expect(all.some(text => /foundation/i.test(text))).toBe(false);
  await act(async () => action('Save outfit').props.onPress());
  expect(create.mock.calls[0][0].isDraft).toBe(false);
});
