import { currencyForCountry, DEFAULT_CURRENCY_CODE } from './currency';
import { BUDGET_OPTIONS, type ProfileOption } from './profileOptions';

/**
 * Answers onboarding v2 infers instead of asking (docs/onboarding-redesign.md
 * §5.3–5.4). Every value here is a starting point the user can change in
 * Profile; none of it is ever shown back as "you said".
 */

// Countries whose shops label in EU sizes. Not the eurozone: Switzerland and
// Scandinavia size EU but don't use the euro, and Ireland shops UK sizes.
const EU_SIZING = new Set([
  'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
  'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
]);
const UK_SIZING = new Set(['GB', 'IE', 'AU', 'NZ']);

/** Region subtag of the device locale ("en-GB" → "GB"), or null. */
export function deviceCountryCode(locale?: string): string | null {
  let tag = locale;
  if (!tag) {
    try {
      tag = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      return null;
    }
  }
  // BCP 47: language[-script][-REGION]…; the region is the 2-letter subtag.
  const region = tag?.split(/[-_]/).slice(1).find((part) => /^[A-Za-z]{2}$/.test(part));
  return region ? region.toUpperCase() : null;
}

export function sizingRegionForCountry(countryCode: string | null): 'US' | 'UK' | 'EU' {
  if (countryCode && UK_SIZING.has(countryCode)) return 'UK';
  if (countryCode && EU_SIZING.has(countryCode)) return 'EU';
  return 'US';
}

export function deviceCurrencyCode(countryCode = deviceCountryCode()): string {
  return currencyForCountry(countryCode) ?? DEFAULT_CURRENCY_CODE;
}

/** "£" for GBP, "$" for USD; falls back to the code itself if Intl can't say. */
export function currencySymbol(currencyCode: string): string {
  try {
    const part = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

/** BUDGET_OPTIONS with the tier marks in the user's currency ("Premium (£££)"). */
export function budgetOptionsForCurrency(currencyCode: string): ProfileOption[] {
  const symbol = currencySymbol(currencyCode);
  // Multi-character symbols ("CHF", "kr") don't repeat legibly; show tiers as 1–4.
  if (symbol.length > 1) {
    return BUDGET_OPTIONS.map((o, i) => ({ ...o, label: o.label.replace(/\(\$+\)/, `(${'•'.repeat(i + 1)})`) }));
  }
  return BUDGET_OPTIONS.map((o) => ({ ...o, label: o.label.replace(/\$/g, symbol) }));
}

/**
 * A palette guess from the chosen aesthetics, for users who skip the palette
 * picker. Ordered by pick order so the first aesthetic leads; capped at two so
 * the guess stays a hint rather than a prescription. Stored with
 * `styleProfileDetails.paletteSource = 'derived'`.
 */
const PALETTES_BY_STYLE: Record<string, string[]> = {
  minimalist: ['neutral', 'monochrome'],
  classic: ['neutral', 'monochrome'],
  smart_casual: ['neutral', 'monochrome'],
  bohemian: ['earthy', 'pastels'],
  vintage: ['earthy', 'pastels'],
  edgy: ['monochrome'],
  streetwear: ['monochrome', 'neutral'],
  casual: ['neutral', 'earthy'],
  preppy: ['neutral', 'jewel'],
  trend_forward: ['monochrome', 'bright'],
  athleisure: ['neutral', 'monochrome'],
};

export function derivePalette(stylePreference: readonly string[]): string[] {
  const out: string[] = [];
  for (const style of stylePreference) {
    for (const palette of PALETTES_BY_STYLE[style] ?? []) {
      if (!out.includes(palette)) out.push(palette);
      if (out.length === 2) return out;
    }
  }
  return out;
}
