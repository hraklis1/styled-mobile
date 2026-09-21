import { clarifyOutfitClaims, matchShoppingPriority, potentialOutfitCount, priorityOccasionLabel, shoppingGuideIntro } from '../shopClarity';
import type { ShoppingBriefPriority } from '../shopDecisionWorkspace';
const priority: ShoppingBriefPriority = { label: 'Shirt', category: 'top', reason: 'occasion', context: '', priority: 1, unlocks: [] };
it.each([undefined, 0, -1, NaN, Infinity])('omits unsupported outfit counts: %s', (count) => {
  expect(potentialOutfitCount(count)).toBeNull();
});
it('describes counts as potential combinations with correct plurality', () => {
  expect(potentialOutfitCount(1)).toBe('1 potential outfit combination');
  expect(potentialOutfitCount(130)).toBe('130 potential outfit combinations');
  expect(potentialOutfitCount(1300)).toBe(`${(1300).toLocaleString()} potential outfit combinations`);
});
it('uses event context without concatenating mechanical unlock phrases', () => {
  expect(priorityOccasionLabel({ ...priority, eventTitle: ' Winter wedding ' })).toBe('For Winter wedding');
  expect(priorityOccasionLabel({ ...priority, scope: 'event' })).toBe('For your upcoming occasion');
  expect(priorityOccasionLabel({ ...priority, unlocks: ['meet the formal dress code'] })).toBe('Formal occasions');
  expect(priorityOccasionLabel(priority)).toBeNull();
});
it('uses the actual number of guide options', () => {
  expect(shoppingGuideIntro(1)).toMatch(/^One style to look for/);
  expect(shoppingGuideIntro(3)).toMatch(/^Three styles to look for/);
  expect(shoppingGuideIntro(4)).toMatch(/^4 styles to look for/);
});

it('qualifies only the computed count in existing prose', () => {
  expect(clarifyOutfitClaims('Adds 130 new outfits with your wardrobe.', 130)).toBe('Adds 130 potential outfit combinations with your wardrobe.');
  expect(clarifyOutfitClaims('Adds 1 new outfit.', 1)).toBe('Adds 1 potential outfit combination.');
  expect(clarifyOutfitClaims('Adds 10 new outfits.', undefined)).toBe('Adds 10 new outfits.');
});

describe('matchShoppingPriority', () => {
  const sneakers: ShoppingBriefPriority = { label: 'everyday leather sneakers', category: 'shoes', reason: 'wardrobe_gap', context: '', priority: 1, unlocks: [] };
  const shirt: ShoppingBriefPriority = { label: 'formal shirt or blouse', category: 'tops', reason: 'occasion', context: '', priority: 2, unlocks: [] };
  const priorities = [sneakers, shirt];

  it('matches on the garment noun in the label, singular or plural', () => {
    expect(matchShoppingPriority({ category: 'Sneaker' }, priorities)).toBe(sneakers);
    expect(matchShoppingPriority({ category: null, productName: 'Linen blouse' }, priorities)).toBe(shirt);
  });
  it('matches on the coarse category', () => {
    expect(matchShoppingPriority({ category: 'shoes' }, priorities)).toBe(sneakers);
  });
  it('ignores adjectives shared across priorities', () => {
    expect(matchShoppingPriority({ category: 'formal trousers' }, priorities)).toBeNull();
    expect(matchShoppingPriority({ category: null, productName: null }, priorities)).toBeNull();
  });
});
