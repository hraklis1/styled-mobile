import { isGenericOutfitClaim, matchShoppingPriority, priorityAnchorPieces, priorityOccasionLabel, shoppingGuideIntro, wearableWardrobe, withoutOutfitCount, worksWithLabel } from '../shopClarity';
import type { ShoppingBriefPriority } from '../shopDecisionWorkspace';
import type { Item } from '../../types/item';
const priority: ShoppingBriefPriority = { label: 'Shirt', category: 'top', reason: 'occasion', context: '', priority: 1, unlocks: [] };
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

it('takes the computed count out of prose and keeps the sentence', () => {
  expect(withoutOutfitCount('Versatile trousers would create 80 new outfits from pieces you already own.', 80)).toBe('Versatile trousers would create new outfits from pieces you already own.');
  expect(withoutOutfitCount('Adds 1 new outfit.', 1)).toBe('Adds new outfits.');
  expect(withoutOutfitCount('Adds 10 new outfits.', undefined)).toBe('Adds 10 new outfits.');
  expect(withoutOutfitCount('Pairs with 3 blazers.', 3)).toBe('Pairs with 3 blazers.');
});

const piece = (id: number, name: string, extra: Partial<Item> = {}) => ({ id, name, ...extra }) as Item;
it('anchors a priority to wearable owned pieces in server order', () => {
  const wardrobe = wearableWardrobe([piece(1, 'Navy Blazer'), piece(2, 'Grey Chinos'), piece(3, 'Old Coat', { isArchived: true } as Partial<Item>)]);
  const anchored = { ...priority, anchorItemIds: [2, 3, 9, 1] };
  expect(priorityAnchorPieces(anchored, wardrobe).map((item) => item.id)).toEqual([2, 1]);
  expect(priorityAnchorPieces(anchored)).toEqual([]);
});
it('leads the anchor strip with product-style covers, keeping server order within groups', () => {
  const wardrobe = wearableWardrobe([piece(1, 'Selfie'), piece(2, 'Cutout', { cutoutUrl: 'c' } as Partial<Item>), piece(3, 'Photo'), piece(4, 'Polished', { polishedUrl: 'p' } as Partial<Item>)]);
  expect(priorityAnchorPieces({ ...priority, anchorItemIds: [1, 2, 3, 4] }, wardrobe).map((item) => item.id)).toEqual([2, 4, 1, 3]);
});
it('recognises a sentence that is only the generic outfit claim', () => {
  expect(isGenericOutfitClaim('Would create new outfits from pieces you already own.')).toBe(true);
  expect(isGenericOutfitClaim('add new outfits from the pieces you already own')).toBe(true);
  expect(isGenericOutfitClaim('Would create new outfits for business casual days.')).toBe(false);
  expect(isGenericOutfitClaim('You own Oxford Shoes but cannot build a complete outfit yet.')).toBe(false);
});
it('names a few anchor pieces and counts the rest', () => {
  expect(worksWithLabel([piece(1, 'Navy Blazer')])).toBe('Works with your Navy Blazer');
  expect(worksWithLabel([piece(1, 'Navy Blazer'), piece(2, 'Grey Chinos'), piece(3, 'White Tee'), piece(4, 'Loafers')])).toBe('Works with your Navy Blazer, Grey Chinos +2');
  expect(worksWithLabel([piece(1, 'Chino Shorts'), piece(2, 'Chino Shorts'), piece(3, 'Tee'), piece(4, 'Loafers')])).toBe('Works with your Chino Shorts, Tee +1');
  expect(worksWithLabel([])).toBeNull();
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
