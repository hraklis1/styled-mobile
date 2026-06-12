import { getOutfitCategoryPriority, getOutfitMosaicRects } from '../outfitMosaic';

describe('outfit mosaic layouts', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])(
    'creates one tile per visible item for %i items',
    (count) => {
      expect(getOutfitMosaicRects(count)).toHaveLength(count);
    },
  );

  it('caps the visible mosaic at nine tiles', () => {
    expect(getOutfitMosaicRects(12)).toHaveLength(9);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
    'fills the canvas without overlaps for %i items',
    (count) => {
      const rects = getOutfitMosaicRects(count);
      const totalArea = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);

      expect(totalArea).toBeCloseTo(1);
      for (const rect of rects) {
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.top).toBeGreaterThanOrEqual(0);
        expect(rect.left + rect.width).toBeLessThanOrEqual(1);
        expect(rect.top + rect.height).toBeLessThanOrEqual(1);
      }
    },
  );

  it('gives the leading item visual priority in three- and five-item outfits', () => {
    const three = getOutfitMosaicRects(3);
    const five = getOutfitMosaicRects(5);

    expect(three[0].width * three[0].height).toBeGreaterThan(three[1].width * three[1].height);
    expect(five[0].width * five[0].height).toBeGreaterThan(five[1].width * five[1].height);
  });

  it('orders outfit categories into a predictable visual hierarchy', () => {
    const categories = ['accessory', 'shoes', 'top', 'bottom', 'outerwear', 'full_body'] as const;

    expect([...categories].sort((a, b) => getOutfitCategoryPriority(a) - getOutfitCategoryPriority(b))).toEqual([
      'full_body',
      'top',
      'outerwear',
      'bottom',
      'shoes',
      'accessory',
    ]);
    expect(getOutfitCategoryPriority(null)).toBe(Number.MAX_SAFE_INTEGER);
  });
});
