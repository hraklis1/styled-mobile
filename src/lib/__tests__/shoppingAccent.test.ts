import { shoppingAccent } from '../shoppingAccent';
import { shoppingSurfaces } from '../../theme';

describe('shoppingAccent', () => {
  it.each([
    ['muted olive', 'olive'], ['SAGE-green', 'olive'],
    ['stone grey', 'stone'], ['GRAY', 'stone'],
    ['charcoal', 'charcoal'], ['olive / BLACK', 'charcoal'],
    ['grey olive', 'olive'], ['unknown', 'olive'], ['', 'olive'],
    ['blackberry', 'olive'], ['greystone', 'olive'],
  ] as const)('resolves %s to %s', (color, family) => {
    expect(shoppingAccent(color)).toEqual(shoppingSurfaces[family]);
  });
});
