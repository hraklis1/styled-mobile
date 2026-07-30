const mockGenerateCutoutForItem = jest.fn();

jest.mock('../cutout', () => {
  // Mirrors the real module: a tagged plain Error, recognised by property
  // rather than by class identity.
  const cutoutBusyError = () => {
    const err = new Error('Segmentation busy') as Error & { isCutoutBusy: true };
    err.name = 'CutoutBusyError';
    err.isCutoutBusy = true;
    return err;
  };
  return {
    cutoutBusyError,
    isCutoutBusyError: (err: unknown) => !!err && (err as any).isCutoutBusy === true,
    generateCutoutForItem: (...args: unknown[]) => mockGenerateCutoutForItem(...args),
  };
});

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockStorage.get(k) ?? null),
  setItem: (k: string, v: string) => { mockStorage.set(k, v); return Promise.resolve(); },
  removeItem: (k: string) => { mockStorage.delete(k); return Promise.resolve(); },
}));

import { cutoutBusyError } from '../cutout';
import { itemsNeedingCutout, runCutoutBackfill, resetBackfillCursor } from '../cutoutBackfill';
import type { Item } from '../../types/item';

function item(id: number, patch: Partial<Item> = {}): Item {
  return {
    id,
    name: `Item ${id}`,
    userId: 1,
    imageUrl: `https://cdn.example/${id}.jpg`,
    cutoutUrl: null,
    isArchived: false,
    category: 'top',
    ...patch,
  } as Item;
}

beforeEach(() => {
  mockStorage.clear();
  mockGenerateCutoutForItem.mockReset();
  jest.useRealTimers();
});

describe('itemsNeedingCutout', () => {
  it('selects only items with a photo and no cutout, oldest first', () => {
    const items = [
      item(3),
      item(1, { cutoutUrl: 'https://cdn.example/1-cut.webp' }), // already done
      item(2),
      item(4, { imageUrl: null }),                              // no photo
      item(5, { isArchived: true }),                            // archived
    ];
    expect(itemsNeedingCutout(items).map((i) => i.id)).toEqual([2, 3]);
  });
});

describe('runCutoutBackfill', () => {
  it('sends one request at a time and never runs them in parallel', async () => {
    let inFlight = 0;
    let peak = 0;
    mockGenerateCutoutForItem.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return 'https://cdn.example/cut.webp';
    });

    const { done } = runCutoutBackfill({
      items: [item(1), item(2), item(3)],
      userId: 1,
    });
    const result = await done;

    expect(peak).toBe(1);
    expect(result.completed).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.stoppedReason).toBeNull();
  });

  it('retries the same item when the server is busy, without advancing', async () => {
    const seen: number[] = [];
    let calls = 0;
    mockGenerateCutoutForItem.mockImplementation(async ({ item: it }: any) => {
      seen.push(it.id);
      calls += 1;
      if (calls === 1) throw cutoutBusyError();
      return 'https://cdn.example/cut.webp';
    });

    const { done } = runCutoutBackfill({ items: [item(1), item(2)], userId: 1 });
    const result = await done;

    // Item 1 attempted twice (busy, then success), then item 2.
    expect(seen).toEqual([1, 1, 2]);
    expect(result.completed).toBe(2);
  });

  it('gives up after repeated busy responses rather than grinding', async () => {
    mockGenerateCutoutForItem.mockRejectedValue(cutoutBusyError());

    const { done } = runCutoutBackfill({ items: [item(1), item(2)], userId: 1 });
    const result = await done;

    expect(result.stoppedReason).toBe('too_many_failures');
    expect(result.completed).toBe(0);
    // Bounded by MAX_CONSECUTIVE_FAILURES, not by the queue length.
    expect(mockGenerateCutoutForItem).toHaveBeenCalledTimes(5);
  }, 60_000);

  it('counts a rejected cutout as done so it is not retried forever', async () => {
    // null = the server's quality gate rejected this photo's mask.
    mockGenerateCutoutForItem.mockResolvedValue(null);

    const onItemCutout = jest.fn();
    const { done } = runCutoutBackfill({ items: [item(1), item(2)], userId: 1, onItemCutout });
    const result = await done;

    expect(result.completed).toBe(2);
    expect(result.succeeded).toBe(0);
    expect(onItemCutout).not.toHaveBeenCalled();
  });

  it('stops promptly when cancelled', async () => {
    mockGenerateCutoutForItem.mockResolvedValue('https://cdn.example/cut.webp');

    const handle = runCutoutBackfill({
      items: [item(1), item(2), item(3), item(4), item(5)],
      userId: 1,
    });
    handle.cancel();
    const result = await handle.done;

    expect(result.stoppedReason).toBe('cancelled');
    expect(result.completed).toBeLessThan(5);
  });

  it('resumes after the persisted cursor instead of restarting', async () => {
    mockGenerateCutoutForItem.mockResolvedValue('https://cdn.example/cut.webp');
    const items = [item(1), item(2), item(3), item(4)];

    const first = runCutoutBackfill({ items, userId: 1 });
    // Let item 1 finish and write the cursor, then stop.
    await new Promise((r) => setTimeout(r, 50));
    first.cancel();
    await first.done;

    const completedFirst = mockGenerateCutoutForItem.mock.calls.length;
    expect(completedFirst).toBeGreaterThan(0);

    mockGenerateCutoutForItem.mockClear();
    const second = await runCutoutBackfill({ items, userId: 1 }).done;

    // The resumed run covers only what the first didn't reach.
    expect(second.total).toBe(items.length - completedFirst);
  });

  it('clears the cursor after a clean run so the next run starts fresh', async () => {
    mockGenerateCutoutForItem.mockResolvedValue('https://cdn.example/cut.webp');
    await runCutoutBackfill({ items: [item(1)], userId: 1 }).done;

    expect(mockStorage.get('cutout_backfill_cursor')).toBeUndefined();
    await resetBackfillCursor(); // idempotent
  });
});
