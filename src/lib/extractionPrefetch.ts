// Deduplicate explicitly approved attribute extraction by its editable inputs.
// Failed requests are evicted; successful retries reuse the same server key.
// Sibling context is intentionally not part of the key: changing another
// piece must not invalidate this piece's completed extraction.

import type { ScanResult } from '../types/item';

export type ExtractionFields = {
  targetName: string;
  targetCategory: string;
  brandHint: string;
  bbox: { x: number; y: number; width: number; height: number } | null;
};

export type ExtractionRequest = {
  imageData: string;
  outfitContext?: string;
  brandHint?: string;
  targetName?: string;
  targetCategory?: string;
  idempotencyKey: string;
};

/** 32-bit FNV-1a; plenty to tell one edit of a piece from another. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Idempotency key for one piece's extraction with these inputs. Stable while
 * nothing about the piece changes; different after a rename, a new brand hint,
 * a category change or a re-crop. Always matches the server's key format.
 */
export function extractionKey(tempId: string, fields: ExtractionFields): string {
  const bbox = fields.bbox
    ? [fields.bbox.x, fields.bbox.y, fields.bbox.width, fields.bbox.height].map((n) => n.toFixed(2)).join(',')
    : '';
  const digest = fnv1a(JSON.stringify([
    fields.targetName.trim(),
    fields.targetCategory,
    fields.brandHint.trim(),
    bbox,
  ])).toString(36);
  const base = tempId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100);
  return `${base}-x${digest}`;
}

export type ExtractionCache = {
  /** The extraction for `request.idempotencyKey`, started now or earlier. */
  get(request: ExtractionRequest): Promise<ScanResult>;
  /** True once a request for this key has been started and not failed. */
  has(key: string): boolean;
  /** Forget everything; in-flight requests finish but are no longer shared. */
  clear(): void;
};

/**
 * One promise per key, at most `concurrency` requests in flight. Failures are
 * evicted so the next `get` for that key tries again (with the same key, so
 * the server can still join or replay its own copy).
 */
export function createExtractionCache(
  run: (request: ExtractionRequest) => Promise<ScanResult>,
  concurrency: number,
): ExtractionCache {
  let entries = new Map<string, Promise<ScanResult>>();
  let active = 0;
  const waiting: (() => void)[] = [];

  // A released slot is handed straight to the next waiter rather than freed,
  // so a request arriving in between can't push past the limit.
  const acquire = (): Promise<void> => {
    if (active < concurrency) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => waiting.push(resolve));
  };
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  };

  const limited = async (request: ExtractionRequest): Promise<ScanResult> => {
    await acquire();
    try {
      return await run(request);
    } finally {
      release();
    }
  };

  return {
    get(request) {
      const existing = entries.get(request.idempotencyKey);
      if (existing) return existing;
      const owner = entries;
      const promise = limited(request);
      owner.set(request.idempotencyKey, promise);
      promise.catch(() => {
        if (owner.get(request.idempotencyKey) === promise) owner.delete(request.idempotencyKey);
      });
      return promise;
    },
    has: (key) => entries.has(key),
    clear() {
      entries = new Map();
    },
  };
}
