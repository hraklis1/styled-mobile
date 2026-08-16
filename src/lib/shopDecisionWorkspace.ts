import type { ShoppingEditItem } from './shoppingGallery';
import type { StylistMode } from '../features/stylist/types';

export function buildShopStylistLaunch(initialQuery: string, initialMode: StylistMode = 'advice') {
  return { initialQuery, initialMode, source: 'shop' as const };
}

export type ShoppingBriefReason = 'weather' | 'occasion' | 'wardrobe_gap' | 'ratio_imbalance';

export type ShoppingBriefPriority = {
  label: string;
  category: string;
  reason: ShoppingBriefReason;
  context: string;
  priority: number;
  unlocks: string[];
};

export type ShoppingBrief = {
  status: 'ready' | 'balanced' | 'insufficient_data';
  headline: string;
  summary: string;
  generatedAt: string;
  source: 'model' | 'rules';
  priorities: ShoppingBriefPriority[];
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

