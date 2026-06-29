import {
  normalizeBudgetRange,
  normalizeFitFields,
  normalizeOccasions,
  normalizeStylePreference,
  normalizeStyleProfileDetails,
} from '../profileOptions';

describe('profileOptions', () => {
  it('normalizes legacy option ids into canonical profile values', () => {
    expect(normalizeStylePreference(['trendy', 'smart casual', 'grunge', 'trend_forward'])).toEqual([
      'trend_forward',
      'smart_casual',
      'edgy',
    ]);
    expect(normalizeBudgetRange('thrift')).toBe('value_thrift');
    expect(normalizeBudgetRange('mid')).toBe('contemporary_mid');
    expect(normalizeBudgetRange('luxury')).toBe('luxury_high_end');
    expect(normalizeOccasions(['casual', 'work', 'nights_out', 'formal', 'active'])).toEqual([
      'casual_weekend',
      'work_office',
      'night_out',
      'formal_events',
      'athletic_active',
    ]);
  });

  it('migrates legacy fitPreference silhouette values out of preferred cut', () => {
    expect(normalizeFitFields('relaxed', null)).toEqual({
      fitPreference: '',
      fitSilhouette: 'relaxed',
    });
    expect(normalizeFitFields('feminine_cut', 'tailored')).toEqual({
      fitPreference: 'feminine_cut',
      fitSilhouette: 'tailored',
    });
  });

  it('normalizes sparse style detail objects into the versioned shape', () => {
    expect(normalizeStyleProfileDetails({
      styleAvoids: [' boxy sleeves ', ''],
      colorAnalysis: { undertone: ' warm ', metalPreference: ['gold', 'gold'] },
      sensitiveFit: { notes: ' longer hems ' },
    })).toMatchObject({
      version: 1,
      styleAvoids: ['boxy sleeves'],
      colorAnalysis: { undertone: 'warm', contrast: null, metalPreference: ['gold'] },
      sensitiveFit: { proportions: [], coverage: [], comfort: [], notes: 'longer hems' },
    });
  });

  it('resolves material and pattern conflicts by preserving avoid selections', () => {
    expect(normalizeStyleProfileDetails({
      materialLikes: ['cotton', 'linen', 'silk'],
      materialAvoids: ['linen', 'wool'],
      patternLikes: ['solid', 'stripe', 'plaid'],
      patternAvoids: ['stripe', 'floral'],
    })).toMatchObject({
      materialLikes: ['cotton', 'silk'],
      materialAvoids: ['linen', 'wool'],
      patternLikes: ['solid', 'plaid'],
      patternAvoids: ['stripe', 'floral'],
    });
  });
});
