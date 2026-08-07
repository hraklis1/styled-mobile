import { selectActiveShoppingFinds } from './shopDecisionWorkspace';
import { summarizeShoppingEditItems, type ShoppingEditItem } from './shoppingGallery';
import { buildShoppingSessionGroups, type ShoppingSessionGroup } from './shoppingSessionGroups';

/** A rail, not a gallery: past eight cards the user should be in the gallery. */
const RAIL_LIMIT = 8;

/**
 * What the Shop and Home screens need to advertise the shortlist without
 * loading the whole gallery: how much is in it, the trip to show, and what is
 * still waiting on the user.
 */
export type ShortlistSpotlight = {
  itemCount: number;
  storeCount: number;
  needsPriceCount: number;
  /** Considering and wishlist finds, most deserving of a decision first. */
  awaitingDecision: ShoppingEditItem[];
  /**
   * What Shop's carousel shows: the finds awaiting a decision, then the settled
   * ones newest-first, so the rail opens on work and still proves the rest is
   * kept. Capped — `itemCount` remains the total behind it.
   */
  railItems: ShoppingEditItem[];
  /** Store names behind those finds, deduplicated, at most three. */
  decisionStores: string[];
  latestTrip: ShoppingSessionGroup | null;
  statLine: string;
};

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildShortlistSpotlight(items: ShoppingEditItem[], now = new Date()): ShortlistSpotlight {
  const summary = summarizeShoppingEditItems(items);
  const awaitingDecision = selectActiveShoppingFinds(items, items.length);
  const decisionStores: string[] = [];

  for (const item of awaitingDecision) {
    if (!item.storeName || decisionStores.includes(item.storeName)) continue;
    if (decisionStores.length === 3) break;
    decisionStores.push(item.storeName);
  }

  const decided = items
    .filter((item) => !awaitingDecision.some((find) => find.id === item.id))
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());

  const statLine = [
    countLabel(summary.itemCount, 'piece'),
    summary.storeCount > 0 ? countLabel(summary.storeCount, 'store') : null,
    summary.missingPriceItemCount > 0 ? `${summary.missingPriceItemCount} need${summary.missingPriceItemCount === 1 ? 's' : ''} a price` : null,
  ].filter((part): part is string => part !== null).join(' · ');

  return {
    itemCount: summary.itemCount,
    storeCount: summary.storeCount,
    needsPriceCount: summary.missingPriceItemCount,
    awaitingDecision,
    railItems: [...awaitingDecision, ...decided].slice(0, RAIL_LIMIT),
    decisionStores,
    latestTrip: buildShoppingSessionGroups(items, now)[0] ?? null,
    statLine,
  };
}
