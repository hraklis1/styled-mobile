import type { ShoppingEditItem } from './shoppingGallery';
import type { StylistMode } from '../features/stylist/types';

export function buildShopStylistLaunch(initialQuery: string, initialMode: StylistMode = 'advice') {
  return { initialQuery, initialMode, source: 'shop' as const };
}

export type ShoppingBriefReason = 'weather' | 'occasion' | 'wardrobe_gap' | 'ratio_imbalance';

/** How the server found this candidate. 'structural'/'occasion' are an
 *  absent category or an unbuildable event outfit; the rest come from the
 *  wardrobe-versatility engine and answer "what would unlock the most"
 *  instead — see server/shoppingOpportunities.ts. Optional and rendered
 *  permissively: an unrecognized value (older app build, newer server kind)
 *  should fall back to a default icon/framing, never fail to render. */
export type ShoppingBriefOpportunityKind =
  | 'structural'
  | 'occasion'
  | 'multiplier'
  | 'bridge'
  | 'occasion_coverage'
  | 'seasonal'
  | 'starter_capsule'
  | 'replacement'
  | 'occasion_ladder';

export type ShoppingBriefPriority = {
  /** Stable server-side verified gap identity used to reconcile edits. */
  candidateKey?: string;
  label: string;
  category: string;
  reason: ShoppingBriefReason;
  kind?: ShoppingBriefOpportunityKind | (string & {});
  context: string;
  priority: number;
  unlocks: string[];
  anchorItemIds?: number[];
  formality?: string;
  silhouette?: string;
  material?: string;
  preferredColors?: string[];
  /** Outfit combinations this candidate would add, when computed — the
   *  wardrobe-multiplier signal. Not present on structural/occasion
   *  candidates, which have no comparable count. */
  impactScore?: number;
  recommendationKey?: string;
  scope?: 'general' | 'event';
  eventId?: number;
  eventTitle?: string;
};

export type ShoppingBrief = {
  status: 'ready' | 'balanced' | 'insufficient_data';
  headline: string;
  summary: string;
  generatedAt: string;
  source: 'model' | 'rules';
  priorities: ShoppingBriefPriority[];
  localDate?: string;
  updatedAt?: string;
  /** Set only on a "balanced" brief where real candidates exist but are all
   *  currently on cooldown — lets the UI say what's coming back instead of
   *  going quiet. */
  nextUp?: { label: string; availableOn: string };
};

export function parseShoppingBrief(value: unknown): ShoppingBrief {
  if (!value || typeof value !== 'object') throw new Error('Invalid Shopping Brief response');
  const brief = value as Partial<ShoppingBrief>;
  if (
    !['ready', 'balanced', 'insufficient_data'].includes(brief.status ?? '')
    || typeof brief.headline !== 'string'
    || typeof brief.summary !== 'string'
    || typeof brief.generatedAt !== 'string'
    || !['model', 'rules'].includes(brief.source ?? '')
    || !Array.isArray(brief.priorities)
  ) {
    throw new Error('Invalid Shopping Brief response');
  }
  return brief as ShoppingBrief;
}

export function selectActiveShoppingFinds(items: ShoppingEditItem[], limit = 4): ShoppingEditItem[] {
  return items
    .filter((item) => item.catalogStatus === 'considering' || item.catalogStatus === 'wishlist')
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      if (a.catalogStatus !== b.catalogStatus) return a.catalogStatus === 'wishlist' ? -1 : 1;
      return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
    })
    .slice(0, limit);
}
