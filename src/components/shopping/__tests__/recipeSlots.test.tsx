import { recipeSlots } from '../../../lib/outfitRecipeOrder';

const item = (id: number, category: string | null) => ({ id, category }) as any;

it('orders a look head to toe with the new piece where it is worn', () => {
  const pieces = [item(1, 'shoes'), item(2, 'bottom'), item(3, 'outerwear'), item(4, 'accessory')];
  const order = recipeSlots({ category: 'top' } as any, pieces).map(s => (s.kind === 'new' ? 'new' : s.item.id));
  expect(order).toEqual([3, 'new', 2, 1, 4]);
});

it('puts the new piece ahead of owned pieces in its own category', () => {
  const order = recipeSlots({ category: 'shoes' } as any, [item(1, 'shoes')]).map(s => s.kind);
  expect(order).toEqual(['new', 'owned']);
});
