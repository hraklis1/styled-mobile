jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    },
  };
});

import { onPromptsDue, recordPromptSignal } from '../signals';

describe('prompt signals', () => {
  it('offers budget, then sizes, then shops as Shop visits accumulate', async () => {
    const seen: string[][] = [];
    const off = onPromptsDue((keys) => seen.push(keys));
    await recordPromptSignal('shop_opened');
    await recordPromptSignal('shop_opened');
    await recordPromptSignal('shop_opened');
    off();
    expect(seen).toEqual([['budget'], ['budget', 'sizes'], ['budget', 'sizes', 'retailers']]);
  });

  it('waits for the fifth stylist message before asking about fit', async () => {
    const seen: string[][] = [];
    const off = onPromptsDue((keys) => seen.push(keys));
    for (let i = 0; i < 5; i++) await recordPromptSignal('stylist_message');
    off();
    expect(seen).toEqual([['fit']]);
  });
});
