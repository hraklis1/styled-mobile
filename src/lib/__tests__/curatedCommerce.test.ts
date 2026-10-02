import { listingAction, offerImageCachePolicy, parseOfferResult, parseProductOffers, type ProductOffer } from '../../types/commerce';
import { withoutInlineImages, type ShoppingPriorityEdit } from '../shoppingPriorityEdit';
const offer: ProductOffer = { id: 'serper:1', provider: 'serper', title: 'Linen shirt', merchant: 'Shop', brand: null, price: 80, currency: 'CAD', formattedPrice: 'CA$80.00', imageUrl: 'https://example.com/image.jpg', url: 'https://www.google.com/shopping/product/1', inStock: null, monetized: false };
test('Serper identity and unknown availability survive parsing', () => {
  expect(parseProductOffers([offer, { ...offer, url: 'http://example.com' }, { ...offer, title: '' }])).toHaveLength(1);
  expect(parseProductOffers([offer])[0]).toMatchObject({ provider: 'serper', inStock: null, imagePolicy: 'hotlink' });
});
test('an empty result is settled and malformed states degrade safely', () => {
  expect(parseOfferResult({ status: 'empty', offers: [] }).status).toBe('empty');
  expect(parseOfferResult({ status: 'pending', offers: [] }).status).toBe('pending');
  expect(parseOfferResult(null).status).toBe('unavailable');
});
test('hotlink sources use memory and aggregator destinations say listing', () => {
  expect(offerImageCachePolicy(offer)).toBe('memory');
  expect(offerImageCachePolicy({ ...offer, imagePolicy: 'licensed' })).toBe('memory-disk');
  expect(listingAction(offer)).toBe('View listing');
  expect(listingAction({ ...offer, url: 'https://shop.example/item/1' })).toBe('View at Shop');
});
test('saved guides omit pending state and every inline image snapshot', () => {
  const edit = { targets: [{ key: 'shirt', offers: [{ ...offer, imageUrl: 'data:image/png;base64,AAAA' }], offerState: { status: 'pending', offers: [offer] } }], offersPending: true } as unknown as ShoppingPriorityEdit;
  const saved = withoutInlineImages(edit);
  expect(saved.offersPending).toBeUndefined();
  expect(saved.targets[0].offerState).toBeUndefined();
  expect(saved.targets[0].offers?.[0].imageUrl).toBeNull();
});
