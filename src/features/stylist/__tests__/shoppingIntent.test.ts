import { resolveShoppingAlternativeMode } from '../shoppingIntent';

describe('affordable shopping follow-ups', () => {
  it.each([
    'Can we find a less expensive version?',
    'Show me cheaper alternatives',
    'Could you suggest a more affordable option?',
    'Find a budget-friendly dupe',
  ])('requests item suggestions for %s', (text) => {
    expect(resolveShoppingAlternativeMode(text)).toBe('shop_list');
  });

  it.each([
    'Is this cheaper fabric less durable?',
    'Which option is most versatile?',
    'Make these more polished.',
    'Is it worth buying?',
    'Should I buy the cheaper option?',
  ])('keeps advice classification for %s', (text) => {
    expect(resolveShoppingAlternativeMode(text)).toBeUndefined();
  });
});
