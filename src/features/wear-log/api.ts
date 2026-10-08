import { api } from '../../lib/api';
import type { BatchCreateItemInput } from '../../hooks/useItems';
import { commitItems } from '../../lib/commitItems';
import { normalizeScanCategory } from '../../lib/outfit-log-scan';
import type { Item } from '../../types/item';
import { cropImage } from '../../lib/cropImage';
import { uploadDataUrlsToR2 } from '../../lib/uploadImage';
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
export function newItemInput(flowId: string, d: WearDetection, draft: WearDraft, croppedUrl?: string | null): BatchCreateItemInput {
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
    // The user's own crop replaces the scan's; the scan's cutout was masked to
    // the old box, so it is dropped rather than paired with the new photo.
    ...(croppedUrl ? { imageUrl: croppedUrl, cutoutUrl: null, coverImageVariant: 'original' as const } : {
      ...(d.cropUrl ? { imageUrl: d.cropUrl } : {}),
      cutoutUrl: d.cutoutUrl,
      // The background-intact crop is the cover; the cutout stays on the item
      // as an option. Detection cutouts can lose hands, collars and edges.
      coverImageVariant: d.cropUrl || !d.cutoutUrl ? 'original' as const : 'cutout' as const,
    }),
  };
}

export type WearLogSaved = {
  logId: number;
  itemIds: number[];
  alreadyLoggedItemIds: number[];
  createdItems: Item[];
};

/**
 * Re-cut and upload the covers the user cropped, from the stored outfit
 * photo (the same image the scan read, so the boxes line up). A crop that
 * can't be made fails the save rather than quietly falling back to the
 * scan's crop.
 */
async function uploadCrops(flow: ReviewFlow, drafts: WearDetection[]): Promise<Map<string, string>> {
  const cropped = drafts.flatMap((d) => {
    const r = flow.resolutions[d.id];
    return r.kind === 'new' && r.draft.cropBbox ? [{ id: d.id, bbox: r.draft.cropBbox }] : [];
  });
  if (!cropped.length) return new Map();
  const dataUrls = await Promise.all(cropped.map((c) => cropImage(flow.photoUri, c.bbox, { maxDim: 1200, quality: 0.88 })));
  if (dataUrls.some((u) => !u)) throw new Error('Couldn’t prepare your cropped photo. Try again.');
  const uploads = await uploadDataUrlsToR2(dataUrls as string[]);
  return new Map(cropped.map((c, i) => {
    const upload = uploads[i];
    if (upload.status !== 'fulfilled') throw upload.reason;
    return [c.id, upload.value];
  }));
}

/**
 * Save a review: new pieces first (one idempotent batch), then the log with
 * every item id. Each step is keyed by the flow id, so retrying the whole
 * function after any failure creates nothing twice.
 */
export async function saveWearLog(flow: ReviewFlow): Promise<WearLogSaved> {
  const drafts = newDetections(flow);
  let createdItems: Item[] = [];
  if (drafts.length) {
    const croppedUrls = await uploadCrops(flow, drafts);
    // The workspace applies the new rows to the cache, and queues any polish,
    // only once the log itself has landed.
    const result = await commitItems(drafts.map((d) => {
      const r = flow.resolutions[d.id];
      return newItemInput(flow.id, d, r.kind === 'new' ? r.draft : draftFrom(d), croppedUrls.get(d.id));
    }));
    // All or nothing: a log never goes out missing a piece the user chose to add.
    const [firstFailure] = result.failures.values();
    if (firstFailure) throw new Error(firstFailure || 'Couldn’t add a new piece.');
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
