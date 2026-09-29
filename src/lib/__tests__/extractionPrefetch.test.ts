import { createExtractionCache, extractionKey, type ExtractionFields, type ExtractionRequest } from '../extractionPrefetch';
import type { ScanResult } from '../../types/item';

const SERVER_KEY_FORMAT = /^[A-Za-z0-9_-]{8,128}$/;

const base: ExtractionFields = {
  targetName: 'Brown Glasses',
  targetCategory: 'accessory',
  brandHint: '',
  bbox: { x: 10, y: 12.5, width: 20, height: 15 },
};

describe('extractionKey', () => {
  it('is stable while nothing about the piece changes', () => {
    expect(extractionKey('1790717582753-c6nr4xz6e0g', base)).toBe(extractionKey('1790717582753-c6nr4xz6e0g', { ...base }));
  });

  it('matches the server idempotency-key format', () => {
    expect(extractionKey('1790717582753-c6nr4xz6e0g', base)).toMatch(SERVER_KEY_FORMAT);
    expect(extractionKey('odd id with spaces/and.dots', base)).toMatch(SERVER_KEY_FORMAT);
  });

  it.each([
    ['a rename', { targetName: 'Tortoiseshell Glasses' }],
    ['a brand hint', { brandHint: 'Oliver Peoples' }],
    ['a category change', { targetCategory: 'valuables' }],
    ['a re-crop', { bbox: { x: 11, y: 12.5, width: 20, height: 15 } }],
  ])('changes after %s, so the server cannot replay a stale result', (_label, patch) => {
    expect(extractionKey('piece-1234', { ...base, ...patch })).not.toBe(extractionKey('piece-1234', base));
  });

  it('ignores whitespace-only differences in typed fields', () => {
    expect(extractionKey('piece-1234', { ...base, targetName: ' Brown Glasses ' })).toBe(extractionKey('piece-1234', base));
  });

  it('differs between pieces with identical inputs', () => {
    expect(extractionKey('piece-aaaa', base)).not.toBe(extractionKey('piece-bbbb', base));
  });
});

describe('createExtractionCache', () => {
  const request = (key: string): ExtractionRequest => ({ imageData: 'data:image/jpeg;base64,x', idempotencyKey: key });
  const result = (name: string) => ({ name }) as ScanResult;

  it('shares one request per key', async () => {
    const run = jest.fn(async (r: ExtractionRequest) => result(r.idempotencyKey));
    const cache = createExtractionCache(run, 4);
    const [a, b] = await Promise.all([cache.get(request('k-1')), cache.get(request('k-1'))]);
    expect(a).toBe(b);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('evicts failures so the next get tries again', async () => {
    const run = jest.fn()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce(result('ok'));
    const cache = createExtractionCache(run, 4);
    await expect(cache.get(request('k-1'))).rejects.toThrow('503');
    expect(cache.has('k-1')).toBe(false);
    await expect(cache.get(request('k-1'))).resolves.toEqual(result('ok'));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('never runs more than the limit at once', async () => {
    let active = 0;
    let peak = 0;
    const run = async (r: ExtractionRequest) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return result(r.idempotencyKey);
    };
    const cache = createExtractionCache(run, 2);
    await Promise.all(Array.from({ length: 7 }, (_, i) => cache.get(request(`k-${i}`))));
    expect(peak).toBe(2);
  });

  it('forgets everything on clear, without a late failure evicting the new entry', async () => {
    let rejectFirst!: (e: Error) => void;
    const run = jest.fn()
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; }))
      .mockResolvedValueOnce(result('fresh'));
    const cache = createExtractionCache(run, 4);
    const stale = cache.get(request('k-1'));
    cache.clear();
    const fresh = cache.get(request('k-1'));
    // `run` starts a microtask later, once the limiter grants a slot.
    await new Promise((resolve) => setTimeout(resolve, 0));
    rejectFirst(new Error('old session'));
    await expect(stale).rejects.toThrow('old session');
    await expect(fresh).resolves.toEqual(result('fresh'));
    expect(cache.has('k-1')).toBe(true);
  });
});
