import {
  budgetOptionsForCurrency,
  derivePalette,
  deviceCountryCode,
  sizingRegionForCountry,
} from '../onboardingDefaults';
import {
  collapseToOnboardingOccasions,
  expandOnboardingOccasions,
  hasStyleProfileDetailsValue,
  createEmptyStyleProfileDetails,
  normalizeStyleProfileDetails,
} from '../profileOptions';

describe('deviceCountryCode', () => {
  it('reads the region subtag, skipping scripts', () => {
    expect(deviceCountryCode('en-GB')).toBe('GB');
    expect(deviceCountryCode('zh-Hant-TW')).toBe('TW');
    expect(deviceCountryCode('fr_CH')).toBe('CH');
    expect(deviceCountryCode('en')).toBeNull();
  });
});

describe('sizingRegionForCountry', () => {
  it('maps by how shops label sizes, not by currency', () => {
    expect(sizingRegionForCountry('GB')).toBe('UK');
    expect(sizingRegionForCountry('IE')).toBe('UK');
    expect(sizingRegionForCountry('CH')).toBe('EU');
    expect(sizingRegionForCountry('SE')).toBe('EU');
    expect(sizingRegionForCountry('CA')).toBe('US');
    expect(sizingRegionForCountry(null)).toBe('US');
  });
});

describe('budgetOptionsForCurrency', () => {
  it('swaps the tier marks into the currency symbol', () => {
    const labels = budgetOptionsForCurrency('GBP').map((o) => o.label);
    expect(labels[2]).toBe('Premium (£££)');
    expect(budgetOptionsForCurrency('USD')[0].label).toBe('Value / thrift ($)');
  });
});

describe('derivePalette', () => {
  it('follows pick order and caps at two', () => {
    expect(derivePalette(['bohemian', 'minimalist'])).toEqual(['earthy', 'pastels']);
    expect(derivePalette(['edgy', 'casual'])).toEqual(['monochrome', 'neutral']);
    expect(derivePalette([])).toEqual([]);
  });
});

describe('onboarding occasions', () => {
  it('expands to stored values and keeps ones onboarding cannot show', () => {
    expect(expandOnboardingOccasions(['evenings'], ['interview', 'date_night'])).toEqual([
      'date_night',
      'night_out',
      'interview',
    ]);
  });

  it('collapses stored values back to picks for prefill', () => {
    expect(collapseToOnboardingOccasions(['night_out', 'work_office', 'interview'])).toEqual(['work', 'evenings']);
  });
});

describe('paletteSource', () => {
  it('survives normalisation and keeps an otherwise-empty blob worth saving', () => {
    const derived = normalizeStyleProfileDetails({ ...createEmptyStyleProfileDetails(), paletteSource: 'derived' });
    expect(derived.paletteSource).toBe('derived');
    expect(hasStyleProfileDetailsValue(derived)).toBe(true);
    expect(hasStyleProfileDetailsValue(createEmptyStyleProfileDetails())).toBe(false);
  });
});
