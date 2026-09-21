import { resolveShoppingPrice, resolveShoppingSnapPrices, shoppingPriceCandidates } from '../shoppingPrices';

const resolve = (text: string, country?: string) =>
  resolveShoppingPrice(shoppingPriceCandidates(text, country), country);

describe('shopping price recognition and selection', () => {
  it.each([
    ['$29.99', 29.99, null],
    ['$\n29.99', 29.99, null],
    ['CAD\n29.99', 29.99, 'CAD'],
    ['29,99\nEUR', 29.99, 'EUR'],
    ['€ 1.299,95', 1299.95, 'EUR'],
    ['CHF 1’299.95', 1299.95, 'CHF'],
    ['Price: 29.99', 29.99, null],
    ['PRICE\n29,99', 29.99, null],
    ['Price 29.99 CAD', 29.99, 'CAD'],
    ['CA$29.99', 29.99, 'CAD'],
    ['CAD $29.99', 29.99, 'CAD'],
    ['US\n$\n90', 90, 'USD'],
    ['CAN $ 112', 112, 'CAD'],
    ['UK £ 65', 65, 'GBP'],
    ['$0.00', 0, null],
    ['$1,299.00', 1299, null],
  ])('recognizes %s without losing the currency', (text, amount, currencyCode) => {
    expect(resolve(text)).toMatchObject({ amount, currencyCode, status: 'resolved' });
  });

  it.each([
    'SIZE 29\nSTYLE 12345678\n100% COTTON',
    '29.99',
    'SALE 30% OFF',
    'Price 30 % off',
    'SKU123USD',
    '$29.9999',
    'Price 123ABC',
    'PRICE -20',
    'Final Sale\n28',
  ])('does not invent prices from %s', (text) => {
    expect(resolve(text).status).toBe('missing');
  });

  it('deduplicates repeated amounts and selects a clearly labeled current price', () => {
    expect(resolve('Was £120\nNow £90\n£90')).toMatchObject({ amount: 90, currencyCode: 'GBP' });
    expect(resolve('ORIGINAL PRICE\nCAD 120\nSALE PRICE\nCAD 90', 'CA')).toMatchObject({ amount: 90 });
    expect(resolve('$29.99\n$29.99').candidates).toHaveLength(1);
    expect(resolve('$99\nFinal Sale\n28\nLM5AHOS BLK\n$128.\n000136300709'))
      .toMatchObject({ amount: 99, status: 'resolved' });
    expect(resolve('$99\nFinal Sale\n28\nLM5AHOS BLK\n$128.\n000136300709').candidates)
      .toHaveLength(2);
  });

  it('uses local currency before selecting the current price', () => {
    expect(resolve('Price 28', 'CA')).toMatchObject({ amount: 28, currencyCode: 'CAD', status: 'resolved' });
    expect(resolve('CAD $29.99', 'US')).toMatchObject({ amount: 29.99, currencyCode: 'CAD' });
    expect(resolve('USD 60\nCAD 90', 'CA')).toMatchObject({ amount: 90, currencyCode: 'CAD' });
    expect(resolve('SALE USD 40\nCAD 90', 'CA')).toMatchObject({ amount: 90, currencyCode: 'CAD' });
    expect(resolve('USD 60\nWas CAD 90\nNow CAD 75', 'CA')).toMatchObject({ amount: 75, currencyCode: 'CAD' });
  });

  it('prefills local currency even when OCR has no usable price', () => {
    expect(resolveShoppingPrice([], 'CA')).toMatchObject({ amount: null, currencyCode: 'CAD', status: 'missing' });
  });

  it.each([
    ['USD 60\nCAD 90', undefined],
    ['Sale USD 60\nCAD 90', undefined],
    ['USD 60\nCAD 90', 'GB'],
    ['Sale CAD 60\nSale CAD 90', 'CA'],
  ])('leaves conflicting prices unresolved: %s', (text, country) => {
    const result = resolve(text, country);
    expect(result.amount).toBeNull();
    expect(result.status).toBe('ambiguous');
    expect(result.currencyCode).toBe(country === 'CA' ? 'CAD' : country === 'GB' ? 'GBP' : null);
  });

  it('takes the lowest of several unlabeled prices on one tag as a markdown', () => {
    expect(resolve('$120\n$90', 'US')).toMatchObject({ amount: 90, currencyCode: 'USD', status: 'resolved', inferred: true });
    expect(resolve('UNIQLO\n$29.90\n2 for $50', 'US')).toMatchObject({ amount: 29.9, inferred: true });
    expect(resolve('$120\n$90', 'US').candidates).toHaveLength(2);
    // Different photos disagreeing is a real conflict, not a markdown.
    const split = [
      ...shoppingPriceCandidates('CAD 120', 'CA').map((candidate) => ({ ...candidate, sourceId: 'a' })),
      ...shoppingPriceCandidates('CAD 90', 'CA').map((candidate) => ({ ...candidate, sourceId: 'b' })),
    ];
    expect(resolveShoppingPrice(split, 'CA')).toMatchObject({ amount: null, status: 'ambiguous' });
  });

  it('reads symbol-less amounts on a tag with other content', () => {
    expect(resolve('H&M\n24.99\nSIZE S\n0123456789', 'US')).toMatchObject({ amount: 24.99, currencyCode: 'USD', status: 'resolved' });
    expect(resolve('49,95\nGR. 38', 'DE')).toMatchObject({ amount: 49.95, currencyCode: 'EUR' });
    expect(resolve('BOUTIQUE\n1.299,00\nStyle 4432', 'DE')).toMatchObject({ amount: 1299 });
    expect(resolve('29.99').status).toBe('missing');
    expect(resolve('SIZE 29\n100% COTTON\n12345678').status).toBe('missing');
    // A symbol price wins; a bare decimal never joins it as a second candidate.
    expect(resolve('$49.99\n30% OFF\n12.50', 'US')).toMatchObject({ amount: 49.99, status: 'resolved' });
  });

  it('falls back to the home currency when the photo has no location', () => {
    const home = (text: string, currency: string) => resolveShoppingPrice(shoppingPriceCandidates(text, null, currency), null, undefined, currency);
    expect(home('$148', 'USD')).toMatchObject({ amount: 148, currencyCode: 'USD', status: 'resolved' });
    expect(home('$148', 'EUR')).toMatchObject({ amount: 148, currencyCode: null });
    expect(home('US $90\nCAN $112\nUK £65', 'CAD')).toMatchObject({ amount: 112, currencyCode: 'CAD' });
    expect(home('Price 28', 'GBP')).toMatchObject({ amount: 28, currencyCode: 'GBP' });
    expect(resolveShoppingPrice([], null, undefined, 'GBP')).toMatchObject({ amount: null, currencyCode: 'GBP', status: 'missing' });
  });

  it('preserves a manual correction including zero', () => {
    expect(resolveShoppingPrice(shoppingPriceCandidates('USD 60 CAD 90'), 'CA', { amount: 0, currencyCode: 'EUR' }))
      .toMatchObject({ amount: 0, currencyCode: 'EUR', status: 'resolved' });
  });

  it('recognizes regional labels from an affected saved tag', () => {
    // Apple Vision flattened this tag's multi-column layout into this order.
    const text = 'UK £ EU € 65 80 US $ 90 CAN $ 112';
    expect(resolve(text, 'CA')).toMatchObject({ amount: 112, currencyCode: 'CAD' });
    expect(resolve(text, 'US')).toMatchObject({ amount: 90, currencyCode: 'USD' });
    expect(resolve(text)).toMatchObject({ amount: null, status: 'ambiguous' });
    expect(resolve(text).candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ amount: 90, currencyCode: 'USD' }),
      expect.objectContaining({ amount: 112, currencyCode: 'CAD' }),
    ]));
  });

  it('uses tag geodata before a garment cover photo geodata', () => {
    const snap = (overrides: Record<string, unknown>) => ({
      id: 'snap', captureRole: 'garment', countryCode: null, extractedPrice: null,
      priceOverride: null, currencyCode: null, rawOcrText: '', ...overrides,
    }) as any;
    expect(resolveShoppingSnapPrices([
      snap({ id: 'garment', captureRole: 'garment', countryCode: 'US' }),
      snap({ id: 'tag', captureRole: 'tag', countryCode: 'CA', rawOcrText: 'Price 29' }),
    ])).toMatchObject({ amount: 29, currencyCode: 'CAD', status: 'resolved' });
  });

  it('does not borrow a garment currency when the tag has no location', () => {
    const snap = (overrides: Record<string, unknown>) => ({
      id: 'snap', captureRole: 'garment', countryCode: null, extractedPrice: null,
      priceOverride: null, currencyCode: null, rawOcrText: '', ...overrides,
    }) as any;
    expect(resolveShoppingSnapPrices([
      snap({ id: 'garment', captureRole: 'garment', countryCode: 'US' }),
      snap({ id: 'tag', captureRole: 'tag', rawOcrText: '$29' }),
    ])).toMatchObject({ amount: 29, currencyCode: null, status: 'resolved' });
  });
});
