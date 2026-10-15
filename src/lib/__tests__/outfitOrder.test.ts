import { categoryRank, sortByWearOrder } from '../outfitOrder';

describe('sortByWearOrder', () => {
  it('lays a look out outer layer, top, bottom, shoes, then accessories', () => {
    const pieces = [
      { name: 'Trousers', category: 'bottom' },
      { name: 'Shirt', category: 'top' },
      { name: 'Loafers', category: 'shoes' },
      { name: 'Jacket', category: 'outerwear' },
      { name: 'Watch', category: 'valuables' },
    ];
    expect(sortByWearOrder(pieces, (p) => p.category).map((p) => p.name)).toEqual(['Jacket', 'Shirt', 'Trousers', 'Loafers', 'Watch']);
  });

  it('keeps the given order within a category and puts unknown categories last', () => {
    const pieces = [{ n: 'a', c: 'top' }, { n: 'x', c: null }, { n: 'b', c: 'top' }, { n: 'dress', c: 'full_body' }];
    expect(sortByWearOrder(pieces, (p) => p.c).map((p) => p.n)).toEqual(['dress', 'a', 'b', 'x']);
    expect(categoryRank('Outerwear')).toBe(0);
  });
});
