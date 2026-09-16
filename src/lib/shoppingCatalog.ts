import type {
  ShoppingFindCatalogPatch,
  ShoppingPurchaseDetails,
} from '../types/shoppingSnap';

export const PURCHASE_KEYS = [
  'productName',
  'brand',
  'productCode',
  'purchaseUrl',
  'priceOverride',
  'currencyCode',
  'coverPhotoId',
  'wardrobeItemId',
] as const;
export function purchaseDetails(
  value: ShoppingPurchaseDetails,
): ShoppingPurchaseDetails {
  return Object.fromEntries(
    PURCHASE_KEYS.map((key) => [key, value[key] ?? null]),
  );
}
export function validateShoppingPatch(patch: ShoppingFindCatalogPatch) {
  if (
    patch.priceOverride != null &&
    (!Number.isFinite(patch.priceOverride) || patch.priceOverride < 0)
  )
    throw new Error('Enter a price of zero or more.');
  if (patch.currencyCode && !/^[A-Z]{3}$/.test(patch.currencyCode))
    throw new Error('Enter a three-letter currency, such as CAD.');
  if (patch.currencyCode) {
    try {
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency: patch.currencyCode,
      });
    } catch {
      throw new Error('Enter a valid currency code.');
    }
  }
  if (patch.purchaseUrl) {
    try {
      const url = new URL(patch.purchaseUrl);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname)
        throw new Error();
    } catch {
      throw new Error('Use a complete http or https purchase link.');
    }
  }
}
export const CATALOG_COLUMNS: Record<string, string> = {
  category: 'category',
  sizeLabel: 'size_label',
  colorLabel: 'color_label',
  materialLabel: 'material_label',
  notes: 'notes',
  isFavorite: 'is_favorite',
  catalogStatus: 'catalog_status',
};
export function catalogPayload(
  patch: ShoppingFindCatalogPatch,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [
      CATALOG_COLUMNS[key] ?? key,
      value,
    ]),
  );
}
