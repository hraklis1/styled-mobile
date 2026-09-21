import type { ShoppingPreviewPrice, ShoppingVisitPreview } from '../stores/useShoppingSessionStore';
import type { ShoppingPriceCandidate } from './shoppingPrices';

export type CaptureItemPrice = {
  amount: number | null;
  currencyCode: string | null;
  status: 'resolved' | 'ambiguous' | 'missing' | 'reading';
  /** Every price read across the item's photos, for the one-tap chooser. */
  candidates: ShoppingPriceCandidate[];
  /** Chosen by the markdown heuristic; the alternatives are worth showing. */
  inferred: boolean;
  /** The user already picked a price for this item. */
  confirmed: boolean;
};

function uniqueCandidates(candidates: ShoppingPriceCandidate[]): ShoppingPriceCandidate[] {
  const result: ShoppingPriceCandidate[] = [];
  for (const candidate of candidates) {
    if (!result.some((value) => value.amount === candidate.amount && value.currencyCode === candidate.currencyCode)) {
      result.push(candidate);
    }
  }
  return result;
}

/**
 * The price the camera shows for one item stack while the shopper is still
 * in the store. A price the user tapped wins; otherwise the tag photos'
 * readings, then any other photo's. One agreeing reading is the price;
 * disagreeing photos, or a photo that could not decide, ask for a tap.
 */
export function captureItemPrice(
  previews: ShoppingVisitPreview[],
  override?: { amount: number; currencyCode: string | null } | null,
): CaptureItemPrice {
  const candidates = uniqueCandidates(previews.flatMap((preview) => preview.price?.candidates ?? []));
  if (override) {
    return { amount: override.amount, currencyCode: override.currencyCode, status: 'resolved', candidates, inferred: false, confirmed: true };
  }
  const read = previews.filter((preview): preview is ShoppingVisitPreview & { price: ShoppingPreviewPrice } => Boolean(preview.price));
  const tags = read.filter((preview) => preview.captureRole === 'tag');
  const sources = tags.length ? tags : read;
  const resolved = uniqueCandidates(sources
    .filter((preview) => preview.price.status === 'resolved' && preview.price.amount !== null)
    .map((preview) => ({ amount: preview.price.amount!, currencyCode: preview.price.currencyCode, label: '' })));
  const ambiguous = sources.some((preview) => preview.price.status === 'ambiguous');
  if (resolved.length === 1 && !ambiguous) {
    const inferred = sources.some((preview) => preview.price.inferred);
    return { amount: resolved[0].amount, currencyCode: resolved[0].currencyCode, status: 'resolved', candidates, inferred, confirmed: false };
  }
  if (resolved.length > 1 || ambiguous) {
    return { amount: null, currencyCode: null, status: 'ambiguous', candidates, inferred: false, confirmed: false };
  }
  const reading = previews.some((preview) => preview.ocrStatus === 'processing');
  return { amount: null, currencyCode: null, status: reading ? 'reading' : 'missing', candidates, inferred: false, confirmed: false };
}
