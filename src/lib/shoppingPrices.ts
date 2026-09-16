export type ShoppingPriceCandidate = {
  amount: number;
  currencyCode: string | null;
  label: string;
};
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  GB: 'GBP',
  JP: 'JPY',
  CN: 'CNY',
  CH: 'CHF',
  IN: 'INR',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  GR: 'EUR',
  PT: 'EUR',
  IE: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  FI: 'EUR',
};
export function suggestedShoppingCurrency(
  country?: string | null,
  home?: string,
): string | null {
  return COUNTRY_CURRENCY[country?.toUpperCase() ?? ''] ?? home ?? null;
}
export function parseShoppingAmount(raw: string): number | null {
  let value = raw.replace(/[\s'’]/g, '');
  const last = Math.max(value.lastIndexOf(','), value.lastIndexOf('.'));
  if (last >= 0 && value.length - last - 1 <= 2)
    value =
      value.slice(0, last).replace(/[,.]/g, '') + '.' + value.slice(last + 1);
  else value = value.replace(/[,.]/g, '');
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
export function shoppingPriceCandidates(
  text: string,
  country?: string | null,
): ShoppingPriceCandidate[] {
  const marker =
    '(?:USD|CAD|AUD|NZD|GBP|EUR|JPY|CNY|CHF|INR|US\\$|CA\\$|A\\$|NZ\\$|[$£€¥₹])';
  const amount = "(?:\\d{1,3}(?:[ ,.'’]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?";
  const regex = new RegExp(
    `(${marker})\\s*(${amount})|(${amount})\\s*(${marker})`,
    'gi',
  );
  const found: ShoppingPriceCandidate[] = [];
  for (const match of text.matchAll(regex)) {
    const token = (match[1] ?? match[4]).toUpperCase();
    const value = parseShoppingAmount(match[2] ?? match[3]);
    const explicit: Record<string, string> = {
      US$: 'USD',
      CA$: 'CAD',
      A$: 'AUD',
      NZ$: 'NZD',
      '£': 'GBP',
      '€': 'EUR',
      '₹': 'INR',
    };
    const local = suggestedShoppingCurrency(country);
    const currencyCode =
      explicit[token] ??
      (/^[A-Z]{3}$/.test(token)
        ? token
        : token === '$' && ['USD', 'CAD', 'AUD', 'NZD'].includes(local ?? '')
          ? local
          : token === '¥' && ['JPY', 'CNY'].includes(local ?? '')
            ? local
            : null);
    if (
      value !== null &&
      !found.some(
        (item) => item.amount === value && item.currencyCode === currencyCode,
      )
    )
      found.push({ amount: value, currencyCode, label: match[0].trim() });
  }
  return found;
}
