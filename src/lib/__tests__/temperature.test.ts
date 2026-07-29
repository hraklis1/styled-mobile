import { formatTemp, formatTempRange, resolveTempUnit, unitForLocation } from '../temperature';

describe('unitForLocation', () => {
  it('reads geocoded US labels as Fahrenheit', () => {
    expect(unitForLocation('Brooklyn, New York, US')).toBe('F');
    expect(unitForLocation('Bedford Ave, Brooklyn, New York, US')).toBe('F');
    expect(unitForLocation('Austin, Texas, US')).toBe('F');
  });

  it('reads geocoded metric labels as Celsius', () => {
    expect(unitForLocation('Athens, Attica, GR')).toBe('C');
    expect(unitForLocation('Paris, Île-de-France, FR')).toBe('C');
    expect(unitForLocation('London, England, GB')).toBe('C');
    expect(unitForLocation('Toronto, Ontario, CA')).toBe('C');
    expect(unitForLocation('Berlin, Berlin, DE')).toBe('C');
  });

  it('handles hand-typed "City, ST" as US states', () => {
    expect(unitForLocation('Brooklyn, NY')).toBe('F');
    expect(unitForLocation('Sacramento, CA')).toBe('F');
    expect(unitForLocation('Portland, OR')).toBe('F');
  });

  it('handles hand-typed country names', () => {
    expect(unitForLocation('Paris, France')).toBe('C');
    expect(unitForLocation('Tokyo, Japan')).toBe('C');
    expect(unitForLocation('Milan, Italy')).toBe('C');
    expect(unitForLocation('Chicago, United States')).toBe('F');
    expect(unitForLocation('Nassau, Bahamas')).toBe('F');
  });

  it('prefers the trailing country over an earlier same-named region', () => {
    expect(unitForLocation('Atlanta, Georgia, US')).toBe('F');
    expect(unitForLocation('Tbilisi, Georgia')).toBe('C');
  });

  it('is case- and accent-insensitive', () => {
    expect(unitForLocation('méxico city, mexico')).toBe('C');
    expect(unitForLocation('miami, fl, usa')).toBe('F');
  });

  it('returns undefined when there is no country signal', () => {
    expect(unitForLocation(undefined)).toBeUndefined();
    expect(unitForLocation('')).toBeUndefined();
    expect(unitForLocation('   ')).toBeUndefined();
    expect(unitForLocation('Somewhere Nice')).toBeUndefined();
  });
});

describe('resolveTempUnit', () => {
  it('honours an explicit preference over the home location', () => {
    expect(resolveTempUnit('C', 'Brooklyn, New York, US')).toBe('C');
    expect(resolveTempUnit('F', 'Athens, Attica, GR')).toBe('F');
  });

  it('falls back to the home location when the preference is auto', () => {
    expect(resolveTempUnit('auto', 'Athens, Attica, GR')).toBe('C');
    expect(resolveTempUnit(null, 'Athens, Attica, GR')).toBe('C');
    expect(resolveTempUnit(undefined, 'Brooklyn, NY')).toBe('F');
  });

  it('defaults to Fahrenheit with no usable location', () => {
    expect(resolveTempUnit(null, null)).toBe('F');
    expect(resolveTempUnit('auto', 'Somewhere Nice')).toBe('F');
  });
});

describe('formatting', () => {
  const weather = { temperatureC: 17.4, temperatureF: 63.3 };

  it('formats the current temperature in the resolved unit', () => {
    expect(formatTemp(weather, 'auto', 'Athens, Attica, GR')).toBe('17°C');
    expect(formatTemp(weather, 'auto', 'Brooklyn, NY')).toBe('63°F');
  });

  it('formats a forecast range in the resolved unit', () => {
    const forecast = { tempMinC: 9.2, tempMaxC: 17.4, tempMinF: 48.6, tempMaxF: 63.3 };
    expect(formatTempRange(forecast, 'auto', 'Athens, Attica, GR')).toBe('9–17°C');
    expect(formatTempRange(forecast, 'auto', 'Brooklyn, NY')).toBe('49–63°F');
  });
});
