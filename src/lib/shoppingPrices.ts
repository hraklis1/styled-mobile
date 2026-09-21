import type { ShoppingSnap } from '../types/shoppingSnap';

export type ShoppingPriceCandidate = {
  amount: number;
  currencyCode: string | null;
  label: string;
  kind?: 'current' | 'original';
  /** The photo (snap id) the candidate was read from, when known. */
  sourceId?: string;
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
const MARKER = '(?:(?:USD|CAD|AUD|NZD|GBP|EUR|JPY|CNY|CHF|INR)(?:[ \\t]*\\$)?|US\\s*\\$|CAN?\\s*\\$|AU?\\s*\\$|NZ\\s*\\$|UK\\s*£|EU\\s*€|[$£€¥₹])';
const AMOUNT = "(?:\\d{1,3}(?:[ ,.'’]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?";
const BARE_PRICE_LABEL = '(?:sale\\s+price|current\\s+price|original\\s+price|regular\\s+price|price|now|was|rrp|msrp)';
const PRICE_LABEL = '(?:sale(?:\\s+price)?|now|current(?:\\s+price)?|price|was|original(?:\\s+price)?|regular(?:\\s+price)?|rrp|msrp)';

function currencyForMarker(marker: string | undefined, country?: string | null, home?: string | null): string | null {
  const token = marker?.toUpperCase().replace(/\s/g, '').replace(/^(USD|CAD|AUD|NZD)\$$/, '$1');
  const explicit: Record<string, string> = {
    'US$': 'USD', 'CA$': 'CAD', 'CAN$': 'CAD', 'UK£': 'GBP', 'EU€': 'EUR', 'AU$': 'AUD', 'A$': 'AUD', 'NZ$': 'NZD',
    '£': 'GBP', '€': 'EUR', '₹': 'INR',
  };
  const local = suggestedShoppingCurrency(country, home ?? undefined);
  if (!token) return null;
  return explicit[token] ?? (/^[A-Z]{3}$/.test(token) ? token
    : token === '$' && ['USD', 'CAD', 'AUD', 'NZD'].includes(local ?? '') ? local
      : token === '¥' && ['JPY', 'CNY'].includes(local ?? '') ? local : null);
}

function uniqueCandidates(candidates: ShoppingPriceCandidate[]): ShoppingPriceCandidate[] {
  const result: ShoppingPriceCandidate[] = [];
  for (const candidate of candidates) {
    const existing = result.find((value) => value.amount === candidate.amount && value.currencyCode === candidate.currencyCode);
    if (!existing) result.push({ ...candidate });
    else if (candidate.kind === 'current' || !existing.kind) existing.kind = candidate.kind;
  }
  return result;
}

// A line that is nothing but an amount with two decimals ("24.99", "129,00"):
// many tags print the price with no symbol at all.
const BARE_DECIMAL_LINE = /^[ \t]*((?:\d{1,3}(?:[ ,.'’]\d{3})+|\d+)[.,]\d{2})[ \t]*$/gm;

export function shoppingPriceCandidates(text: string, country?: string | null, home?: string | null): ShoppingPriceCandidate[] {
  const local = country || home ? suggestedShoppingCurrency(country, home ?? undefined) : null;
  // Consume a complete amount: never turn a percentage, SKU, or malformed
  // decimal into a valid price by accepting just its numeric prefix.
  const start = '(?<![\\w.,])';
  const end = '(?![\\w]|[.,]\\d|\\s*%)';
  const patterns = [
    { regex: new RegExp(`${start}(${MARKER})\\s*(${AMOUNT})${end}`, 'gi'), marker: 1, amount: 2 },
    { regex: new RegExp(`${start}(${AMOUNT})\\s*(${MARKER})${end}`, 'gi'), marker: 2, amount: 1 },
    { regex: new RegExp(`${start}\\b(${BARE_PRICE_LABEL})\\s*:?\\s*(${AMOUNT})${end}`, 'gi'), marker: 0, amount: 2 },
  ];
  const matches: { start: number; end: number; candidate: ShoppingPriceCandidate }[] = [];
  // Claim prefixed prices first. Otherwise a stray preceding OCR number can
  // steal the currency from "80 US $ 90", incorrectly yielding USD 80.
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.regex)) {
      const index = match.index;
      const endIndex = index + match[0].length;
      if (matches.some((other) => index < other.end && endIndex > other.start)) continue;
      const value = parseShoppingAmount(match[pattern.amount]);
      if (value === null) continue;
      const before = text.slice(0, index);
      const label = pattern.marker === 0 ? match[1]
        : before.match(new RegExp(`\\b(${PRICE_LABEL})\\s*:?\\s*$`, 'i'))?.[1];
      // Retail stickers commonly put "Final Sale" underneath the price.
      // Do not bind an ordinary following "Now" label to the previous price.
      const after = text.slice(endIndex);
      const finalSale = /^\s*final\s+sale[ \t]*(?:\r?\n|$)/i.test(after);
      const kind = finalSale || /^(sale|now|current)/i.test(label ?? '') ? 'current'
        : /^(was|original|regular|rrp|msrp)/i.test(label ?? '') ? 'original' : undefined;
      matches.push({ start: index, end: endIndex, candidate: {
        amount: value,
        // A labeled/bare amount has no symbol to identify its currency. Once
        // the photo location is known, the local currency is the safest
        // automatic default; explicit markers always win inside
        // currencyForMarker.
        currencyCode: pattern.marker ? currencyForMarker(match[pattern.marker], country, home) : local,
        label: match[0].trim(), kind,
      } });
    }
  }
  // Symbol-less prices are only trusted on a tag with other content: a lone
  // "29.99" could be anything, but "H&M / 24.99 / SIZE S" is a price.
  if (!matches.length && text.split(/\r?\n/).filter((line) => line.trim()).length >= 2) {
    for (const match of text.matchAll(BARE_DECIMAL_LINE)) {
      const value = parseShoppingAmount(match[1]);
      if (value === null) continue;
      matches.push({ start: match.index, end: match.index + match[0].length, candidate: {
        amount: value, currencyCode: local, label: match[1].trim(),
      } });
    }
  }
  const found = matches.sort((a, b) => a.start - b.start).map((match) => match.candidate);
  return uniqueCandidates(found);
}

export type ShoppingPriceResolution = {
  amount: number | null;
  currencyCode: string | null;
  candidates: ShoppingPriceCandidate[];
  status: 'resolved' | 'ambiguous' | 'missing';
  /** Chosen by heuristic (lowest of several unlabeled prices on one tag); the
   *  alternatives in `candidates` are worth one tap to swap. */
  inferred?: boolean;
};

export function resolveShoppingPrice(
  candidates: ShoppingPriceCandidate[],
  country?: string | null,
  correction?: { amount: number; currencyCode: string | null },
  home?: string | null,
): ShoppingPriceResolution {
  const all = uniqueCandidates(candidates);
  if (correction) return { ...correction, candidates: all, status: 'resolved' };
  let eligible = all;
  const local = suggestedShoppingCurrency(country, home ?? undefined);
  const currencies = new Set(all.map((candidate) => candidate.currencyCode));
  if (currencies.size > 1 && local && all.some((candidate) => candidate.currencyCode === local)) {
    eligible = all.filter((candidate) => candidate.currencyCode === local);
  }
  // A sale label cannot settle a conflict between different currencies.
  if (new Set(eligible.map((candidate) => candidate.currencyCode)).size === 1) {
    const current = eligible.filter((candidate) => candidate.kind === 'current');
    if (current.length) eligible = current;
  }
  let selected = eligible.length === 1 ? eligible[0] : null;
  let inferred = false;
  // Several unlabeled prices in one currency on the same photo is almost
  // always a markdown: the original struck through above the sale price.
  // Take the lowest; different photos disagreeing stays a real conflict.
  if (!selected && eligible.length > 1
    && new Set(eligible.map((candidate) => candidate.currencyCode)).size === 1
    && eligible.every((candidate) => !candidate.kind)
    && new Set(eligible.map((candidate) => candidate.sourceId)).size === 1) {
    selected = eligible.reduce((lowest, candidate) => candidate.amount < lowest.amount ? candidate : lowest);
    inferred = true;
  }
  return {
    amount: selected?.amount ?? null,
    // An amount whose symbol could not be placed stays "confirm currency"
    // rather than being relabelled in the local currency.
    currencyCode: selected ? selected.currencyCode : local,
    candidates: all,
    status: selected ? 'resolved' : all.length ? 'ambiguous' : 'missing',
    ...(inferred ? { inferred } : {}),
  };
}

/** Resolve one item or organizer stage without depending on its cover photo. */
export function resolveShoppingSnapPrices(snaps: ShoppingSnap[], home?: string | null): ShoppingPriceResolution {
  const corrected = snaps.find((snap) => snap.priceOverride != null);
  // The garment is often photographed at home while its tag was captured in
  // the shop (or the reverse). A cover photo's metadata must never override a
  // tag photo when choosing the currency for a price.
  const hasTag = snaps.some((snap) => snap.captureRole === 'tag');
  const country = snaps.find((snap) => snap.captureRole === 'tag' && snap.countryCode)?.countryCode
    // Once a tag exists, an unlocated garment cover must not become the
    // currency source for that tag. Fall back to other photos only for groups
    // that contain no classified tag yet.
    ?? (hasTag ? null : snaps.find((snap) => snap.captureRole !== 'garment' && snap.countryCode)?.countryCode
      ?? snaps.find((snap) => snap.countryCode)?.countryCode);
  const candidatesBySnap = snaps.map((snap) => ({
    snap,
    candidates: shoppingPriceCandidates(snap.rawOcrText, snap.countryCode ?? country, home)
      .map((candidate) => ({ ...candidate, sourceId: snap.id })),
  }));
  const saved = candidatesBySnap.filter(({ snap }) => snap.extractedPrice !== null);
  const savedTags = saved.filter(({ snap }) => snap.captureRole === 'tag');
  // Preserve saved amounts. For legacy rows without a price, recover from
  // OCR without changing the original text or writing back remote records.
  const candidates = saved.length
    ? (savedTags.length ? savedTags : saved).flatMap(({ snap, candidates: parsed }) => {
      const matches = parsed.filter((candidate) => candidate.amount === snap.extractedPrice);
      return matches.length ? matches.map((candidate) => ({ ...candidate, currencyCode: candidate.currencyCode ?? snap.currencyCode ?? null })) : [{ amount: snap.extractedPrice!, currencyCode: snap.currencyCode ?? null, label: String(snap.extractedPrice), sourceId: snap.id }];
    })
    : candidatesBySnap.flatMap(({ candidates: parsed }) => parsed);
  const priceResolution = resolveShoppingPrice(candidates, country, corrected ? {
    amount: corrected.priceOverride!, currencyCode: corrected.currencyCode ?? null,
  } : undefined, home);
  if (priceResolution.amount === null && !priceResolution.currencyCode && (country || home)) {
    priceResolution.currencyCode = suggestedShoppingCurrency(country, home ?? undefined);
  }
  // Keep all OCR choices available even when a saved amount takes priority.
  priceResolution.candidates = uniqueCandidates(candidatesBySnap.flatMap(({ candidates: parsed }) => parsed));
  return priceResolution;
}
