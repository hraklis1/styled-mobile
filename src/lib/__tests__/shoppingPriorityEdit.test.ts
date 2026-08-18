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

test('accepts a reconciled no-buy with the updated parent brief', () => {
  const updatedBrief = {
    status: 'balanced' as const,
    headline: 'Your wardrobe is well covered',
    summary: 'The blazer priority was removed because an owned piece already fills that role.',
    generatedAt: new Date().toISOString(),
    source: 'rules' as const,
    priorities: [],
  };
  const edit = parseShoppingPriorityEdit({
    status: 'no_buy',
    headline: 'Tailored blazer',
    summary: 'Your current tailoring already covers this need.',
    generatedAt: new Date().toISOString(),
    priority,
    targets: [],
    noBuyReason: 'An owned blazer already covers professional settings.',
    briefUpdated: true,
    updatedBrief,
  });

  expect(edit.briefUpdated).toBe(true);
  expect(edit.updatedBrief).toEqual(updatedBrief);
});

test('rejects a brief-updated response without its replacement brief', () => {
  expect(() => parseShoppingPriorityEdit({
    status: 'no_buy',
    headline: 'Updated',
    summary: 'The priority changed.',
    generatedAt: new Date().toISOString(),
    priority,
    targets: [],
    noBuyReason: 'Already covered.',
    briefUpdated: true,
  })).toThrow('Invalid Shopping Edit response');
});

test('rejects partial ready edits', () => {
  expect(() => parseShoppingPriorityEdit({
    status: 'ready', headline: 'Start', summary: 'Only one.', generatedAt: new Date().toISOString(), priority,
    targets: [target('a')], noBuyReason: null,
  })).toThrow();
});
