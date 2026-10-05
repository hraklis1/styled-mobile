import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { ShopOutfitCard } from '../ShopOutfitCard';
import type { ShopOutfit } from '../../../types/shop';

jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => { const React = jest.requireActual('react'); return { __esModule: true, default: function MockPressable({ children, ...props }: any) { return React.createElement('Pressable', props, children); } }; });

jest.mock('../../../hooks/useProductOffers', () => ({ useProductOffers: () => ({ data: {}, refetch: jest.fn() }) }));
jest.mock('../../shopping/CuratedItemRail', () => ({ CuratedItemRail: 'CuratedItemRail' }));
jest.mock('../../shopping/ShoppingRetailerLinks', () => ({ openShoppingLink: jest.fn() }));
const outfit = { intro: 'A useful jacket', recommendationType: 'piece', items: [], totalBudget: '' } as unknown as ShopOutfit;
let renderer: TestRenderer.ReactTestRenderer;
function action(label: string) {
  return renderer.root.findAllByType(Pressable).find(node => node.findAllByType(Text).some(text => text.props.children === label))!;
}
afterEach(() => act(() => renderer?.unmount()));

it('reveals independent saved and Board actions only after a successful save', async () => {
  const save = jest.fn().mockResolvedValue(undefined), viewSaved = jest.fn(), board = jest.fn();
  act(() => { renderer = TestRenderer.create(<ShopOutfitCard outfit={outfit} onSave={save} onViewSaved={viewSaved} onSaveToBoard={board} />); });
  expect(action('View saved')).toBeUndefined();
  await act(async () => action('Save this piece').props.onPress());
  expect(save).toHaveBeenCalledTimes(1);
  expect(board).not.toHaveBeenCalled();
  expect(viewSaved).not.toHaveBeenCalled();
  act(() => action('View saved').props.onPress());
  expect(viewSaved).toHaveBeenCalledTimes(1);
  expect(board).not.toHaveBeenCalled();
  act(() => action('Add to board').props.onPress());
  expect(board).toHaveBeenCalledTimes(1);
});

it('leaves a failed save retryable without offering a nonexistent saved entry', async () => {
  const save = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  act(() => { renderer = TestRenderer.create(<ShopOutfitCard outfit={outfit} onSave={save} onViewSaved={jest.fn()} />); });
  await act(async () => action('Save this piece').props.onPress());
  expect(action('View saved')).toBeUndefined();
  expect(action('Save this piece').props.disabled).toBe(false);
  await act(async () => action('Save this piece').props.onPress());
  expect(action('View saved')).toBeDefined();
});
