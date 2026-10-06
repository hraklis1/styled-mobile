import { productCardTitle, productDisplayTitle, productMerchantLabel, productListingAction } from '../productPresentation';
import type { ProductOffer } from '../../types/commerce';
test.each([['muji.ca', 'muji'], ['www.example.com', 'example'], ['https://www.example.co.uk/', 'example'], ['Marks & Spencer - Canada', 'Marks & Spencer - Canada'], ['Studio.xyz', 'Studio.xyz']])('merchant %s becomes %s conservatively', (input, output) => expect(productMerchantLabel(input)).toBe(output));
test('only exact leading brand repetition is removed without losing garment attributes', () => {
  expect(productDisplayTitle({ brand: 'Calvin Klein', title: "Calvin Klein Men's Tech Shell Hooded Jacket" })).toBe("Men's Tech Shell Hooded Jacket");
  expect(productDisplayTitle({ brand: 'COS', title: 'COSMIC cotton shirt' })).toBe('COSMIC cotton shirt');
  expect(productDisplayTitle({ brand: null, title: 'MUJI Rain Jacket' })).toBe('MUJI Rain Jacket');
  expect(productDisplayTitle({ brand: 'MUJI', title: 'MUJI' })).toBe('MUJI');
});
test('direct retailer and Google listing actions remain distinct', () => {
  const offer = { merchant: 'muji.ca', url: 'https://muji.ca/jacket' } as ProductOffer;
  expect(productListingAction(offer)).toBe('Shop at muji');
  expect(productListingAction({ ...offer, url: 'https://www.google.ca/shopping/item' })).toBe('View listing');
  expect(productListingAction({ ...offer, url: 'broken' })).toBe('View listing');
});

test('leading brand cleanup is case-insensitive and preserves sizes and model information', () => {
  expect(productDisplayTitle({ brand: 'Polo Ralph Lauren', title: 'POLO RALPH LAUREN — Masters Court leather sneaker size 10' })).toBe('Masters Court leather sneaker size 10');
  expect(productDisplayTitle({ brand: 'COS', title: 'cosmic wool trousers 31L' })).toBe('cosmic wool trousers 31L');
  expect(productDisplayTitle({ brand: 'Next', title: 'Mens Next Green Tailored Fit Twill Suit Trousers 31L' })).toBe('Mens Next Green Tailored Fit Twill Suit Trousers 31L');
});

test('card titles drop gender departments and trailing sizes but never empty a title', () => {
  expect(productCardTitle({ brand: 'Next', title: 'Mens Next Green Tailored Fit Twill Suit Trousers 31L' })).toBe('Next Green Tailored Fit Twill Suit Trousers');
  expect(productCardTitle({ brand: null, title: "Women's wool coat size M" })).toBe('Wool coat');
  expect(productCardTitle({ brand: null, title: 'Chino W32 L30' })).toBe('Chino');
  expect(productCardTitle({ brand: null, title: 'Men' })).toBe('Men');
  expect(productCardTitle({ brand: null, title: 'Mensa graphic tee' })).toBe('Mensa graphic tee');
});
