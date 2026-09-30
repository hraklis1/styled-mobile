import { api } from '../../lib/api';
import { createItemsBatch, type BatchCreateItemInput } from '../../hooks/useItems';
import { normalizeScanCategory } from '../../lib/outfit-log-scan';
import type { Item } from '../../types/item';
import { clientImportIdFor, matchedItemIds, newDetections } from './reducer';
import type { ReviewFlow, WearDetection, WearScan } from './types';

/** SAM 3 + matching; same budget as the closet scan's extraction. */
const WEAR_SCAN_TIMEOUT_MS = 120_000;

/**
 * v2 outfit-log scan. The flow id is the idempotency key, so a retry after a
 * lost response replays the paid result instead of scanning again.
 */
export async function scanWear(flowId: string, imageData: string): Promise<WearScan> {
  const { data } = await api.post<WearScan | { items: unknown[] }>(
    '/api/outfit-logs/scan',
    { imageData },
    { timeout: WEAR_SCAN_TIMEOUT_MS, headers: { 'X-Scan-Format': '2', 'Idempotency-Key': flowId } },
  );
  if (!('format' in data) || data.format !== 2) {
    throw new Error('This server does not support the new outfit scan yet.');
  }
  return data;
}

/** A new closet item seeded from what the scan saw. */
export function newItemInput(flowId: string, d: WearDetection): BatchCreateItemInput {
  return {
    clientImportId: clientImportIdFor(flowId, d.id),
    name: d.attributes.name,
    category: normalizeScanCategory(d.attributes.category),
    color: d.attributes.color || null,
    notes: d.attributes.description || null,
    cutoutUrl: d.cutoutUrl,
    coverImageVariant: d.cutoutUrl ? 'cutout' : 'original',
    seasons: [],
    occasions: [],
  };
}

export type WearLogSaved = {
  logId: number;
  itemIds: number[];
  alreadyLoggedItemIds: number[];
  createdItems: Item[];
};

/**
 * Save a review: new pieces first (one idempotent batch), then the log with
 * every item id. Each step is keyed by the flow id, so retrying the whole
 * function after any failure creates nothing twice.
 */
export async function saveWearLog(flow: ReviewFlow): Promise<WearLogSaved> {
  const drafts = newDetections(flow);
  let createdItems: Item[] = [];
  if (drafts.length) {
    const result = await createItemsBatch(drafts.map((d) => newItemInput(flow.id, d)));
    if (result.rejected.length) throw new Error(result.rejected[0].message || 'Couldn’t add a new piece.');
    createdItems = result.items;
  }

  const itemIds = [...new Set([...matchedItemIds(flow), ...createdItems.map((i) => i.id)])];
  const { data } = await api.post<{ id: number; alreadyLoggedItemIds?: number[] }>('/api/outfit-logs', {
    clientLogId: flow.id,
    date: flow.date,
    itemIds,
    ...(flow.scan.imageUrl ? { imageUrl: flow.scan.imageUrl } : {}),
  });
  return { logId: data.id, itemIds, alreadyLoggedItemIds: data.alreadyLoggedItemIds ?? [], createdItems };
}
