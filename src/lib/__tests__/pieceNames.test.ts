import { shortPieceName } from '../pieceNames';

it.each([
  ['Brown Quarter-Zip Pullover Hoodie', 'Quarter-zip'],
  ['Grey and Beige Running Sneakers', 'Sneakers'],
  ['Cream Cotton Tote Bag', 'Cotton tote'],
  ['Natural Canvas Tote', 'Canvas tote'],
  ['Cream Crossbody Bag', 'Crossbody bag'],
  ['Brown Woven Baseball Cap', 'Baseball cap'],
  ['Tailored Dark Brown Trousers', 'Trousers'],
  ['Black Cap Sleeve Dress', 'Dress'],
  ['Gold Hoop Earrings', 'Earrings'],
  ['Blue Bootcut Jeans', 'Jeans'],
])('%s → %s', (name, short) => {
  expect(shortPieceName(name)).toBe(short);
});

it('keeps a name it cannot shorten', () => {
  expect(shortPieceName('Mystery Piece')).toBe('Mystery Piece');
  expect(shortPieceName('')).toBe('');
});
