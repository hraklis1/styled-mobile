import {
  filterBrandSuggestions,
  nextUnreviewedPieceId,
  reviewCarouselIndex,
  reviewCarouselMetrics,
  reviewHeroHeight,
  resolveExtractedIdentity,
  resolvedActivePieceId,
  scanReviewPrimaryAction,
  scanReviewPrimaryLabel,
} from '../scan-review';

describe('scan review helpers', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];

  it('extracts immediately for a single piece', () => {
    expect(scanReviewPrimaryAction(['a'], new Set(), 'a')).toBe('extract');
    expect(scanReviewPrimaryLabel(['a'], new Set(), 'a')).toBe('Extract details');
  });

  it('guides a multi-piece review before the batch action', () => {
    expect(scanReviewPrimaryLabel(ids, new Set(), 'a')).toBe('Next piece');
    expect(scanReviewPrimaryLabel(ids, new Set(['a']), 'a')).toBe('Next unreviewed piece');
    expect(scanReviewPrimaryLabel(ids, new Set(['a', 'b', 'c', 'd']), 'e'))
      .toBe('Extract details for all 5');
  });

  it('wraps to the next unreviewed piece', () => {
    expect(nextUnreviewedPieceId(ids, new Set(['a', 'b', 'e']), 'e')).toBe('c');
    expect(nextUnreviewedPieceId(ids, new Set(ids), 'c')).toBeNull();
  });

  it('keeps a valid active id and falls back after removal', () => {
    expect(resolvedActivePieceId(ids, 'c')).toBe('c');
    expect(resolvedActivePieceId(['a', 'b'], 'c')).toBe('a');
    expect(resolvedActivePieceId([], 'c')).toBeNull();
  });

  it('scales the batch label beyond the common five-piece case', () => {
    const many = Array.from({ length: 12 }, (_, index) => String(index));
    const reviewed = new Set(many.slice(0, 11));
    expect(scanReviewPrimaryLabel(many, reviewed, '11')).toBe('Extract details for all 12');
  });

  it('keeps explicit name and brand corrections authoritative after extraction', () => {
    expect(resolveExtractedIdentity({
      initialName: 'Blue crew-neck tee',
      nameEdited: true,
      brandHint: '  Kotn  ',
      extractedName: 'Blue T-Shirt',
      extractedBrand: 'Other Brand',
    })).toEqual({ name: 'Blue crew-neck tee', brand: 'Kotn' });
  });

  it('uses enriched identity when the user did not supply a correction', () => {
    expect(resolveExtractedIdentity({
      initialName: 'Blue top',
      nameEdited: false,
      brandHint: '',
      extractedName: 'Light Blue Cotton T-Shirt',
      extractedBrand: 'Known Brand',
    })).toEqual({ name: 'Light Blue Cotton T-Shirt', brand: 'Known Brand' });
  });

  it('reserves a subtle next-card peek and snaps to the nearest piece', () => {
    const metrics = reviewCarouselMetrics(390);
    expect(metrics).toEqual({ cardWidth: 326, gap: 12, sidePadding: 24, snapInterval: 338 });
    expect(reviewCarouselIndex(0, metrics.snapInterval, 5)).toBe(0);
    expect(reviewCarouselIndex(350, metrics.snapInterval, 5)).toBe(1);
    expect(reviewCarouselIndex(9999, metrics.snapInterval, 5)).toBe(4);
  });

  it('keeps hero height stable per viewport and within compact editorial bounds', () => {
    expect(reviewHeroHeight(667)).toBe(248);
    expect(reviewHeroHeight(852)).toBe(264);
    expect(reviewHeroHeight(1200)).toBe(318);
  });

  it('filters brands with prefix matches first and removes duplicates', () => {
    expect(filterBrandSuggestions(['COS', 'Acne Studios', 'cos', 'Lacoste'], 'co'))
      .toEqual(['COS', 'Lacoste']);
    expect(filterBrandSuggestions(['Zara', 'COS'], '')).toEqual(['Zara', 'COS']);
  });
});
