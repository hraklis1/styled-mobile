import type { Item } from '../types/item';
import type { ShoppingPriorityTarget } from './shoppingPriorityEdit';

/**
 * Pieces read the way you'd dress, outside in and head to toe: layer, top
 * (or a one-piece), bottom, shoes, then whatever finishes the look. Unknown
 * categories sit after the clothes rather than jumping the queue.
 */
const HEAD_TO_TOE = ['outerwear', 'top', 'full_body', 'bottom', 'shoes', 'accessory', 'valuables'];

function wearRank(category: string | null | undefined): number {
  const rank = HEAD_TO_TOE.indexOf(category ?? '');
  return rank === -1 ? HEAD_TO_TOE.indexOf('accessory') - 0.5 : rank;
}

type RecipeSlot = { kind: 'new' } | { kind: 'owned'; item: Item };

/**
 * The look in dressing order, with the new piece placed where it is worn.
 * Sorting is stable, so pieces of one category keep the stylist's order and
 * the new piece leads its own category.
 */
export function recipeSlots(target: ShoppingPriorityTarget, pieces: Item[]): RecipeSlot[] {
  const slots: { slot: RecipeSlot; rank: number }[] = [
    { slot: { kind: 'new' }, rank: wearRank(target.category) },
    ...pieces.map(item => ({ slot: { kind: 'owned' as const, item }, rank: wearRank(item.category) })),
  ];
  return slots.sort((a, b) => a.rank - b.rank).map(({ slot }) => slot);
}
