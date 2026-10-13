import { homeGarmentDescription, homeGarmentWithArticle, homeShoppingExplanation, homePriorityTitle } from '../homePresentationCopy';
import type { Item } from '../../types/item';
import type { ShoppingBriefPriority } from '../shopDecisionWorkspace';
const jacket = { id: 1, category: 'outerwear', color: 'Camel', subcategory: 'Jackets', name: 'Unchanged catalog name' } as Item;
const shirt = { id: 2, category: 'top', color: 'Oatmeal with Charcoal Stripes', subcategory: 'Shirts' } as Item;
const priority = { label: 'suede chelsea boots', context: 'Pairs with your shirt for proportion and silhouette, grounding the outfit.', anchorItemIds: [1, 2] } as ShoppingBriefPriority;
it('turns classifier plurals and compound colors into natural garment descriptions', () => {
  expect(homeGarmentDescription(jacket)).toBe('camel jacket');
  expect(homeGarmentWithArticle(homeGarmentDescription(shirt))).toBe('an oatmeal striped shirt');
  expect(homeGarmentWithArticle('navy trousers')).toBe('navy trousers');
  expect(jacket.name).toBe('Unchanged catalog name');
});
it('writes a complete shopping sentence using only available verified anchors', () => {
  expect(homeShoppingExplanation(priority, [jacket, shirt])).toBe('Style with your camel jacket or oatmeal striped shirt.');
  expect(homeShoppingExplanation(priority, [{ ...jacket, isArchived: true }, shirt])).toBe('Style with your oatmeal striped shirt.');
  expect(homeShoppingExplanation(priority, [])).toBe('Explore ways to wear this with your wardrobe.');
  expect(homePriorityTitle(priority.label)).toBe('Suede Chelsea boots');
});
