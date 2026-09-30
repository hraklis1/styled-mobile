import { mapWithConcurrency } from '../../lib/asyncPool';
import { queryClient } from '../../lib/queryClient';
import { requestUploadUrls, uploadFileToR2 } from '../../lib/uploadImage';
import { applySavedItems, createItemsBatch, type BatchCreateItemInput } from '../../hooks/useItems';
import type { Item, ItemCategory } from '../../types/item';
import { track } from '../../lib/analytics';
import { batchDirectory, cropRegion, fileExists } from './files';
import { classifyError, type RetryDecision } from './retryPolicy';
import { batchImport } from './store';
import type { Batch, Piece } from './types';

const UPLOAD_CONCURRENCY = 4;

type SavedListener = (batchId: string, items: Item[]) => void;
const savedListeners = new Set<SavedListener>();

/**
 * Hear about pieces reaching the closet. The save runs in the background, so
 * whoever started a batch (e.g. the outfit logger's add-clothes detour) is
 * told here rather than by a callback held across the whole batch.
 */
export function onBatchItemsSaved(listener: SavedListener): () => void {
  savedListeners.add(listener);
  return () => savedListeners.delete(listener);
}
const FULL_BBOX = { x: 0, y: 0, width: 100, height: 100 };

class GaveUp extends Error {
  constructor(readonly decision: Exclude<RetryDecision, { kind: 'retry' }>) {
    super(decision.message);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run `fn`, retrying per the batch retry policy; throws GaveUp when it stops. */
async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  let attempts = 0;
  for (;;) {
    attempts += 1;
    try {
      return await fn();
    } catch (error) {
      const decision = classifyError(error, attempts);
      if (decision.kind !== 'retry') throw new GaveUp(decision);
      if (!decision.countsAttempt) attempts -= 1;
      await sleep(decision.delayMs);
    }
  }
}

function stillCurrent(batchId: string): boolean {
  return batchImport.batch()?.id === batchId;
}

/** The saved closet photo: cut from the 2048px master at up to 1200px. */
async function buildItemImage(batch: Batch, piece: Piece): Promise<string | null> {
  const photo = batch.photos.find((p) => p.id === piece.photoId);
  if (!photo?.masterUri || !photo.masterWidth || !photo.masterHeight || !fileExists(photo.masterUri)) {
    return fileExists(piece.previewUri) ? piece.previewUri : null;
  }
  return cropRegion(
    photo.masterUri,
    { width: photo.masterWidth, height: photo.masterHeight },
    piece.bbox ?? FULL_BBOX,
    { maxDim: 1200, compress: 0.88 },
    { dir: batchDirectory(batch.id), name: `${piece.id}-full.jpg` },
  );
}

function toCreateInput(piece: Piece): BatchCreateItemInput {
  const enriched = [piece.brand, piece.material, piece.fit, piece.subcategory].some(Boolean);
  return {
    clientImportId: piece.id,
    name: piece.name.trim() || piece.detectedName || 'Untitled',
    brand: piece.brand || null,
    category: ((piece.category || piece.detectedCategory) as ItemCategory) || null,
    // The server requires a colour; the scan always names one.
    color: piece.color || '',
    subcategory: piece.subcategory || null,
    style: piece.style || null,
    seasons: piece.seasons,
    occasions: piece.occasions,
    colorNormalized: piece.colorNormalized,
    colorTemperature: piece.colorTemperature,
    warmthRating: piece.warmthRating,
    material: piece.material || null,
    fit: piece.fit || null,
    pattern: piece.pattern || null,
    neckline: piece.neckline || null,
    sleeveLength: piece.sleeveLength || null,
    care: piece.care || null,
    notableDetails: piece.notableDetails.length ? piece.notableDetails : undefined,
    colorPalette: piece.colorPalette.length ? piece.colorPalette : undefined,
    imageUrl: piece.imageUrl,
    cutoutUrl: piece.cutoutUrl,
    coverImageVariant: piece.useCutout && piece.cutoutUrl ? 'cutout' : 'original',
    sizeProfile: piece.sizeProfile,
    needsDetails: Boolean(piece.basicDetails) || !enriched,
  };
}

type UploadTask = { pieceId: string; kind: 'image' | 'cutout'; uri: string; contentType: string };

/**
 * Upload whatever each piece still lacks, then save every uploaded piece in
 * one idempotent request. Safe to call again after any failure or an app
 * kill: hosted URLs are kept on the piece and the commit dedupes on
 * clientImportId, so nothing is uploaded or created twice.
 */
export async function runSave(batchId: string): Promise<void> {
  const store = batchImport.get();
  const batch = store.batch;
  if (!batch || batch.id !== batchId) return;

  const pieces = batch.pieces.filter((p) => batch.saveIds?.includes(p.id) && p.included !== false && (p.status === 'ready' || p.status === 'saving'));
  if (pieces.length === 0) {
    store.finishSave([], []);
    return;
  }
  for (const piece of pieces) store.patchPiece(piece.id, { status: 'saving' });

  const failures = new Map<string, string>();
  try {
    // ── Uploads ─────────────────────────────────────────────────────────
    const tasks: UploadTask[] = [];
    for (const piece of pieces) {
      if (!piece.imageUrl) {
        const uri = await buildItemImage(batch, piece);
        if (uri) tasks.push({ pieceId: piece.id, kind: 'image', uri, contentType: 'image/jpeg' });
        else failures.set(piece.id, "This piece's photo is missing.");
      }
      // The cutout is an optional companion: always uploaded when the scan
      // made one (so it can be picked later), but never a reason to fail.
      if (!piece.cutoutUrl && piece.cutoutUri && fileExists(piece.cutoutUri)) {
        tasks.push({ pieceId: piece.id, kind: 'cutout', uri: piece.cutoutUri, contentType: 'image/webp' });
      }
    }

    if (tasks.length) {
      const urls = await withRetries(() => requestUploadUrls(tasks.map((t) => t.contentType)));
      const results = await mapWithConcurrency(tasks, UPLOAD_CONCURRENCY, async (task, index) => {
        const publicUrl = await withRetries(() => uploadFileToR2(task.uri, task.contentType, urls[index]));
        if (!stillCurrent(batchId)) return;
        batchImport.get().patchPiece(task.pieceId, task.kind === 'image' ? { imageUrl: publicUrl } : { cutoutUrl: publicUrl });
      });
      results.forEach((result, index) => {
        const task = tasks[index];
        // A failed image fails the piece; a failed cutout is simply dropped.
        if (result.status === 'rejected' && task.kind === 'image') {
          failures.set(task.pieceId, "Couldn't upload this piece's photo.");
        }
      });
    }
    if (!stillCurrent(batchId)) return;

    // ── Commit ──────────────────────────────────────────────────────────
    const ready = (batchImport.batch()?.pieces ?? []).filter(
      (p) => batch.saveIds?.includes(p.id) && p.status === 'saving' && p.imageUrl && !failures.has(p.id),
    );
    const savedIds: string[] = [];
    if (ready.length) {
      const result = await withRetries(() => createItemsBatch(ready.map(toCreateInput)));
      if (!stillCurrent(batchId)) return;
      applySavedItems(queryClient, result.items);
      for (const listener of savedListeners) listener(batchId, result.items);
      const created = new Set(result.items.map((item) => item.clientImportId));
      for (const piece of ready) {
        if (created.has(piece.id)) savedIds.push(piece.id);
      }
      for (const rejected of result.rejected) {
        if (rejected.clientImportId) failures.set(rejected.clientImportId, rejected.message);
      }
      for (const piece of ready) {
        if (!created.has(piece.id) && !failures.has(piece.id)) failures.set(piece.id, "Couldn't add this piece.");
      }
      track('closet_batch_saved', { saved: savedIds.length, failed: failures.size });
    }

    batchImport.get().finishSave(
      savedIds,
      [...failures].map(([id, message]) => ({ id, message })),
    );
  } catch (error) {
    if (!stillCurrent(batchId)) return;
    const current = batchImport.get();
    // Put pieces back to `ready` so the user can simply tap Save again.
    for (const piece of pieces) current.patchPiece(piece.id, { status: 'ready' });
    if (error instanceof GaveUp && error.decision.kind === 'block') {
      current.block(error.decision.reason);
      current.failSave(error.decision.reason === 'free_limit'
        ? 'Your free closet is full. Upgrade to add these pieces.'
        : error.decision.message);
      return;
    }
    current.failSave(error instanceof GaveUp ? error.decision.message : "Couldn't add these pieces. Try again.");
  }
}
