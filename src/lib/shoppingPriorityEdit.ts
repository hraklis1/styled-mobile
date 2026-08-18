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
  if (edit.status === 'ready' && edit.targets.length !== 3) throw new Error('Invalid Shopping Edit response');
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
