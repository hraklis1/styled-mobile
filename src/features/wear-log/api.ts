import { api } from '../../lib/api';
import { createItemsBatch, type BatchCreateItemInput } from '../../hooks/useItems';
import { normalizeScanCategory } from '../../lib/outfit-log-scan';
import type { Item } from '../../types/item';
import { clientImportIdFor, draftFrom, selectedItemIds, newDetections } from './reducer';
import type { ReviewFlow, WearDetection, WearDraft, WearScan } from './types';

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

/**
 * The closet item a "new" row becomes: the user's draft plus the scan's
 * cutout, with the background-intact crop as its original photo so it can be
 * viewed and polished like any other item.
 */
export function newItemInput(flowId: string, d: WearDetection, draft: WearDraft): BatchCreateItemInput {
  return {
    clientImportId: clientImportIdFor(flowId, d.id),
    name: draft.name.trim() || d.attributes.name,
    brand: draft.brand.trim() || null,
    category: normalizeScanCategory(draft.category ?? d.attributes.category),
    subcategory: draft.subcategory,
    color: draft.color,
    colorNormalized: draft.colorNormalized,
    style: draft.style,
    seasons: draft.seasons,
    occasions: draft.occasions,
    material: draft.material,
    fit: draft.fit,
    sizeProfile: draft.sizeProfile,
    sleeveLength: draft.sleeveLength,
    notes: d.attributes.description || null,
    ...(d.cropUrl ? { imageUrl: d.cropUrl } : {}),
    cutoutUrl: d.cutoutUrl,
    coverImageVariant: d.cutoutUrl ? 'cutout' : 'original',
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
    const result = await createItemsBatch(drafts.map((d) => {
      const r = flow.resolutions[d.id];
      return newItemInput(flow.id, d, r.kind === 'new' ? r.draft : draftFrom(d));
    }));
    if (result.rejected.length) throw new Error(result.rejected[0].message || 'Couldn’t add a new piece.');
    createdItems = result.items;
  }

  const itemIds = [...new Set([...selectedItemIds(flow), ...createdItems.map((i) => i.id)])];
  const { data } = await api.post<{ id: number; alreadyLoggedItemIds?: number[] }>('/api/outfit-logs', {
    clientLogId: flow.id,
    date: flow.date,
    itemIds,
    ...(flow.scan.imageUrl ? { imageUrl: flow.scan.imageUrl } : {}),
  });
  return { logId: data.id, itemIds, alreadyLoggedItemIds: data.alreadyLoggedItemIds ?? [], createdItems };
}
