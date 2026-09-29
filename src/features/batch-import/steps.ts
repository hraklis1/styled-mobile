import type { ImagePickerAsset } from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { scanItemDirect, scanVisionPoseDirect, type PoseScanItem } from '../../hooks/useItems';
import type { ScanResult } from '../../types/item';
import { batchDirectory, cropRegion, readBase64, resizeToFile, writeBase64 } from './files';
import type { Batch, Bbox, Piece, PieceFields, PhotoJob } from './types';

/** Long edge of the working copy every crop (review, extraction, saved photo) is cut from. */
export const MASTER_MAX_DIM = 2048;
/** Long edge of the frame sent to SAM 3. It bills per call, not per pixel, and its cutouts are cut from this frame. */
export const SCAN_MAX_DIM = 1024;

export function normalizeBbox(bbox: PoseScanItem['bbox_pct'] | null | undefined): Bbox | null {
  if (!bbox) return null;
  return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
}

// ─── Batch creation ─────────────────────────────────────────────────────────

/** Build a new batch from picked assets, skipping the same photo picked twice. */
export function createBatch(userId: string, assets: ImagePickerAsset[]): Batch {
  const seen = new Set<string>();
  const photos: PhotoJob[] = [];
  for (const asset of assets) {
    const dedupeKey = asset.assetId ?? asset.uri;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    photos.push({
      id: Crypto.randomUUID(),
      assetId: asset.assetId ?? null,
      sourceUri: asset.uri,
      sourceWidth: asset.width || null,
      sourceHeight: asset.height || null,
      masterUri: null,
      masterWidth: null,
      masterHeight: null,
      scanUri: null,
      status: 'pending',
      attempts: 0,
      notBefore: 0,
      error: null,
      pieceCount: null,
    });
  }
  return {
    id: Crypto.randomUUID(),
    userId,
    createdAt: Date.now(),
    phase: 'processing',
    photos,
    pieces: [],
    blocked: null,
    savedCount: 0,
    saveError: null,
  };
}

// ─── Prepare ────────────────────────────────────────────────────────────────

/**
 * Two files per photo, both JPEG, both EXIF-free: a 2048px master for crops
 * and a 1024px frame for the scan. Nothing is held as base64 in memory, and
 * the master is written first so a 48MP original is decoded once.
 */
export async function preparePhoto(batchId: string, photo: PhotoJob): Promise<Partial<PhotoJob>> {
  const dir = batchDirectory(batchId);
  const master = await resizeToFile(
    photo.sourceUri,
    { width: photo.sourceWidth, height: photo.sourceHeight },
    MASTER_MAX_DIM,
    0.85,
    dir,
    `${photo.id}-master.jpg`,
  );
  const scan = await resizeToFile(
    master.uri,
    { width: master.width, height: master.height },
    SCAN_MAX_DIM,
    0.8,
    dir,
    `${photo.id}-scan.jpg`,
  );
  return {
    masterUri: master.uri,
    masterWidth: master.width,
    masterHeight: master.height,
    scanUri: scan.uri,
    status: 'ready',
    error: null,
  };
}

// ─── Scan ───────────────────────────────────────────────────────────────────

const EMPTY_FIELDS: Omit<PieceFields, 'name' | 'category' | 'color'> = {
  brand: null,
  subcategory: null,
  style: null,
  seasons: [],
  occasions: [],
  material: null,
  fit: null,
  pattern: null,
  neckline: null,
  sleeveLength: null,
  care: null,
  notableDetails: [],
  colorPalette: [],
  colorNormalized: null,
  colorTemperature: null,
  warmthRating: null,
  sizeProfile: null,
};

/**
 * Scan one photo and turn each garment into a piece queued for extraction.
 *
 * The idempotency key is derived from the photo, and piece ids from the
 * photo plus position, so a scan replayed after an app kill produces the same
 * pieces with the same extraction keys.
 */
export async function scanPhoto(batchId: string, photo: PhotoJob): Promise<Piece[]> {
  if (!photo.scanUri || !photo.masterUri || !photo.masterWidth || !photo.masterHeight) {
    throw new Error('Photo is not prepared');
  }
  const base64 = await readBase64(photo.scanUri);
  const { items } = await scanVisionPoseDirect(base64, `scan-${photo.id}`);
  const dir = batchDirectory(batchId);
  const size = { width: photo.masterWidth, height: photo.masterHeight };

  const pieces: Piece[] = [];
  for (const [index, item] of (items ?? []).entries()) {
    const id = `${photo.id}-${index}`;
    const bbox = normalizeBbox(item.targetBbox_pct ?? item.bbox_pct);
    const previewBbox = normalizeBbox(item.previewBbox_pct) ?? bbox;
    // Cropped from the 2048px master, not the scan frame, so the review hero
    // stays sharp and the saved photo can reach full size.
    const previewUri = previewBbox
      ? await cropRegion(photo.masterUri, size, previewBbox, { maxDim: 800, compress: 0.82 }, { dir, name: `${id}-preview.jpg` })
      : null;
    const cutoutUri = item.cutoutWebP
      ? await writeBase64(dir, `${id}-cutout.webp`, item.cutoutWebP)
      : null;
    pieces.push({
      ...EMPTY_FIELDS,
      id,
      photoId: photo.id,
      name: item.name,
      category: item.category,
      color: item.color || null,
      detectedName: item.name,
      detectedCategory: item.category,
      bbox,
      previewUri: previewUri ?? photo.masterUri,
      cutoutUri,
      useCutout: false,
      edited: [],
      status: 'pending',
      failedStep: null,
      attempts: 0,
      notBefore: 0,
      error: null,
      imageUrl: null,
      cutoutUrl: null,
    });
  }
  return pieces;
}

// ─── Extract ────────────────────────────────────────────────────────────────

/**
 * One garment, one request — deliberately not a multi-image prompt. The
 * static instructions are already prompt-cached, so batching would save
 * little and bring back the positional-contract failure (one missing row
 * shifts every attribute onto the wrong garment) that label.ts guards against.
 */
export async function extractPiece(piece: Piece, photo: PhotoJob, siblings: Piece[]): Promise<ScanResult> {
  if (!photo.masterUri || !photo.masterWidth || !photo.masterHeight) {
    throw new Error('Photo is not prepared');
  }
  const size = { width: photo.masterWidth, height: photo.masterHeight };
  const imageData = piece.bbox
    ? await cropRegion(photo.masterUri, size, piece.bbox, { maxDim: 800, compress: 0.82 })
    : null;
  const outfitContext = siblings
    .filter((other) => other.id !== piece.id)
    .map((other) => `${other.detectedName} (${other.detectedCategory})`)
    .join(', ');
  return scanItemDirect({
    imageData: imageData ?? `data:image/jpeg;base64,${await readBase64(photo.scanUri ?? photo.masterUri)}`,
    outfitContext: outfitContext || undefined,
    brandHint: piece.edited.includes('brand') && piece.brand ? piece.brand : undefined,
    targetName: piece.detectedName || undefined,
    targetCategory: piece.detectedCategory || undefined,
    idempotencyKey: `attr-${piece.id}`,
  });
}

/** Merge an extraction into a piece without touching anything the user edited. */
export function applyExtraction(piece: Piece, result: ScanResult): Partial<Piece> {
  const extracted: Partial<PieceFields> = {
    name: result.name || piece.detectedName || 'Untitled',
    brand: result.brand ?? null,
    category: result.category ?? piece.category,
    subcategory: result.subcategory ?? null,
    color: result.color ?? piece.color,
    style: result.style ?? null,
    seasons: result.seasons ?? [],
    occasions: result.occasions ?? [],
    material: result.material ?? null,
    fit: result.fit ?? null,
    pattern: result.pattern ?? null,
    neckline: result.neckline ?? null,
    sleeveLength: result.sleeveLength ?? null,
    care: result.care ?? null,
    notableDetails: result.notableDetails ?? [],
    colorPalette: result.colorPalette ?? [],
    colorNormalized: result.colorNormalized ?? null,
    colorTemperature: result.colorTemperature ?? null,
    warmthRating: result.warmthRating ?? null,
  };
  for (const key of piece.edited) delete extracted[key];
  return { ...extracted, status: 'ready', failedStep: null, error: null };
}
