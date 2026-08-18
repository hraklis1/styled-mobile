import type { ShoppingBriefPriority } from './shopDecisionWorkspace';

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
};

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
  ) throw new Error('Invalid Shopping Edit response');
  if (edit.status === 'ready' && edit.targets.length !== 3) throw new Error('Invalid Shopping Edit response');
  if (edit.status === 'no_buy' && edit.targets.length !== 0) throw new Error('Invalid Shopping Edit response');
  return { ...edit, noBuyReason: edit.noBuyReason ?? null } as ShoppingPriorityEdit;
}
