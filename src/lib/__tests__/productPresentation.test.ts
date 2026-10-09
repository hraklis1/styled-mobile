import { priceFitsBudget, productCardTitle, productDisplayTitle, productMerchantLabel, productListingAction } from '../productPresentation';
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
  expect(productCardTitle({ brand: 'Next', title: 'Mens Next Green Tailored Fit Twill Suit Trousers 31L' })).toBe('Green Tailored Fit Twill Suit Trousers');
  expect(productCardTitle({ brand: null, title: "Women's wool coat size M" })).toBe('Wool coat');
  expect(productCardTitle({ brand: null, title: 'Chino W32 L30' })).toBe('Chino');
  expect(productCardTitle({ brand: null, title: 'Men' })).toBe('Men');
  expect(productCardTitle({ brand: null, title: 'Mensa graphic tee' })).toBe('Mensa graphic tee');
});

test('a leading merchant name is removed when the listing has no brand', () => {
  expect(productDisplayTitle({ brand: null, merchant: 'H&M', title: 'H&M Black Slim-Fit Tailored Twill Pants' })).toBe('Black Slim-Fit Tailored Twill Pants');
  expect(productDisplayTitle({ brand: null, merchant: 'muji.ca', title: 'MUJI Rain Jacket' })).toBe('Rain Jacket');
  expect(productDisplayTitle({ brand: null, merchant: 'COS', title: 'COSMIC cotton shirt' })).toBe('COSMIC cotton shirt');
  expect(productDisplayTitle({ brand: 'Uniqlo', merchant: 'Uniqlo', title: 'Uniqlo' })).toBe('Uniqlo');
  expect(productDisplayTitle({ brand: 'H&M', title: 'H＆M Black Slim-Fit Pants' })).toBe('Black Slim-Fit Pants');
  expect(productDisplayTitle({ brand: 'H&M', title: 'H\u200b&M Black Slim-Fit Pants' })).toBe('Black Slim-Fit Pants');
  expect(productDisplayTitle({ brand: 'H&M', title: 'H & M Black Slim-Fit Pants' })).toBe('Black Slim-Fit Pants');
  expect(productDisplayTitle({ brand: 'H&M', title: '\u200e H&M Black Slim-Fit Pants' })).toBe('Black Slim-Fit Pants');
  expect(productDisplayTitle({ brand: 'COS', title: '“COS” cotton shirt' })).toBe('“COS” cotton shirt');
});

test('budget fit is only claimed when currency and range are both readable', () => {
  expect(priceFitsBudget({ price: 84.99, currency: 'CAD' }, '$80–180 CAD')).toBe(true);
  expect(priceFitsBudget({ price: 220, currency: 'CAD' }, '$80–180 CAD')).toBe(false);
  expect(priceFitsBudget({ price: 1200, currency: 'CAD' }, '$1,000-1,500 CAD')).toBe(true);
  expect(priceFitsBudget({ price: 40, currency: 'CAD' }, '$80–180 CAD')).toBeNull();
  expect(priceFitsBudget({ price: 84.99, currency: 'USD' }, '$80–180 CAD')).toBeNull();
  expect(priceFitsBudget({ price: 84.99, currency: 'CAD' }, 'Around $100')).toBeNull();
  expect(priceFitsBudget({ price: null, currency: 'CAD' }, '$80–180 CAD')).toBeNull();
});

test('a brand behind a department word is removed from card titles', () => {
  expect(productCardTitle({ brand: null, merchant: 'H&M', title: 'Men H&M Black Slim-Fit Tailored Twill Pants' })).toBe('Black Slim-Fit Tailored Twill Pants');
  expect(productCardTitle({ brand: 'Next', title: "Men's Next Chino" })).toBe('Chino');
});
