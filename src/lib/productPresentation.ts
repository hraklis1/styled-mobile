import type { ProductOffer } from '../types/commerce';

/** Only domain-only merchant labels are cleaned; editorial names remain intact. */
export function productMerchantLabel(merchant: string): string {
  const value = merchant.trim();
  const domain = value.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*?)\.(?:com|ca|co\.uk|co|net|org|uk|us|fr|de|it|au|com\.au)\/?$/i);
  return domain ? domain[1] : value;
}

export function productDisplayTitle(offer: Pick<ProductOffer, 'title' | 'brand'>): string {
  const brand = offer.brand?.trim();
  if (!brand || !offer.title.toLowerCase().startsWith(brand.toLowerCase())) return offer.title;
  const remainder = offer.title.slice(brand.length);
  if (!/^[\s:–—-]/.test(remainder)) return offer.title;
  return remainder.replace(/^[\s:–—-]+/, '') || offer.title;
}

export function productListingAction(offer: ProductOffer): string {
  try {
    if (/(^|\.)google\.[a-z.]+$/.test(new URL(offer.url).hostname)) return 'View listing';
    return `Shop at ${productMerchantLabel(offer.merchant) || 'retailer'}`;
  } catch { return 'View listing'; }
}
export const productKey = (offer: ProductOffer) => `${offer.provider}:${offer.id}`;
export const productDisclosure = 'We may earn a commission on these links. It never affects what we recommend.';
