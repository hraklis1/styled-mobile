import { classifyShoppingCapture } from '../classifyShoppingCapture';

describe('classifyShoppingCapture', () => {
  it('recognizes price tags from an extracted price', () => {
    expect(classifyShoppingCapture('LULULEMON\n$128.00\nSIZE M', 128)).toBe('tag');
  });

  it('recognizes SKU-heavy tags without a currency symbol', () => {
    expect(classifyShoppingCapture('STYLE W5DEPS\nSIZE 6\nCOLOR BLACK\n12345678', null)).toBe('tag');
  });

  it('treats an image with little or no OCR as a garment photo', () => {
    expect(classifyShoppingCapture('', null)).toBe('garment');
    expect(classifyShoppingCapture('LOVE', null)).toBe('garment');
  });
});
