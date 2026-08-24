import { parseProductOffers, type ProductOffer } from '../types/commerce';
import {
  parseShoppingBrief,
  type ShoppingBrief,
  type ShoppingBriefPriority,
} from './shopDecisionWorkspace';

export type ShoppingPriorityTarget = {
  key: string;
  title: string;
  category: string;
  color: string;
  material: string;
  silhouette: string;
  priceRange: string;
  retailerExamples: string[];
  rationale: string;
  unlocks: string[];
  pairsWithItemIds: number[];
  // Commerce seam — populated by server/commerce once a product source is
  // configured. Real, buyable results for this target, best first; an empty
  // list is the normal resting state, never an error.
  offers?: ProductOffer[];
  // Flat projection of offers[0], kept because ShoppingPriorityTargetCard
  // reads these directly today. Field names match ShopOutfitItem in
  // src/types/shop.ts.
  // @deprecated Read `offers` instead; these go away with the offer carousel.
  imageUrl?: string;
  productUrl?: string;
  merchant?: string;
  price?: string;
};

export type ShoppingPriorityEdit = {
  status: 'ready' | 'no_buy';
  headline: string;
  summary: string;
  generatedAt: string;
  priority: ShoppingBriefPriority;
  targets: ShoppingPriorityTarget[];
  noBuyReason: string | null;
  briefUpdated?: boolean;
  updatedBrief?: ShoppingBrief;
};

function normalizeEditorialCopy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function shoppingPriorityGapStatement(label: string, context: string): string {
  const normalizedLabel = normalizeEditorialCopy(label);
  const normalizedContext = normalizeEditorialCopy(context);
  const sentenceCasedLabel = normalizedLabel
    ? normalizedLabel.charAt(0).toUpperCase() + normalizedLabel.slice(1)
    : '';

  if (!normalizedContext) return sentenceCasedLabel;
  if (!sentenceCasedLabel) {
    return normalizedContext.charAt(0).toUpperCase() + normalizedContext.slice(1);
  }
  const contextRemainder = normalizedContext.slice(normalizedLabel.length);
  if (
    normalizedLabel
    && normalizedContext.toLocaleLowerCase().startsWith(normalizedLabel.toLocaleLowerCase())
    && (contextRemainder.length === 0 || /^[\s.,:;!?—-]/.test(contextRemainder))
  ) {
    return normalizedContext;
  }
  if (/^[a-z]/.test(normalizedContext)) {
    return `${sentenceCasedLabel} ${normalizedContext}`;
  }

  const separator = /[.!?]$/.test(sentenceCasedLabel) ? ' ' : '. ';
  return `${sentenceCasedLabel}${separator}${normalizedContext}`;
}

export function shoppingPriorityEditDisplayHeadline(headline: string, priorityLabel: string): string {
  const candidate = normalizeEditorialCopy(headline);
  const wordCount = candidate ? candidate.split(' ').length : 0;
  if (candidate.length <= 42 && wordCount <= 5) return candidate;

  const fallback = normalizeEditorialCopy(priorityLabel);
  if (!fallback) return candidate;
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

export function parseShoppingPriorityEdit(value: unknown): ShoppingPriorityEdit {
  if (!value || typeof value !== 'object') throw new Error('Invalid Shopping Edit response');
  const edit = value as Partial<ShoppingPriorityEdit>;
  if (
    !['ready', 'no_buy'].includes(edit.status ?? '')
    || typeof edit.headline !== 'string'
    || typeof edit.summary !== 'string'
    || typeof edit.generatedAt !== 'string'
    || !edit.priority || typeof edit.priority !== 'object'
    || !Array.isArray(edit.targets)
    || (edit.noBuyReason != null && typeof edit.noBuyReason !== 'string')
    || (edit.briefUpdated != null && typeof edit.briefUpdated !== 'boolean')
  ) throw new Error('Invalid Shopping Edit response');
  // Widened from an exact 3 to a range — matches the backend relaxation in
  // server/shoppingPriorityEdit.ts, done ahead of real product results making
  // a fixed count impossible. Still always 3 today.
  if (edit.status === 'ready' && (edit.targets.length < 1 || edit.targets.length > 5)) throw new Error('Invalid Shopping Edit response');
  if (edit.status === 'no_buy' && edit.targets.length !== 0) throw new Error('Invalid Shopping Edit response');
  const updatedBrief = edit.updatedBrief == null ? undefined : parseShoppingBrief(edit.updatedBrief);
  if (edit.briefUpdated === true && (edit.status !== 'no_buy' || !updatedBrief)) {
    throw new Error('Invalid Shopping Edit response');
  }
  if (edit.briefUpdated !== true && updatedBrief) throw new Error('Invalid Shopping Edit response');
  // Offers are validated per-row and bad rows are dropped rather than failing
  // the edit — see parseProductOffers. A target with no offers still renders.
  const targets = (edit.targets as ShoppingPriorityTarget[]).map((target) => {
    const offers = parseProductOffers((target as { offers?: unknown }).offers);
    return offers.length > 0 ? { ...target, offers } : target;
  });

  return {
    ...edit,
    targets,
    noBuyReason: edit.noBuyReason ?? null,
    ...(updatedBrief ? { updatedBrief } : {}),
  } as ShoppingPriorityEdit;
}
