import {
  buildNewClosetItemInput,
  initialScanSelections,
  mergeUniqueItemIds,
  normalizeScanCategory,
  resolvedScanItemIds,
  scanResolutionCounts,
  unresolvedScanIndexes,
} from '../outfit-log-scan';
import type { OutfitScanResult } from '../../hooks/useOutfitLogs';

function result(overrides: Partial<OutfitScanResult> = {}): OutfitScanResult {
  return {
    detected_type: 'cream top',
    match_id: null,
    confidence: 'Low',
    suggested_metadata: {
      name: 'Cream knit top',
      color: 'cream',
      category: 'top',
      material: 'wool',
      style: 'minimal',
    },
    potential_match_ids: [],
    bbox: null,
    crop: 'data:image/webp;base64,abc',
    ...overrides,
  };
}

describe('outfit log scan helpers', () => {
  it('preselects only high-confidence matches', () => {
    expect(initialScanSelections([
      result({ confidence: 'High', match_id: 8 }),
      result({ confidence: 'Medium', match_id: 9 }),
      result({ confidence: 'Low', match_id: null }),
    ])).toEqual({ 0: 8 });
  });

  it('normalizes unsupported categories to top', () => {
    expect(normalizeScanCategory('shoes')).toBe('shoes');
    expect(normalizeScanCategory('shirt')).toBe('top');
    expect(normalizeScanCategory(undefined)).toBe('top');
  });

  it('builds a create payload from scan metadata and editable overrides', () => {
    expect(buildNewClosetItemInput(result(), { name: '  My knit  ', brand: 'Aritzia' })).toMatchObject({
      name: 'My knit',
      brand: 'Aritzia',
      category: 'top',
      color: 'cream',
      material: 'wool',
      style: 'minimal',
      imageUrl: 'data:image/webp;base64,abc',
      needsDetails: true,
    });
  });

  it('deduplicates existing and newly-created selections', () => {
    expect(mergeUniqueItemIds([1, 2], [2, 3, 3])).toEqual([1, 2, 3]);
  });

  it('excludes skipped matches while preserving their resolution for restore', () => {
    expect(resolvedScanItemIds({ 0: 10, 1: 11, 2: 12 }, new Set([1]))).toEqual([10, 12]);
  });

  it('distinguishes unresolved, matched, new, and skipped results', () => {
    const results = [result(), result(), result(), result()];
    const selections = { 0: 10, 1: 11 };
    const skipped = new Set([2]);
    const created = new Set([1]);
    expect(unresolvedScanIndexes(results, selections, skipped)).toEqual([3]);
    expect(scanResolutionCounts(results, selections, skipped, created)).toEqual({
      detected: 4,
      matched: 1,
      new: 1,
      skipped: 1,
      unresolved: 1,
    });
  });
});
