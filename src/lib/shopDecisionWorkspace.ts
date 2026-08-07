import type { ShoppingEditItem } from './shoppingGallery';
import type { StylistMode } from '../features/stylist/types';

export type ShopConsultationTopic =
  | 'next_purchase'
  | 'brief_review'
  | 'focused_list'
  | 'review_find'
  | 'custom';

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

export function buildShopConsultationPrompt(
  topic: ShopConsultationTopic,
  brief?: ShoppingBrief | null,
): string | undefined {
  switch (topic) {
    case 'next_purchase':
      return 'Help me decide which single purchase would genuinely improve my wardrobe most. Consider wardrobe gaps, versatility, local weather, and what I already own; recommend buying nothing if that is the best answer.';
    case 'brief_review': {
      if (!brief) {
        return 'Review my current wardrobe and pressure-test my shopping priorities. Remove anything unnecessary and tell me what, if anything, to address first.';
      }
      const priorities = brief.priorities.map((priority) => priority.label).join(', ');
      const priorityContext = priorities ? ` Priorities: ${priorities}.` : '';
      return `Review my current Shopping Brief. It says: "${brief.headline}" ${brief.summary}${priorityContext} Pressure-test these priorities, remove anything unnecessary, and tell me what to address first.`;
    }
    case 'focused_list':
      return 'Build me a focused shopping list of no more than five additions. Avoid duplicates, prioritize versatility and real wardrobe gaps, and explain what each piece unlocks. Recommend a shorter list—or nothing—if appropriate.';
    case 'review_find':
    case 'custom':
      return undefined;
  }
}

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

