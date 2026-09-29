import {
  contactSheetColumns,
  filterBrandSuggestions,
  loupeHeroHeight,
  nextFlaggedPieceId,
  pieceFlags,
  pieceReviewState,
  reviewCarouselIndex,
  reviewCarouselMetrics,
  resolveExtractedIdentity,
  resolvedActivePieceId,
  reviewSummary,
  reviewSummaryLabel,
  scrubberIndex,
  sheetGuidance,
  usesContactSheet,
  type PieceReviewState,
} from '../scan-review';

describe('scan review helpers', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];

  it('keeps a valid active id and falls back after removal', () => {
    expect(resolvedActivePieceId(ids, 'c')).toBe('c');
    expect(resolvedActivePieceId(['a', 'b'], 'c')).toBe('a');
    expect(resolvedActivePieceId([], 'c')).toBeNull();
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

  it('keeps the loupe hero near 40% of the screen within editorial bounds', () => {
    expect(loupeHeroHeight(667)).toBe(280);
    expect(loupeHeroHeight(852)).toBe(341);
    expect(loupeHeroHeight(1200)).toBe(380);
  });

  it('filters brands with prefix matches first and removes duplicates', () => {
    expect(filterBrandSuggestions(['COS', 'Acne Studios', 'cos', 'Lacoste'], 'co'))
      .toEqual(['COS', 'Lacoste']);
    expect(filterBrandSuggestions(['Zara', 'COS'], '')).toEqual(['Zara', 'COS']);
  });

  describe('triage', () => {
    const piece = { id: 'a', name: 'Wool pullover', category: 'top' };

    it('stays silent when the read is clear', () => {
      expect(pieceFlags(piece)).toEqual([]);
      expect(pieceReviewState(piece, new Set())).toBe('ready');
    });

    it('flags what the model doubted, in display order', () => {
      expect(pieceFlags({ ...piece, lowConfidenceFields: ['brand', 'material', 'nonsense'] }))
        .toEqual(['material', 'brand']);
    });

    it('flags placeholder names and a missing category without a model hint', () => {
      expect(pieceFlags({ ...piece, name: 'Unknown Item', category: null })).toEqual(['name', 'category']);
      expect(pieceFlags({ ...piece, name: '  ' })).toEqual(['name']);
    });

    it('asks for a look at failed extractions, and lets confirmation win', () => {
      expect(pieceReviewState({ ...piece, extractFailed: true }, new Set())).toBe('check');
      expect(pieceReviewState({ ...piece, extractFailed: true }, new Set(['a']))).toBe('confirmed');
    });

    it('summarises confirmed pieces as ready', () => {
      const states: PieceReviewState[] = ['ready', 'check', 'confirmed', 'check', 'ready'];
      const summary = reviewSummary(states);
      expect(summary).toEqual({ ready: 2, check: 2, confirmed: 1 });
      expect(reviewSummaryLabel(summary)).toBe('3 ready · 2 to check');
      expect(reviewSummaryLabel({ ready: 4, check: 0, confirmed: 0 })).toBe('All 4 ready');
      expect(reviewSummaryLabel({ ready: 0, check: 2, confirmed: 0 })).toBe('2 to check');
      expect(reviewSummaryLabel({ ready: 1, check: 0, confirmed: 0 })).toBe('Ready to add');
    });

    it('tells the user review is optional when nothing is flagged', () => {
      expect(sheetGuidance('review', { ready: 14, check: 0, confirmed: 2 })).toEqual({
        lead: 'All 16 ready',
        hint: 'Tap a piece to edit it, or add them as they are.',
      });
    });

    it('explains the dot once pieces are flagged, and instructs before extraction', () => {
      expect(sheetGuidance('review', { ready: 13, check: 3, confirmed: 0 })).toEqual({
        lead: '13 ready · 3 to check',
        hint: 'Pieces with a dot are worth a look.',
      });
      expect(sheetGuidance('pre-extract', { ready: 0, check: 0, confirmed: 0 }).lead).toBeNull();
    });

    it('walks to the next flagged piece, wrapping, and ends on the last one', () => {
      const states: Record<string, PieceReviewState> = { a: 'check', b: 'ready', c: 'check', d: 'confirmed' };
      expect(nextFlaggedPieceId(['a', 'b', 'c', 'd'], states, 'a')).toBe('c');
      expect(nextFlaggedPieceId(['a', 'b', 'c', 'd'], states, 'd')).toBe('a');
      expect(nextFlaggedPieceId(['a', 'b', 'c', 'd'], states, null)).toBe('a');
      expect(nextFlaggedPieceId(['a', 'b'], { a: 'check', b: 'ready' }, 'a')).toBeNull();
    });
  });

  it('adds the contact sheet only past three pieces, and a third column past six', () => {
    expect(usesContactSheet(3)).toBe(false);
    expect(usesContactSheet(4)).toBe(true);
    expect(contactSheetColumns(6)).toBe(2);
    expect(contactSheetColumns(7)).toBe(3);
  });

  it('maps a scrubber position to a piece and clamps at the ends', () => {
    expect(scrubberIndex(0, 320, 16)).toBe(0);
    expect(scrubberIndex(161, 320, 16)).toBe(8);
    expect(scrubberIndex(-40, 320, 16)).toBe(0);
    expect(scrubberIndex(999, 320, 16)).toBe(15);
  });
});
