// Temperature display helpers — one place so every surface (Home, Stylist, daily
// pick, calendar) shows the same unit. The user's `profile.tempUnit` may be
// 'F' | 'C' | 'auto' | null. An explicit 'C' or 'F' always wins; on 'auto' we
// infer the unit from their saved Home location (`profile.location`), and fall
// back to °F when that tells us nothing.

export type ResolvedTempUnit = 'C' | 'F';

// ── Home-location inference ───────────────────────────────────────────────────
// Home locations come from the Nominatim autocomplete or reverse geocoding, so
// they usually look like "Brooklyn, New York, US" / "Athens, Attica, GR" — a
// trailing ISO-3166 alpha-2 code after the region. Hand-typed values are looser
// ("Brooklyn, NY", "Paris, France"), so we read every segment.

function normalize(segment: string): string {
  return segment
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Countries on Fahrenheit, by ISO alpha-2 code. */
const FAHRENHEIT_COUNTRY_CODES = new Set([
  'US', 'AS', 'GU', 'MP', 'PR', 'VI', // United States and its territories
  'BS', 'BZ', 'KY', 'FM', 'LR', 'MH', 'MS', 'PW',
]);

const FAHRENHEIT_COUNTRY_NAMES = new Set([
  'united states', 'united states of america', 'usa', 'us', 'u s a', 'america',
  'american samoa', 'guam', 'northern mariana islands', 'puerto rico',
  'us virgin islands', 'united states virgin islands', 'virgin islands',
  'bahamas', 'the bahamas', 'belize', 'cayman islands', 'liberia',
  'marshall islands', 'micronesia', 'federated states of micronesia',
  'montserrat', 'palau',
]);

/** Common hand-typed country names. Anything here is a metric country. */
const CELSIUS_COUNTRY_NAMES = new Set([
  'afghanistan', 'albania', 'algeria', 'argentina', 'armenia', 'australia',
  'austria', 'azerbaijan', 'bahrain', 'bangladesh', 'barbados', 'belarus',
  'belgium', 'bermuda', 'bolivia', 'bosnia and herzegovina', 'brazil',
  'bulgaria', 'cambodia', 'cameroon', 'canada', 'chile', 'china', 'colombia',
  'costa rica', 'croatia', 'cuba', 'cyprus', 'czechia', 'czech republic',
  'denmark', 'dominican republic', 'ecuador', 'egypt', 'england', 'estonia',
  'ethiopia', 'fiji', 'finland', 'france', 'georgia', 'germany', 'ghana',
  'gibraltar', 'great britain', 'greece', 'guatemala', 'holland', 'honduras',
  'hong kong', 'hungary', 'iceland', 'india', 'indonesia', 'iran', 'iraq',
  'ireland', 'israel', 'italy', 'ivory coast', 'jamaica', 'japan', 'jordan',
  'kazakhstan', 'kenya', 'kuwait', 'latvia', 'lebanon', 'lithuania',
  'luxembourg', 'macau', 'malaysia', 'malta', 'mexico', 'moldova', 'monaco',
  'mongolia', 'montenegro', 'morocco', 'nepal', 'netherlands', 'new zealand',
  'nigeria', 'north macedonia', 'northern ireland', 'norway', 'oman',
  'pakistan', 'panama', 'paraguay', 'peru', 'philippines', 'poland',
  'portugal', 'qatar', 'romania', 'russia', 'saudi arabia', 'scotland',
  'senegal', 'serbia', 'singapore', 'slovakia', 'slovenia', 'south africa',
  'south korea', 'korea', 'spain', 'sri lanka', 'sweden', 'switzerland',
  'taiwan', 'tanzania', 'thailand', 'trinidad and tobago', 'tunisia',
  'turkey', 'turkiye', 'uae', 'united arab emirates', 'uganda', 'ukraine',
  'united kingdom', 'uk', 'uruguay', 'venezuela', 'vietnam', 'wales',
]);

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI',
  'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN',
  'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH',
  'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
]);

/**
 * Codes that are both a US state abbreviation and an ISO country code, e.g. CA
 * (California / Canada) or DE (Delaware / Germany). Geocoded labels append the
 * country last, so a third segment means the trailing code is the country.
 */
const AMBIGUOUS_CODES = new Set([
  'AL', 'AR', 'CA', 'CO', 'DE', 'GA', 'ID', 'IL', 'IN', 'LA', 'MA', 'MD',
  'ME', 'MN', 'MO', 'MT', 'NC', 'NE', 'PA', 'SC', 'SD', 'TN', 'VA',
]);

const US_STATE_NAMES = new Set([
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
 * Infers the temperature unit a location's country uses, or `undefined` when
 * the label carries no usable country signal.
 */
export function unitForLocation(location?: string | null): ResolvedTempUnit | undefined {
  const segments = (location ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return undefined;

  const normalized = segments.map(normalize);

  // A spelled-out country is the strongest signal. Read right to left: the
  // country sits last, so "Atlanta, Georgia, US" is Fahrenheit while "Tbilisi,
  // Georgia" is Celsius.
  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    if (FAHRENHEIT_COUNTRY_NAMES.has(normalized[i])) return 'F';
    if (CELSIUS_COUNTRY_NAMES.has(normalized[i])) return 'C';
  }

  // "…, New York, US" — the region names a US state even if the code is absent.
  // Skip the first segment so a city named after a state (Washington, Kansas)
  // doesn't outvote the country code we read below.
  if (normalized.slice(1).some((segment) => US_STATE_NAMES.has(segment))) return 'F';

  const trailing = segments[segments.length - 1].toUpperCase();
  if (/^[A-Z]{2}$/.test(trailing)) {
    if (FAHRENHEIT_COUNTRY_CODES.has(trailing)) return 'F';
    if (AMBIGUOUS_CODES.has(trailing)) return segments.length >= 3 ? 'C' : 'F';
    if (US_STATE_CODES.has(trailing)) return 'F';
    return 'C'; // A trailing two-letter code we don't read as a US state.
  }

  return undefined;
}

/**
 * The unit to display in. `tempUnit` is the saved preference ('F' | 'C' |
 * 'auto' | null); on 'auto' we follow the user's Home location.
 */
export function resolveTempUnit(
  tempUnit?: string | null,
  homeLocation?: string | null,
): ResolvedTempUnit {
  if (tempUnit === 'C' || tempUnit === 'F') return tempUnit;
  return unitForLocation(homeLocation) ?? 'F';
}

type TempReadable = { temperatureC: number; temperatureF: number };
type TempRangeReadable = {
  tempMinC: number;
  tempMaxC: number;
  tempMinF: number;
  tempMaxF: number;
};

/** Rounded temperature value in the user's preferred unit (no degree symbol). */
export function tempValue(
  weather: TempReadable,
  tempUnit?: string | null,
  homeLocation?: string | null,
): number {
  const unit = resolveTempUnit(tempUnit, homeLocation);
  return Math.round(unit === 'C' ? weather.temperatureC : weather.temperatureF);
}

/** Formatted temperature like "63°F" / "17°C". */
export function formatTemp(
  weather: TempReadable,
  tempUnit?: string | null,
  homeLocation?: string | null,
): string {
  const unit = resolveTempUnit(tempUnit, homeLocation);
  return `${tempValue(weather, tempUnit, homeLocation)}°${unit}`;
}

/** Formatted forecast range like "48–63°F" / "9–17°C". */
export function formatTempRange(
  forecast: TempRangeReadable,
  tempUnit?: string | null,
  homeLocation?: string | null,
): string {
  const unit = resolveTempUnit(tempUnit, homeLocation);
  const min = Math.round(unit === 'C' ? forecast.tempMinC : forecast.tempMinF);
  const max = Math.round(unit === 'C' ? forecast.tempMaxC : forecast.tempMaxF);
  return `${min}–${max}°${unit}`;
}
