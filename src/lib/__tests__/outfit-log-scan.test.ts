import { mergeUniqueItemIds, normalizeScanCategory } from '../outfit-log-scan';

// The scan review itself is covered by src/features/wear-log/__tests__.
describe('outfit log scan helpers', () => {
  it('normalizes unsupported categories to top', () => {
    expect(normalizeScanCategory('shoes')).toBe('shoes');
    expect(normalizeScanCategory('shirt')).toBe('top');
    expect(normalizeScanCategory(undefined)).toBe('top');
  });

  it('deduplicates existing and newly-created selections', () => {
    expect(mergeUniqueItemIds([1, 2], [2, 3, 3])).toEqual([1, 2, 3]);
  });
});
