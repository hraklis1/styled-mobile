jest.mock('../api', () => ({ api: {} }));
jest.mock('../analytics', () => ({ track: jest.fn() }));
import { createProductFeedbackStore } from '../productFeedback';
import type { OfferContext, ProductOffer } from '../../types/commerce';

const offer = { id: 'serper:1', title: 'Jacket' } as ProductOffer;
const context: OfferContext = { reference: 'a'.repeat(32), targetKey: 't1', surface: 'shopping_guide' };

function setup() {
  const post = jest.fn().mockResolvedValue({ data: { productKey: 'k'.repeat(32) } });
  const del = jest.fn().mockResolvedValue({});
  return { post, del, store: createProductFeedbackStore({ post, delete: del } as any) };
}

test('hide posts immediately, reason follows the first write, undo deletes by server key', async () => {
  const { post, del, store } = setup();
  store.hide(offer, context);
  store.hide(offer, context);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0][1]).toEqual({ reference: context.reference, targetKey: 't1', offerId: 'serper:1' });
  store.setReason(offer, context, 'too_expensive');
  expect(store.getSnapshot().get(offer.id)?.reason).toBe('too_expensive');
  await store.undo(offer.id);
  expect(post).toHaveBeenCalledTimes(2);
  expect(post.mock.calls[1][1]).toMatchObject({ reason: 'too_expensive' });
  expect(del).toHaveBeenCalledWith(`/api/shop/product-feedback/${'k'.repeat(32)}`);
  expect(store.getSnapshot().size).toBe(0);
});

test('a failed write still hides locally and undo skips the delete', async () => {
  const { post, del, store } = setup();
  post.mockRejectedValueOnce(new Error('offline'));
  store.hide(offer, context);
  expect(store.getSnapshot().has(offer.id)).toBe(true);
  await store.undo(offer.id);
  expect(del).not.toHaveBeenCalled();
});

test('only guides with a server reference can hide', () => {
  const { store } = setup();
  expect(store.canHide(context)).toBe(true);
  expect(store.canHide({ targetKey: 't', surface: 'shopping_guide' })).toBe(false);
});
