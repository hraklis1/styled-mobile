import {
  legacyPriorityRationale,
  shoppingGarmentTitle,
  stylistNotePreview,
  compareAskQuestions,
  styleAskQuestions,
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
test('style questions name the style they are about', () => {
  expect(styleAskQuestions({ title: 'Deep navy' } as ShoppingPriorityTarget)).toEqual([
    'Is there a cheaper take on the deep navy?',
    'What else could I wear the deep navy with?',
  ]);
});
test('title-case style names read naturally mid-sentence', () => {
  expect(styleAskQuestions({ title: 'Silk Knit Mock Neck' } as ShoppingPriorityTarget)[0]).toBe('Is there a cheaper take on the silk knit mock neck?');
  expect(styleAskQuestions({ title: 'OCBD Shirt' } as ShoppingPriorityTarget)[0]).toBe('Is there a cheaper take on the OCBD shirt?');
});
test('comparison questions only appear when there is something to compare', () => {
  const targets = [{ title: 'Charcoal wool' }, { title: 'Deep navy' }, { title: 'Olive' }] as ShoppingPriorityTarget[];
  expect(compareAskQuestions(targets.slice(0, 1))).toEqual([]);
  expect(compareAskQuestions(targets.slice(0, 2))[0]).toBe('The charcoal wool or the deep navy — which suits me better?');
  expect(compareAskQuestions(targets)[0]).toBe('Which of these 3 styles suits me best?');
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
