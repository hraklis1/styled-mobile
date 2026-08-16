// Temperature display helpers — one place so every surface (Home, Stylist, daily
// pick, calendar) shows the same unit. The user's `profile.tempUnit` may be
// 'F' | 'C' | 'auto' | null. An explicit 'C' or 'F' always wins; on 'auto' we
// infer the unit from their saved Home location (`profile.location`), and fall
// back to °F when that tells us nothing.

import {
  AMBIGUOUS_STATE_COUNTRY_CODES,
  normalizeLocationSegment,
  splitLocationSegments,
  US_STATE_CODES,
  US_STATE_NAMES,
} from './locationSegments';

export type ResolvedTempUnit = 'C' | 'F';

// ── Home-location inference ───────────────────────────────────────────────────
// Home-location segment parsing (normalization, US state detection, the
// California/Canada-style ambiguous codes) lives in locationSegments.ts,
// shared with currency.ts — both infer a preference from the same
// `profile.location` string.

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

/**
 * Infers the temperature unit a location's country uses, or `undefined` when
 * the label carries no usable country signal.
 */
export function unitForLocation(location?: string | null): ResolvedTempUnit | undefined {
  const segments = splitLocationSegments(location);
  if (segments.length === 0) return undefined;

  const normalized = segments.map(normalizeLocationSegment);

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
    if (AMBIGUOUS_STATE_COUNTRY_CODES.has(trailing)) return segments.length >= 3 ? 'C' : 'F';
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
