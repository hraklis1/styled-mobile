import {
  COVERAGE_OPTIONS,
  SENSITIVE_PROPORTION_OPTIONS,
  STYLE_AVOID_OPTIONS,
  normalizeBodyType,
  normalizeBudgetRange,
  normalizeFitFields,
  normalizeOccasions,
  normalizeStylePreference,
  normalizeStyleProfileDetails,
  optionsForCut,
  uniqueClean,
} from '../profileOptions';

describe('uniqueClean', () => {
  it('cleans, dedupes and preserves order', () => {
    expect(uniqueClean([' pear ', 'pear', '', 'apple'])).toEqual(['pear', 'apple']);
  });

  it('survives shapes the API can return but the type forbids', () => {
    // A profile row that predates migration 0035 comes back scalar.
    expect(uniqueClean('pear')).toEqual(['pear']);
    expect(uniqueClean(null)).toEqual([]);
    expect(uniqueClean(undefined)).toEqual([]);
    // These previously threw: for...of on a non-iterable calls a missing
    // Symbol.iterator, which Hermes reports as "undefined is not a function".
    for (const shape of [{}, { 0: 'pear' }, 42, true]) {
      expect(uniqueClean(shape as unknown as string[])).toEqual([]);
    }
  });
});

describe('normalizeBodyType', () => {
  it('accepts both the array and the legacy scalar', () => {
    expect(normalizeBodyType(['pear'])).toEqual(['pear']);
    expect(normalizeBodyType('pear')).toEqual(['pear']);
    expect(normalizeBodyType(null)).toEqual([]);
  });

  it('does not throw on a malformed value', () => {
    expect(() => normalizeBodyType({} as unknown as string[])).not.toThrow();
    expect(normalizeBodyType({} as unknown as string[])).toEqual([]);
  });
});

describe('normalizeStyleProfileDetails on hostile input', () => {
  // style_profile_details is jsonb, so unlike the text[] columns nothing at the
  // database level constrains its shape. Only the top-level type is checked
  // before the sub-fields are handed to uniqueClean.
  it('survives sub-fields that are not arrays', () => {
    const hostile = {
      styleAvoids: {},
      favoriteColors: 42,
      avoidedColors: 'navy',
      materialLikes: true,
      materialAvoids: { 0: 'wool' },
      patternLikes: null,
      brandAvoids: undefined,
      shoppingPriorities: { nested: { deep: true } },
      careConstraints: [['nested array']],
      colorAnalysis: 'warm',
      sensitiveFit: 7,
      categoryBudgets: 'not-an-object',
    };

    expect(() => normalizeStyleProfileDetails(hostile)).not.toThrow();

    const out = normalizeStyleProfileDetails(hostile);
    expect(out.version).toBe(1);
    expect(out.styleAvoids).toEqual([]);
    expect(out.favoriteColors).toEqual([]);
    // A scalar string is still salvaged rather than discarded.
    expect(out.avoidedColors).toEqual(['navy']);
    expect(out.colorAnalysis.metalPreference).toEqual([]);
    expect(out.sensitiveFit.proportions).toEqual([]);
  });

  it('survives the primitives jsonb can legally hold at the top level', () => {
    for (const raw of [null, undefined, 'a string', 42, true, []]) {
      expect(() => normalizeStyleProfileDetails(raw)).not.toThrow();
    }
  });
});

describe('optionsForCut', () => {
  const values = (options: { value: string }[]) => options.map((o) => o.value);

  it("does not offer menswear shoppers options that cannot apply to them", () => {
    const offered = values(optionsForCut(STYLE_AVOID_OPTIONS, 'masculine_cut'));
    expect(offered).not.toContain('heels');
    expect(offered).not.toContain('crop tops');
    expect(offered).not.toContain('bodycon or clingy fits');
    expect(offered).not.toContain('short hemlines');
    // The cut-neutral majority is untouched.
    expect(offered).toContain('skinny jeans');
    expect(offered).toContain('fast fashion');
  });

  it('offers everything for feminine and fluid cuts, and when cut is unanswered', () => {
    for (const cut of ['feminine_cut', 'neutral_fluid', '', null, undefined]) {
      expect(optionsForCut(STYLE_AVOID_OPTIONS, cut)).toHaveLength(STYLE_AVOID_OPTIONS.length);
    }
  });

  it('keeps an already-selected option visible even when the cut excludes it', () => {
    // Otherwise switching cut strands the value: still saved, still in the
    // stylist prompt, no chip left to deselect it with.
    const offered = values(optionsForCut(STYLE_AVOID_OPTIONS, 'masculine_cut', ['heels']));
    expect(offered).toContain('heels');
    expect(offered).not.toContain('crop tops');
  });

  it('gates the anatomical fit chips the same way', () => {
    const proportions = values(optionsForCut(SENSITIVE_PROPORTION_OPTIONS, 'masculine_cut'));
    expect(proportions).not.toContain('full_bust');
    expect(proportions).not.toContain('curvy_hips');
    expect(proportions).toContain('broad_shoulders');

    const coverage = values(optionsForCut(COVERAGE_OPTIONS, 'masculine_cut'));
    expect(coverage).not.toContain('lower_necklines');
    expect(coverage).toContain('sleeves');
  });
});

describe('profileOptions', () => {
  it('normalizes legacy option ids into canonical profile values', () => {
    expect(normalizeStylePreference(['trendy', 'smart casual', 'grunge', 'trend_forward'])).toEqual([
      'trend_forward',
      'smart_casual',
      'edgy',
    ]);
    // Scalar in, array out — budgetRange became text[] in backend migration
    // 0035 but legacy rows and older clients still hand over a bare string.
    expect(normalizeBudgetRange('thrift')).toEqual(['value_thrift']);
    expect(normalizeBudgetRange('mid')).toEqual(['contemporary_mid']);
    expect(normalizeBudgetRange(['luxury', 'premium'])).toEqual(['luxury_high_end', 'premium']);
    expect(normalizeBudgetRange(null)).toEqual([]);
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
