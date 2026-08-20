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
  // Commerce seam — unpopulated until a product-matching layer (Sovrn
  // Commerce) exists server-side. Field names match ShopOutfitItem in
  // src/types/shop.ts. See ShoppingPriorityTargetCard for the tappable
  // "Where to look" row this enables.
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
  // server/shoppingPriorityEdit.ts, done ahead of real product results
  // (Sovrn) making a fixed count impossible. Still always 3 today.
  if (edit.status === 'ready' && (edit.targets.length < 1 || edit.targets.length > 5)) throw new Error('Invalid Shopping Edit response');
  if (edit.status === 'no_buy' && edit.targets.length !== 0) throw new Error('Invalid Shopping Edit response');
  const updatedBrief = edit.updatedBrief == null ? undefined : parseShoppingBrief(edit.updatedBrief);
  if (edit.briefUpdated === true && (edit.status !== 'no_buy' || !updatedBrief)) {
    throw new Error('Invalid Shopping Edit response');
  }
  if (edit.briefUpdated !== true && updatedBrief) throw new Error('Invalid Shopping Edit response');
  return {
    ...edit,
    noBuyReason: edit.noBuyReason ?? null,
    ...(updatedBrief ? { updatedBrief } : {}),
  } as ShoppingPriorityEdit;
}
