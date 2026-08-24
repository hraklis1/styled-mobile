/**
 * Client mirror of server/commerce/types.ts.
 *
 * The app never learns which product source is behind an offer — that is the
 * entire point of the seam. Render `offers`, honour `monetized` for the
 * affiliate disclosure, and treat an empty list as the normal resting state
 * rather than an error.
 */
export type CommerceProviderName = 'none' | 'serpapi' | 'ebay' | 'skimlinks' | 'catalog';

export type ProductOffer = {
  /** Stable within a provider — safe to use as a list key. */
  id: string;
  provider: CommerceProviderName;
  title: string;
  brand: string | null;
  merchant: string;
  price: number | null;
  currency: string;
  /** Pre-formatted by the server; the client does no currency logic. */
  formattedPrice: string;
  imageUrl: string | null;
  url: string;
  inStock: boolean | null;
  /**
   * True when the link earns a commission. Any surface showing a monetized
   * offer must show the affiliate disclosure; surfaces with none must not.
   */
  monetized: boolean;
};

/**
 * Drop anything malformed instead of throwing.
 *
 * Products decorate a wardrobe decision that is valid without them, so a bad
 * offer row must degrade to "no products" and never fail the Shopping Edit
 * around it.
 */
export function parseProductOffers(value: unknown): ProductOffer[] {
  if (!Array.isArray(value)) return [];
  const offers: ProductOffer[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const offer = raw as Record<string, unknown>;
    if (
      typeof offer.id !== 'string' || !offer.id
      || typeof offer.title !== 'string' || !offer.title
      || typeof offer.merchant !== 'string'
      || typeof offer.url !== 'string' || !offer.url.startsWith('https://')
      || typeof offer.currency !== 'string'
      || typeof offer.formattedPrice !== 'string'
      || typeof offer.monetized !== 'boolean'
    ) continue;
    offers.push({
      id: offer.id,
      provider: (typeof offer.provider === 'string' ? offer.provider : 'none') as CommerceProviderName,
      title: offer.title,
      brand: typeof offer.brand === 'string' ? offer.brand : null,
      merchant: offer.merchant,
      price: typeof offer.price === 'number' && Number.isFinite(offer.price) ? offer.price : null,
      currency: offer.currency,
      formattedPrice: offer.formattedPrice,
      imageUrl: typeof offer.imageUrl === 'string' && offer.imageUrl.startsWith('https://') ? offer.imageUrl : null,
      url: offer.url,
      inStock: typeof offer.inStock === 'boolean' ? offer.inStock : null,
      monetized: offer.monetized,
    });
  }
  return offers;
}
