// Currency display helpers — mirrors temperature.ts's pattern (see
// locationSegments.ts): infer a preference from the user's saved Home
// location, and fall back to a sane default when that location tells us
// nothing. There is no explicit user override for currency (unlike
// `profile.tempUnit`) — it always follows Home location.

import {
  AMBIGUOUS_STATE_COUNTRY_CODES,
  normalizeLocationSegment,
  splitLocationSegments,
  US_STATE_CODES,
  US_STATE_NAMES,
} from './locationSegments';

export const DEFAULT_CURRENCY_CODE = 'USD';

/**
 * ISO alpha-2 country code -> ISO 4217 currency code. Geocoded Home locations
 * ("Brooklyn, New York, US") always end in one of these, so this needs to be
 * a real, near-complete country list — not just the handful temperature.ts
 * special-cases (FAHRENHEIT_COUNTRY_CODES and the US-state/country ambiguous
 * codes like DE = Germany, not Delaware, all covered below).
 */
const CURRENCY_BY_COUNTRY_CODE: Record<string, string> = {
  // Europe
  AD: 'EUR', AL: 'ALL', AT: 'EUR', BA: 'BAM', BE: 'EUR', BG: 'BGN',
  BY: 'BYN', CH: 'CHF', CY: 'EUR', CZ: 'CZK', DE: 'EUR', DK: 'DKK',
  EE: 'EUR', ES: 'EUR', FI: 'EUR', FR: 'EUR', GB: 'GBP', GI: 'GIP',
  GR: 'EUR', HR: 'EUR', HU: 'HUF', IE: 'EUR', IS: 'ISK', IT: 'EUR',
  LI: 'CHF', LT: 'EUR', LU: 'EUR', LV: 'EUR', MC: 'EUR', MD: 'MDL',
  ME: 'EUR', MK: 'MKD', MT: 'EUR', NL: 'EUR', NO: 'NOK', PL: 'PLN',
  PT: 'EUR', RO: 'RON', RS: 'RSD', RU: 'RUB', SE: 'SEK', SI: 'EUR',
  SK: 'EUR', SM: 'EUR', UA: 'UAH', VA: 'EUR', XK: 'EUR',

  // North America & Caribbean
  US: 'USD', CA: 'CAD', MX: 'MXN', GT: 'GTQ', BZ: 'BZD', SV: 'USD',
  HN: 'HNL', NI: 'NIO', CR: 'CRC', PA: 'PAB', CU: 'CUP', DO: 'DOP',
  HT: 'HTG', JM: 'JMD', TT: 'TTD', BS: 'BSD', BB: 'BBD', KY: 'KYD',
  PR: 'USD', GU: 'USD', AS: 'USD', MP: 'USD', VI: 'USD', MS: 'XCD',

  // South America
  AR: 'ARS', BO: 'BOB', BR: 'BRL', CL: 'CLP', CO: 'COP', EC: 'USD',
  GY: 'GYD', PE: 'PEN', PY: 'PYG', SR: 'SRD', UY: 'UYU', VE: 'VES',

  // Africa
  DZ: 'DZD', EG: 'EGP', ET: 'ETB', GA: 'XAF', GH: 'GHS', KE: 'KES',
  LR: 'LRD', MA: 'MAD', NE: 'XOF', NG: 'NGN', SC: 'SCR', SD: 'SDG',
  SN: 'XOF', CI: 'XOF', TN: 'TND', TZ: 'TZS', UG: 'UGX', ZA: 'ZAR',
  CM: 'XAF',

  // Middle East
  AE: 'AED', BH: 'BHD', IL: 'ILS', IQ: 'IQD', IR: 'IRR', JO: 'JOD',
  KW: 'KWD', LB: 'LBP', OM: 'OMR', QA: 'QAR', SA: 'SAR', TR: 'TRY',

  // Asia
  AF: 'AFN', AM: 'AMD', AZ: 'AZN', BD: 'BDT', BN: 'BND', CN: 'CNY',
  GE: 'GEL', HK: 'HKD', ID: 'IDR', IN: 'INR', JP: 'JPY', KG: 'KGS',
  KH: 'KHR', KR: 'KRW', KZ: 'KZT', LA: 'LAK', LK: 'LKR', MM: 'MMK',
  MN: 'MNT', MO: 'MOP', MY: 'MYR', NP: 'NPR', PH: 'PHP', PK: 'PKR',
  SG: 'SGD', TH: 'THB', TJ: 'TJS', TM: 'TMT', TW: 'TWD', UZ: 'UZS',
  VN: 'VND',

  // Oceania
  AU: 'AUD', FJ: 'FJD', NC: 'XPF', NZ: 'NZD', PG: 'PGK', PW: 'USD',
  FM: 'USD', MH: 'USD',
};

/** Hand-typed / spelled-out country name (normalized) -> ISO 4217 currency
 *  code. Mirrors temperature.ts's FAHRENHEIT_COUNTRY_NAMES and
 *  CELSIUS_COUNTRY_NAMES sets, so a location that resolves a temperature unit
 *  also resolves a currency. */
const CURRENCY_BY_COUNTRY_NAME: Record<string, string> = {
  // Fahrenheit-list countries
  'united states': 'USD', 'united states of america': 'USD', 'usa': 'USD',
  'us': 'USD', 'u s a': 'USD', 'america': 'USD',
  'american samoa': 'USD', 'guam': 'USD', 'northern mariana islands': 'USD',
  'puerto rico': 'USD', 'us virgin islands': 'USD',
  'united states virgin islands': 'USD', 'virgin islands': 'USD',
  'bahamas': 'BSD', 'the bahamas': 'BSD', 'belize': 'BZD',
  'cayman islands': 'KYD', 'liberia': 'LRD', 'marshall islands': 'USD',
  'micronesia': 'USD', 'federated states of micronesia': 'USD',
  'montserrat': 'XCD', 'palau': 'USD',

  // Celsius-list countries
  'afghanistan': 'AFN', 'albania': 'ALL', 'algeria': 'DZD',
  'argentina': 'ARS', 'armenia': 'AMD', 'australia': 'AUD',
  'austria': 'EUR', 'azerbaijan': 'AZN', 'bahrain': 'BHD',
  'bangladesh': 'BDT', 'barbados': 'BBD', 'belarus': 'BYN',
  'belgium': 'EUR', 'bermuda': 'BMD', 'bolivia': 'BOB',
  'bosnia and herzegovina': 'BAM', 'brazil': 'BRL', 'bulgaria': 'BGN',
  'cambodia': 'KHR', 'cameroon': 'XAF', 'canada': 'CAD', 'chile': 'CLP',
  'china': 'CNY', 'colombia': 'COP', 'costa rica': 'CRC',
  'croatia': 'EUR', 'cuba': 'CUP', 'cyprus': 'EUR', 'czechia': 'CZK',
  'czech republic': 'CZK', 'denmark': 'DKK', 'dominican republic': 'DOP',
  'ecuador': 'USD', 'egypt': 'EGP', 'england': 'GBP', 'estonia': 'EUR',
  'ethiopia': 'ETB', 'fiji': 'FJD', 'finland': 'EUR', 'france': 'EUR',
  'georgia': 'GEL', 'germany': 'EUR', 'ghana': 'GHS',
  'gibraltar': 'GIP', 'great britain': 'GBP', 'greece': 'EUR',
  'guatemala': 'GTQ', 'holland': 'EUR', 'honduras': 'HNL',
  'hong kong': 'HKD', 'hungary': 'HUF', 'iceland': 'ISK', 'india': 'INR',
  'indonesia': 'IDR', 'iran': 'IRR', 'iraq': 'IQD', 'ireland': 'EUR',
  'israel': 'ILS', 'italy': 'EUR', 'ivory coast': 'XOF',
  'jamaica': 'JMD', 'japan': 'JPY', 'jordan': 'JOD',
  'kazakhstan': 'KZT', 'kenya': 'KES', 'kuwait': 'KWD', 'latvia': 'EUR',
  'lebanon': 'LBP', 'lithuania': 'EUR', 'luxembourg': 'EUR',
  'macau': 'MOP', 'malaysia': 'MYR', 'malta': 'EUR', 'mexico': 'MXN',
  'moldova': 'MDL', 'monaco': 'EUR', 'mongolia': 'MNT',
  'montenegro': 'EUR', 'morocco': 'MAD', 'nepal': 'NPR',
  'netherlands': 'EUR', 'new zealand': 'NZD', 'nigeria': 'NGN',
  'north macedonia': 'MKD', 'northern ireland': 'GBP', 'norway': 'NOK',
  'oman': 'OMR', 'pakistan': 'PKR', 'panama': 'PAB',
  'paraguay': 'PYG', 'peru': 'PEN', 'philippines': 'PHP',
  'poland': 'PLN', 'portugal': 'EUR', 'qatar': 'QAR', 'romania': 'RON',
  'russia': 'RUB', 'saudi arabia': 'SAR', 'scotland': 'GBP',
  'senegal': 'XOF', 'serbia': 'RSD', 'singapore': 'SGD',
  'slovakia': 'EUR', 'slovenia': 'EUR', 'south africa': 'ZAR',
  'south korea': 'KRW', 'korea': 'KRW', 'spain': 'EUR',
  'sri lanka': 'LKR', 'sweden': 'SEK', 'switzerland': 'CHF',
  'taiwan': 'TWD', 'tanzania': 'TZS', 'thailand': 'THB',
  'trinidad and tobago': 'TTD', 'tunisia': 'TND', 'turkey': 'TRY',
  'turkiye': 'TRY', 'uae': 'AED', 'united arab emirates': 'AED',
  'uganda': 'UGX', 'ukraine': 'UAH', 'united kingdom': 'GBP',
  'uk': 'GBP', 'uruguay': 'UYU', 'venezuela': 'VES', 'vietnam': 'VND',
  'wales': 'GBP',
};

/**
 * Infers the ISO 4217 currency for a location's country, or `undefined` when
 * the label carries no usable country signal. Same segment-reading strategy
 * as temperature.ts's `unitForLocation` — see locationSegments.ts.
 */
export function currencyForLocation(location?: string | null): string | undefined {
  const segments = splitLocationSegments(location);
  if (segments.length === 0) return undefined;

  const normalized = segments.map(normalizeLocationSegment);

  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    const currency = CURRENCY_BY_COUNTRY_NAME[normalized[i]];
    if (currency) return currency;
  }

  // "…, New York, US" — the region names a US state even if the code is absent.
  if (normalized.slice(1).some((segment) => US_STATE_NAMES.has(segment))) return 'USD';

  const trailing = segments[segments.length - 1].toUpperCase();
  if (/^[A-Z]{2}$/.test(trailing)) {
    if (AMBIGUOUS_STATE_COUNTRY_CODES.has(trailing)) {
      return segments.length >= 3 ? CURRENCY_BY_COUNTRY_CODE[trailing] : 'USD';
    }
    if (US_STATE_CODES.has(trailing)) return 'USD';
    return CURRENCY_BY_COUNTRY_CODE[trailing];
  }

  return undefined;
}

/** The currency code to format prices in, inferred from the user's Home location. */
export function resolveCurrencyCode(homeLocation?: string | null): string {
  return currencyForLocation(homeLocation) ?? DEFAULT_CURRENCY_CODE;
}
