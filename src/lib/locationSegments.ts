// Shared by preference-resolution helpers (temperature, currency, ...) that
// infer a setting from the user's saved Home location. Locations come from
// the Nominatim autocomplete or reverse geocoding, so they usually look like
// "Brooklyn, New York, US" / "Athens, Attica, GR" — a trailing ISO-3166
// alpha-2 code after the region. Hand-typed values are looser ("Brooklyn,
// NY", "Paris, France"), so callers read every segment.

export function normalizeLocationSegment(segment: string): string {
  return segment
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitLocationSegments(location?: string | null): string[] {
  return (location ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

export const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI',
  'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN',
  'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH',
  'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
]);

export const US_STATE_NAMES = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'district of columbia', 'washington dc',
  'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
  'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts',
  'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska',
  'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york',
  'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
  'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
  'west virginia', 'wisconsin', 'wyoming',
]);

/**
 * Codes that are both a US state abbreviation and an ISO country code, e.g. CA
 * (California / Canada) or DE (Delaware / Germany). Geocoded labels append the
 * country last, so a third segment means the trailing code is the country.
 */
export const AMBIGUOUS_STATE_COUNTRY_CODES = new Set([
  'AL', 'AR', 'CA', 'CO', 'DE', 'GA', 'ID', 'IL', 'IN', 'LA', 'MA', 'MD',
  'ME', 'MN', 'MO', 'MT', 'NC', 'NE', 'PA', 'SC', 'SD', 'TN', 'VA',
]);
