import { parseShoppingPriorityEdit } from '../shoppingPriorityEdit';

const priority = {
  label: 'Everyday trousers',
  category: 'trousers',
  reason: 'wardrobe_gap' as const,
  context: 'A dependable foundation would unlock more weekday combinations.',
  priority: 1,
  unlocks: ['weekday dressing'],
};

const target = (key: string) => ({
  key,
  title: `${key} trouser`,
  category: 'trousers',
  color: 'charcoal',
  material: 'wool blend',
  silhouette: 'straight leg',
  priceRange: '$150–$250',
  retailerExamples: ['COS'],
  rationale: 'A versatile foundation.',
  unlocks: ['workwear'],
  pairsWithItemIds: [12],
});

test('accepts exactly three ready targets', () => {
  expect(parseShoppingPriorityEdit({
    status: 'ready', headline: 'Start with trousers', summary: 'Three directions.', generatedAt: new Date().toISOString(), priority,
    targets: [target('a'), target('b'), target('c')], noBuyReason: null,
  }).targets).toHaveLength(3);
});

test('accepts no-buy without target cards', () => {
  expect(parseShoppingPriorityEdit({
    status: 'no_buy', headline: 'You can wait', summary: 'Your wardrobe is covered.', generatedAt: new Date().toISOString(), priority,
    targets: [], noBuyReason: 'You already have this covered.',
  }).status).toBe('no_buy');
});

test('rejects partial ready edits', () => {
  expect(() => parseShoppingPriorityEdit({
    status: 'ready', headline: 'Start', summary: 'Only one.', generatedAt: new Date().toISOString(), priority,
    targets: [target('a')], noBuyReason: null,
  })).toThrow();
});
