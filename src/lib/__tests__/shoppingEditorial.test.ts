import {
  legacyPriorityRationale,
  shoppingGarmentTitle,
  stylistNotePreview,
  styleFollowupQuestions,
} from '../shoppingEditorial';
import type { ShoppingPriorityTarget } from '../shoppingPriorityEdit';

test('removes diagnostic title suffixes', () => {
  expect(shoppingGarmentTitle('tailored trousers Gap')).toBe('Tailored trousers');
});
test('keeps ordinary stylist notes intact', () => {
  const note = 'Your navy jacket works well with lighter shirts. I’d add charcoal trousers next.';
  expect(stylistNotePreview(note)).toBe(note);
});
test('long notes disclose at a sentence boundary', () => {
  const sentence = 'Your jackets and shoes give you a useful starting point. ';
  const note = sentence.repeat(9);
  const preview = stylistNotePreview(note);
  expect(preview.length).toBeLessThan(note.length);
  expect(preview.endsWith('.')).toBe(true);
  expect(note.startsWith(preview)).toBe(true);
});
test('follow-ups compare an actual alternative without inventing a budget', () => {
  const targets = [{ color: 'charcoal' }, { color: 'navy' }] as ShoppingPriorityTarget[];
  expect(styleFollowupQuestions(targets)).toEqual([
    'Would navy work better for me?',
    'Can we find a less expensive version?',
  ]);
  expect(styleFollowupQuestions(targets.slice(0, 1))[0]).toBe('Could this feel more casual?');
});

test('old deterministic brief copy sounds like advice rather than a diagnosis', () => {
  expect(legacyPriorityRationale('Your wardrobe is thin for night out occasions.')).toBe(
    'You have fewer options for night out occasions.',
  );
  expect(
    legacyPriorityRationale(
      'You own Oxford Shoes and Suit Jacket for business casual occasions but cannot build a complete business casual outfit yet.',
    ),
  ).toBe(
    'I’d add this to wear with your Oxford Shoes and Suit Jacket for business casual occasions.',
  );
});
