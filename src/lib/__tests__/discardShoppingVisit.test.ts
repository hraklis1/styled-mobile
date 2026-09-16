jest.mock('../../stores/useShoppingSessionStore', () => ({
  useShoppingSessionStore: { getState: jest.fn() },
}));
jest.mock('../deleteShoppingSnaps', () => ({ deleteShoppingSnaps: jest.fn() }));
jest.mock('../shoppingPreviews', () => ({ deleteShoppingPreview: jest.fn() }));

import { useShoppingSessionStore, type ShoppingVisitPreview } from '../../stores/useShoppingSessionStore';
import type { ShoppingSnap } from '../../types/shoppingSnap';
import { deleteShoppingSnaps } from '../deleteShoppingSnaps';
import { deleteShoppingPreview } from '../shoppingPreviews';
import { discardShoppingVisit } from '../discardShoppingVisit';

const pending = { id: 'pending', shoppingSessionId: 'visit', syncStatus: 'pending', previewUri: 'pending.jpg' } as ShoppingVisitPreview;
const synced = { id: 'synced', shoppingSessionId: 'visit', syncStatus: 'synced', previewUri: 'synced.jpg' } as ShoppingVisitPreview;
const unrelated = { id: 'other', shoppingSessionId: 'other-visit', syncStatus: 'synced', previewUri: 'other.jpg' } as ShoppingVisitPreview;
const restore = jest.fn();
const toSnap = (preview: ShoppingVisitPreview) => ({ id: preview.id, syncStatus: preview.syncStatus }) as ShoppingSnap;

beforeEach(() => {
  jest.resetAllMocks();
  (useShoppingSessionStore.getState as jest.Mock).mockReturnValue({
    visitPreviews: [pending, synced, unrelated], recordVisitPreview: restore,
  });
  (deleteShoppingSnaps as jest.Mock).mockResolvedValue(undefined);
});

it('discards only the current visit using the latest backup status', async () => {
  await discardShoppingVisit('visit', 'user', toSnap);
  expect(deleteShoppingSnaps).toHaveBeenCalledWith([
    { id: 'pending', syncStatus: 'pending' },
    { id: 'synced', syncStatus: 'synced' },
  ], 'user');
  expect(deleteShoppingPreview).toHaveBeenCalledTimes(2);
  expect(deleteShoppingPreview).not.toHaveBeenCalledWith('other.jpg');
  expect(restore).not.toHaveBeenCalled();
});

it('retains remote photos for retry when deletion fails without resurrecting canceled uploads', async () => {
  (deleteShoppingSnaps as jest.Mock).mockRejectedValue(new Error('offline'));
  await expect(discardShoppingVisit('visit', 'user', toSnap)).rejects.toThrow('offline');
  expect(restore).toHaveBeenCalledTimes(1);
  expect(restore).toHaveBeenCalledWith(synced);
  expect(deleteShoppingPreview).not.toHaveBeenCalled();
});

it('does not touch another visit when the requested visit has no photos', async () => {
  await discardShoppingVisit('empty', null, toSnap);
  expect(deleteShoppingSnaps).toHaveBeenCalledWith([], null);
  expect(deleteShoppingPreview).not.toHaveBeenCalled();
});
