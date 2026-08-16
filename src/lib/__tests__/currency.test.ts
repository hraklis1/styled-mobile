import { currencyForLocation, resolveCurrencyCode } from '../currency';

describe('currencyForLocation', () => {
  it('reads geocoded US labels as USD', () => {
    expect(currencyForLocation('Brooklyn, New York, US')).toBe('USD');
    expect(currencyForLocation('Austin, Texas, US')).toBe('USD');
  });

  it('reads geocoded non-US labels by country', () => {
    expect(currencyForLocation('Toronto, Ontario, CA')).toBe('CAD');
    expect(currencyForLocation('Athens, Attica, GR')).toBe('EUR');
    expect(currencyForLocation('Paris, Île-de-France, FR')).toBe('EUR');
    expect(currencyForLocation('London, England, GB')).toBe('GBP');
    expect(currencyForLocation('Berlin, Berlin, DE')).toBe('EUR');
  });

  it('handles hand-typed "City, ST" as US states', () => {
    expect(currencyForLocation('Brooklyn, NY')).toBe('USD');
    expect(currencyForLocation('Sacramento, CA')).toBe('USD');
  });

  it('handles hand-typed country names', () => {
    expect(currencyForLocation('Paris, France')).toBe('EUR');
    expect(currencyForLocation('Tokyo, Japan')).toBe('JPY');
    expect(currencyForLocation('Toronto, Canada')).toBe('CAD');
    expect(currencyForLocation('Chicago, United States')).toBe('USD');
  });

  it('disambiguates a US-state code from the same code as a country', () => {
    // California (2 segments) vs Canada (3+ segments, geocoded)
    expect(currencyForLocation('Sacramento, CA')).toBe('USD');
    expect(currencyForLocation('Toronto, Ontario, CA')).toBe('CAD');
    // Delaware (2 segments) vs Germany (3+ segments, geocoded)
    expect(currencyForLocation('Dover, DE')).toBe('USD');
    expect(currencyForLocation('Berlin, Berlin, DE')).toBe('EUR');
  });

  it('is case- and accent-insensitive', () => {
    expect(currencyForLocation('méxico city, mexico')).toBe('MXN');
    expect(currencyForLocation('miami, fl, usa')).toBe('USD');
  });

  it('returns undefined when there is no country signal', () => {
    expect(currencyForLocation(undefined)).toBeUndefined();
    expect(currencyForLocation('')).toBeUndefined();
    expect(currencyForLocation('Somewhere Nice')).toBeUndefined();
  });
});

describe('resolveCurrencyCode', () => {
  it('follows the home location', () => {
    expect(resolveCurrencyCode('Toronto, Ontario, CA')).toBe('CAD');
    expect(resolveCurrencyCode('Paris, France')).toBe('EUR');
  });

  it('defaults to USD with no usable location', () => {
    expect(resolveCurrencyCode(null)).toBe('USD');
    expect(resolveCurrencyCode('Somewhere Nice')).toBe('USD');
  });
});
