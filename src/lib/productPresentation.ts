import type { ProductOffer } from '../types/commerce';

/** Only domain-only merchant labels are cleaned; editorial names remain intact. */
export function productMerchantLabel(merchant: string): string {
  const value = merchant.trim();
  const domain = value.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*?)\.(?:com|ca|co\.uk|co|net|org|uk|us|fr|de|it|au|com\.au)\/?$/i);
  return domain ? domain[1] : value;
}

export function productDisplayTitle(offer: Pick<ProductOffer, 'title' | 'brand'> & { merchant?: string }): string {
  for (const prefix of [offer.brand, offer.merchant && productMerchantLabel(offer.merchant)]) {
    const stripped = stripLeading(offer.title, prefix?.trim());
    if (stripped !== offer.title) return stripped;
  }
  return offer.title;
}

/**
 * Drops a leading name only when a separator follows it, so "COSMIC" survives
 * "COS". Letters and digits must match in order; punctuation and invisible
 * characters may differ ("H&M" vs "H＆M", "H & M").
 */
function stripLeading(title: string, name: string | undefined): string {
  const wanted = name?.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (!wanted) return title;
  let matched = 0, end = 0;
  for (const char of title) {
    end += char.length;
    if (!/[\p{L}\p{N}]/u.test(char)) { if (matched === 0 && !/[\s\p{Cf}]/u.test(char)) return title; continue; }
    if (char.toLowerCase() !== wanted[matched]) return title;
    if (++matched === wanted.length) break;
  }
  if (matched < wanted.length) return title;
  const remainder = title.slice(end);
  if (!/^[\s:–—-]/.test(remainder)) return title;
  return remainder.replace(/^[\s:–—-]+/, '') || title;
}

/**
 * A shorter title for an editorial product card. The detail view keeps the
 * full `productDisplayTitle` (sizes and all); a card only needs to name the
 * piece, so a leading gender department and a trailing size token go.
 */
export function productCardTitle(offer: Pick<ProductOffer, 'title' | 'brand'> & { merchant?: string }): string {
  const full = productDisplayTitle(offer);
  // Departments come off first, so a brand behind them ("Men H&M Black…") is exposed and removed too.
  const undepartmented = offer.title.replace(/^(?:wo)?men(?:'s|s)?(?=\s|$)\s*/i, '');
  const cleaned = (undepartmented ? productDisplayTitle({ ...offer, title: undepartmented }) : full)
    .replace(/\s+(size\s+\S+|w\d{2}\s*l\d{2}|\d{2}[slr]|xx?[sl]|[sml])$/i, '')
    .trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : full;
}

export function productListingAction(offer: ProductOffer): string {
  try {
    if (/(^|\.)google\.[a-z.]+$/.test(new URL(offer.url).hostname)) return 'View listing';
    return `Shop at ${productMerchantLabel(offer.merchant) || 'retailer'}`;
  } catch { return 'View listing'; }
}
/**
 * Whether a price sits inside a suggested budget like "$80–180 CAD". Null when
 * either side can't be read with confidence (mismatched or unknown currency).
 */
export function priceFitsBudget(offer: Pick<ProductOffer, 'price' | 'currency'>, budget: string | null | undefined): boolean | null {
  if (!budget || offer.price == null) return null;
  const range = budget.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*[–—-]\s*\D{0,3}?(\d+(?:\.\d+)?)/);
  const code = budget.match(/\b([A-Z]{3})\b/)?.[1];
  if (!range || !code || code !== offer.currency.toUpperCase()) return null;
  const [low, high] = [Number(range[1]), Number(range[2])];
  // Cheaper than the band is not "over budget" — say nothing rather than mislabel it.
  if (offer.price < low) return null;
  return offer.price <= high;
}
export const productKey = (offer: ProductOffer) => `${offer.provider}:${offer.id}`;
export const productDisclosure = 'We may earn a commission on these links. It never affects what we recommend.';
