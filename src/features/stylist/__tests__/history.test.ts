import { buildStylistHistory } from '../history';
import type { StylistMessage } from '../types';
import type { ShopOutfit } from '../../../types/shop';

const shopOutfit: ShopOutfit = {
  intro: '', city: '', totalBudget: '', audioSummary: '',
  items: [{ name: 'Dark Brown Penny Loafer in Leather', brand: 'Suitsupply', category: 'shoes', priceRange: 'CA$389', whyItFitsYou: 'Dressy leather loafer', imageQuery: '', retailerUrl: 'https://suitsupply.com/loafer' }],
};
const assistant = (extra = {}): StylistMessage => ({ id: '1', role: 'assistant', kind: 'assistant', renderType: 'shopping_outfit', text: 'These three.', ...extra });

test('retains the exact product and URL when asking a material follow-up', () => {
  const history = buildStylistHistory([assistant({ shopOutfit }), { id: '2', role: 'user', kind: 'user', renderType: 'text', text: 'What is the material on the Suitsupply loafer?' }]);
  expect(history[0].content).toContain('Dark Brown Penny Loafer in Leather');
  expect(history[0].content).toContain('https://suitsupply.com/loafer');
  expect(history[1].content).toBe('What is the material on the Suitsupply loafer?');
});

test('includes block-only cards and deduplicates the legacy mirror', () => {
  const blocks = [{ type: 'card', text: '', payload: { shopOutfit } }];
  expect(buildStylistHistory([assistant({ blocks })])[0].content).toContain('https://suitsupply.com/loafer');
  const content = buildStylistHistory([assistant({ blocks, shopOutfit })])[0].content;
  expect(content.match(/https:\/\/suitsupply.com\/loafer/g)).toHaveLength(1);
});

test('preserves attachment context and the existing recent-turn window', () => {
  const user: StylistMessage = { id: 'u', role: 'user', kind: 'user', renderType: 'text', text: '', transcript: 'Style this', attachment: { type: 'items', label: 'Shirt', items: [{ itemId: 7, label: 'Shirt' }] } };
  const history = buildStylistHistory([assistant({ shopOutfit }), ...Array.from({ length: 12 }, () => user)]);
  expect(history).toHaveLength(12);
  expect(history[0].content).toBe('Style this\nAttached closet pieces: Shirt (item ID 7)');
});

test('retains offer links when there is no legacy retailer URL', () => {
  const offer = { id: 'offer-1', provider: 'catalog' as const, title: 'Leather penny loafer', brand: 'Suitsupply', merchant: 'Suitsupply Canada', price: 389, currency: 'CAD', formattedPrice: 'CA$389', imageUrl: null, url: 'https://suitsupply.com/exact-product', inStock: null, monetized: false, retrievedAt: '2026-10-11' };
  const card = { ...shopOutfit, items: [{ ...shopOutfit.items[0], retailerUrl: undefined, offers: [offer] }] };
  const content = buildStylistHistory([assistant({ shopOutfit: card })])[0].content;
  expect(content).toContain(offer.url);
  expect(content).toContain('Suitsupply Canada');
  expect(content).toContain('2026-10-11');
  expect(content).not.toContain('imageUrl');
  const fallback = { ...card, items: [{ ...card.items[0], offers: undefined, offerState: { offers: [offer], status: 'ready' as const, retrievedAt: null, expiresAt: null } }] };
  expect(buildStylistHistory([assistant({ shopOutfit: fallback })])[0].content).toContain(offer.url);
});

test('a failed assistant reply is not treated as wardrobe evidence', () => {
  const history = buildStylistHistory([assistant({ deliveryStatus: 'failed', text: 'No useful outfit could be confirmed.' }), { id: 'retry', role: 'user', kind: 'user', renderType: 'text', text: 'Try again' }]);
  expect(history).toHaveLength(1);
  expect(history[0].content).toBe('Try again');
});
