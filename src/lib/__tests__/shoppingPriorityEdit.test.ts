import {
  parseShoppingPriorityEdit,
  shoppingPriorityEditDisplayHeadline,
  shoppingPriorityGapStatement,
} from '../shoppingPriorityEdit';

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

test('accepts a single ready target — widened from an exact 3 to a 1-5 range ahead of real product results', () => {
  expect(parseShoppingPriorityEdit({
    status: 'ready', headline: 'Start', summary: 'Only one.', generatedAt: new Date().toISOString(), priority,
    targets: [target('a')], noBuyReason: null,
  }).targets).toHaveLength(1);
});

test('rejects a ready edit with no targets', () => {
  expect(() => parseShoppingPriorityEdit({
    status: 'ready', headline: 'Start', summary: 'None.', generatedAt: new Date().toISOString(), priority,
    targets: [], noBuyReason: null,
  })).toThrow();
});

test('rejects a ready edit past the widened five-target ceiling', () => {
  expect(() => parseShoppingPriorityEdit({
    status: 'ready', headline: 'Start', summary: 'Too many.', generatedAt: new Date().toISOString(), priority,
    targets: [target('a'), target('b'), target('c'), target('d'), target('e'), target('f')], noBuyReason: null,
  })).toThrow();
});

test('keeps concise display headlines and normalizes whitespace', () => {
  expect(shoppingPriorityEditDisplayHeadline('  Three   polished directions ', 'formal shirts')).toBe('Three polished directions');
});

test('falls back to the priority label for verbose legacy headlines', () => {
  expect(shoppingPriorityEditDisplayHeadline('Formal shirt options for the test event', 'formal shirt or blouse')).toBe('Formal shirt or blouse');
  expect(shoppingPriorityEditDisplayHeadline('A very long but restrained editorial headline', 'lightweight coat')).toBe('Lightweight coat');
});

describe('shoppingPriorityGapStatement', () => {
  test('does not repeat a label already included at the start of the context', () => {
    expect(shoppingPriorityGapStatement(
      'versatile mid-rise trousers',
      'Versatile mid-rise trousers would create 72 new outfits from pieces you already own.',
    )).toBe('Versatile mid-rise trousers would create 72 new outfits from pieces you already own.');
  });

  test('joins a lowercase context fragment to the sentence-cased priority label', () => {
    expect(shoppingPriorityGapStatement(
      'formal shirt or blouse',
      'to meet the formal dress code.',
    )).toBe('Formal shirt or blouse to meet the formal dress code.');
  });

  test('separates a complete capitalized context without rewriting it', () => {
    expect(shoppingPriorityGapStatement(
      'everyday trousers',
      'A dependable foundation would unlock more weekday combinations.',
    )).toBe('Everyday trousers. A dependable foundation would unlock more weekday combinations.');
  });

  test('normalizes repeated whitespace and falls back to the label for empty context', () => {
    expect(shoppingPriorityGapStatement(
      '  formal   shirt or blouse ',
      '  to   meet the formal   dress code. ',
    )).toBe('Formal shirt or blouse to meet the formal dress code.');
    expect(shoppingPriorityGapStatement('  everyday   trousers ', '   ')).toBe('Everyday trousers');
  });
});
