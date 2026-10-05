import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { StylistLookResponseCard } from '../StylistLookResponseCard';
import type { Item } from '../../../types/item';

jest.mock('../../../lib/itemImage', () => ({ itemImageUri: () => undefined, itemImageContentFit: () => 'contain' }));
jest.mock('../StylistRichText', () => ({ StylistRichText: 'StylistRichText' }));
jest.mock('../GapCard', () => ({ GapCard: 'GapCard' }));
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
