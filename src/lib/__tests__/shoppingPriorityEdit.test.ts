import {
  humanizeInlineTokens,
  parseShoppingPriorityEdit,
  shoppingPriorityEditDisplayHeadline,
  shoppingPriorityGapNarrative,
  shoppingPriorityGapStatement,
  splitPriceRange,
  targetOutfitIdeas,
  type ShoppingPriorityTarget,
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
  outfitIdeas: [{ label: 'With tailoring', itemIds: [12, 13] }],
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

describe('shoppingPriorityGapNarrative', () => {
  test('lifts the ladder step out and drops the label the sentence already implies', () => {
    expect(shoppingPriorityGapNarrative(
      'tailored dress trousers',
      'You own Oxford Shoes and Suit Jacket for business casual occasions but cannot build a complete business casual outfit yet. Step 1 of 2: tailored dress trousers.',
    )).toEqual({
      voice: 'You own Oxford Shoes and Suit Jacket for business casual occasions but cannot build a complete business casual outfit yet.',
      step: { current: 1, total: 2 },
    });
  });

  test('keeps the label when the context is only a fragment', () => {
    expect(shoppingPriorityGapNarrative('formal shirt or blouse', 'to meet the formal dress code.')).toEqual({
      voice: 'Formal shirt or blouse to meet the formal dress code.',
      step: null,
    });
  });

  test('leaves a context that already opens with the label untouched', () => {
    expect(shoppingPriorityGapNarrative(
      'versatile mid-rise trousers',
      'Versatile mid-rise trousers would create 72 new outfits from pieces you already own.',
    )).toEqual({
      voice: 'Versatile mid-rise trousers would create 72 new outfits from pieces you already own.',
      step: null,
    });
  });

  test('falls back to the label when there is no context to speak', () => {
    expect(shoppingPriorityGapNarrative('  everyday   trousers ', '   ')).toEqual({
      voice: 'Everyday trousers',
      step: null,
    });
  });

  test('drops a trailing clause that only restates the impact stat', () => {
    expect(shoppingPriorityGapNarrative(
      'sleek evening shoes',
      'Your wardrobe is thin for night out occasions — sleek evening shoes would add 9 new outfits.',
      { impactScore: 9 },
    )).toEqual({
      voice: 'Your wardrobe is thin for night out occasions.',
      step: null,
    });

    expect(shoppingPriorityGapNarrative(
      'sleek evening shoes',
      "Sleek evening shoes would connect your night out and smart casual pieces, creating 9 new outfits that don't exist yet.",
      { impactScore: 9 },
    )).toEqual({
      voice: 'Sleek evening shoes would connect your night out and smart casual pieces.',
      step: null,
    });
  });

  test('keeps the figure when it is the whole sentence, or is not on screen as a stat', () => {
    const multiplier = 'Sleek evening shoes would create 9 new outfits from pieces you already own.';
    // Nothing severable — cutting the clause would leave no sentence at all.
    expect(shoppingPriorityGapNarrative('sleek evening shoes', multiplier, { impactScore: 9 }).voice).toBe(multiplier);

    // No stat rendered, so the prose is the only place the figure appears.
    const coverage = 'Your wardrobe is thin for night out occasions — sleek evening shoes would add 9 new outfits.';
    expect(shoppingPriorityGapNarrative('sleek evening shoes', coverage).voice).toBe(coverage);
    // A different figure is a different fact, not a restatement.
    expect(shoppingPriorityGapNarrative('sleek evening shoes', coverage, { impactScore: 4 }).voice).toBe(coverage);
  });

  test('leaves a malformed step in the prose rather than losing it', () => {
    expect(shoppingPriorityGapNarrative(
      'everyday trousers',
      'A dependable foundation would unlock more weekday combinations. Step 3 of 2: everyday trousers.',
    )).toEqual({
      voice: 'A dependable foundation would unlock more weekday combinations. Step 3 of 2: everyday trousers.',
      step: null,
    });
  });
});

describe('splitPriceRange', () => {
  it('lifts the currency out and drops the repeated symbol', () => {
    expect(splitPriceRange('$180–$350 CAD')).toEqual({ compact: '$180–350', currency: 'CAD' });
    expect(splitPriceRange('  $220 - $420   USD ')).toEqual({ compact: '$220 - 420', currency: 'USD' });
  });

  it('leaves a range alone when there is nothing to lift', () => {
    expect(splitPriceRange('$200–380')).toEqual({ compact: '$200–380', currency: null });
    expect(splitPriceRange('€90')).toEqual({ compact: '€90', currency: null });
  });

  it('passes unrecognised shapes through untouched', () => {
    expect(splitPriceRange('mid-range')).toEqual({ compact: 'mid-range', currency: null });
    expect(splitPriceRange('')).toEqual({ compact: '', currency: null });
  });
});

describe('humanizeInlineTokens', () => {
  it('humanizes multiple snake_case tokens embedded in a sentence', () => {
    expect(humanizeInlineTokens('Bridges smart_casual and date_night outfits with a sleek finish.')).toBe(
      'Bridges Smart Casual and Date Night outfits with a sleek finish.',
    );
  });

  it('leaves prose with no snake_case tokens untouched', () => {
    expect(humanizeInlineTokens('Sharp enough for dress pants, but relaxed for jeans.')).toBe(
      'Sharp enough for dress pants, but relaxed for jeans.',
    );
  });

  it('does not touch hyphenated words', () => {
    expect(humanizeInlineTokens('A pointed-toe derby for night-out occasions.')).toBe(
      'A pointed-toe derby for night-out occasions.',
    );
  });

  it('humanizes a token at the very start or end of the string', () => {
    expect(humanizeInlineTokens('smart_casual is the target occasion')).toBe('Smart Casual is the target occasion');
    expect(humanizeInlineTokens('the target occasion is date_night')).toBe('the target occasion is Date Night');
  });
});

describe('targetOutfitIdeas', () => {
  it('returns the grouped looks a current target carries', () => {
    expect(targetOutfitIdeas(target('a') as unknown as ShoppingPriorityTarget)).toEqual([
      { label: 'With tailoring', itemIds: [12, 13] },
    ]);
  });

  it('surfaces a legacy flat pairing list as one unlabelled group', () => {
    const legacy = { ...target('a'), outfitIdeas: undefined, pairsWithItemIds: [12, 13, 14] };
    expect(targetOutfitIdeas(legacy as unknown as ShoppingPriorityTarget)).toEqual([
      { label: '', itemIds: [12, 13, 14] },
    ]);
  });

  it('prefers grouped looks when a target somehow carries both shapes', () => {
    const both = { ...target('a'), pairsWithItemIds: [99] };
    expect(targetOutfitIdeas(both as unknown as ShoppingPriorityTarget)).toEqual([
      { label: 'With tailoring', itemIds: [12, 13] },
    ]);
  });

  it('returns nothing when a target carries neither shape', () => {
    const bare = { ...target('a'), outfitIdeas: undefined, pairsWithItemIds: undefined };
    expect(targetOutfitIdeas(bare as unknown as ShoppingPriorityTarget)).toEqual([]);
  });
});

test.each([1, 3, 5])('accepts %i styles and preserves optional editorial guidance', (count) => {
  const result = parseShoppingPriorityEdit({ status: 'ready', headline: 'Trousers', summary: 'Try these with your jacket.', generatedAt: '2026-09-28', priority, targets: Array.from({ length: count }, (_, i) => ({ ...target(String(i)), shoppingNotes: ['Wool blend', 'Clean front'] })) });
  expect(result.targets).toHaveLength(count);
  expect(result.targets[0].shoppingNotes).toEqual(['Wool blend', 'Clean front']);
});
test('malformed optional offers and guidance do not break the guide', () => {
  const result = parseShoppingPriorityEdit({ status: 'ready', headline: 'Trousers', summary: 'Try these.', generatedAt: '2026-09-28', priority, targets: [{ ...target('a'), offers: [{}], shoppingNotes: [null, 'Wool blend'] }] });
  expect(result.targets[0].offers).toEqual([]);
  expect(result.targets[0].shoppingNotes).toEqual(['Wool blend']);
});
