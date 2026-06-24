jest.mock('expo-text-extractor', () => ({
  extractTextFromImage: jest.fn(),
  isSupported: true,
}));

import { extractPriceFromText, PRICE_REGEX } from '../processLocalOCR';

describe('processLocalOCR price parsing', () => {
  it('uses the expected dollar-price pattern', () => {
    expect('$ 29.99'.match(PRICE_REGEX)?.[0]).toBe('$ 29.99');
  });

  it.each([
    ['SALE\n$19.99\nFINAL', 19.99],
    ['Price: $ 8', 8],
    ['TOTAL $1,299.00', 1299],
  ])('extracts a price from %s', (text, expected) => {
    expect(extractPriceFromText(text)).toBe(expected);
  });

  it('returns null when OCR text has no dollar price', () => {
    expect(extractPriceFromText('STYLE 1234\nSIZE M')).toBeNull();
  });
});
