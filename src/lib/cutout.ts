import { api } from './api';
import { uploadImageToR2, isDataUri } from './uploadImage';
import type { Bbox } from '../components/wardrobe/CropAdjustModal';

/** An ordinary Error tagged so it can be recognised after transpilation. */
export type CutoutBusyError = Error & { isCutoutBusy: true };

/**
 * Build the error thrown when the server's segmentation queue is saturated
 * (HTTP 503 / 429).
 *
 * Deliberately a tagged plain Error rather than an `Error` subclass. Extending
 * a built-in does not survive downleveling: the transpiled constructor returns
 * the object produced by `super()` and discards `this`, which loses both
 * `instanceof` and any class fields — so a subclass-based marker silently reads
 * as "not busy" and turns back-off-and-retry into give-up. Tagging a real Error
 * keeps the stack and works under every bundler.
 */
export function cutoutBusyError(): CutoutBusyError {
  const err = new Error('Segmentation busy') as CutoutBusyError;
  err.name = 'CutoutBusyError';
  err.isCutoutBusy = true;
  return err;
}

/** Type guard for the busy error — never use `instanceof` for this. */
export function isCutoutBusyError(err: unknown): err is CutoutBusyError {
  return !!err && (err as CutoutBusyError).isCutoutBusy === true;
}

export type CutoutRequest = {
  /**
   * Source photo as a base64 data URL. Omit when passing `imageUrl` instead —
   * exactly one of the two is required.
   */
  imageDataUrl?: string;
  /**
   * Hosted URL of an already-uploaded original. Preferred for items that are
   * saved: the server fetches it directly, so the device doesn't download the
   * original and re-upload it as base64 just to have it segmented.
   */
  imageUrl?: string;
  /** Region of the photo to cut out, in percentages. Whole image when omitted. */
  bbox?: Bbox | null;
  /** Trusted closet metadata used to target one garment in a multi-item photo. */
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  style?: string | null;
  color?: string | null;
  /** Scene hint ('flat_lay' | 'single_garment' | anything person-ish). */
  scene?: string | null;
};

/**
 * Request a background-removed thumbnail for one garment.
 *
 * Returns a base64 data URL, or `null` when no usable cutout could be produced.
 * A null result is an ordinary outcome, not an error: segmentation may be
 * unavailable, or the server's quality gate may have rejected a mask that would
 * have produced a mangled image. Callers keep the original photo in that case.
 *
 * Deliberately does not retry. Segmentation runs one call at a time server-side,
 * so a caller that retries on its own turns a busy queue into a busier one —
 * retry/backoff policy lives in the backfill (lib/cutoutBackfill.ts), which is
 * the only caller that should ever repeat a request. A 503 surfaces as
 * CutoutBusyError so that one caller can distinguish "try later" from "no
 * cutout for this image"; everyone else can ignore the distinction and treat a
 * throw as null.
 */
/**
 * Which server pipeline last answered a cutout request.
 *
 * `legacy` serialises segmentation behind an inference gate, so callers must
 * trickle; `sam3` is hosted and has no such gate. The backfill uses this to
 * decide its pacing and concurrency, learning it from a request it was going
 * to make anyway rather than probing a capability endpoint.
 *
 * Starts `unknown` and stays there against a server too old to send the field,
 * which correctly keeps callers on the conservative legacy behaviour.
 */
export type CutoutPipeline = 'sam3' | 'legacy' | 'unknown';

let observedPipeline: CutoutPipeline = 'unknown';

export function observedCutoutPipeline(): CutoutPipeline {
  return observedPipeline;
}

export async function requestCutout({
  imageDataUrl,
  imageUrl,
  bbox,
  name,
  category,
  subcategory,
  style,
  color,
  scene,
}: CutoutRequest): Promise<string | null> {
  if (!imageDataUrl && !imageUrl) return null;
  try {
    const { data } = await api.post<{
      cutoutWebP?: string | null;
      detectionSource?: string | null;
    }>(
      '/api/cutout',
      {
        imageBase64: imageDataUrl ?? null,
        imageUrl: imageUrl ?? null,
        bbox: bbox ?? null,
        name: name ?? null,
        category: category ?? null,
        subcategory: subcategory ?? null,
        style: style ?? null,
        color: color ?? null,
        scene: scene ?? null,
      },
      // Segmentation can queue behind another request; allow well past the
      // 15s api default, but stay under the server's own 60s proxy timeout.
      { timeout: 45_000 },
    );
    if (data?.detectionSource === 'sam3' || data?.detectionSource === 'legacy') {
      observedPipeline = data.detectionSource;
    }
    return data?.cutoutWebP ? `data:image/webp;base64,${data.cutoutWebP}` : null;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 503 || status === 429) throw cutoutBusyError();
    return null;
  }
}

/**
 * Convenience wrapper for the fire-and-forget callers: never throws, so a
 * failed cutout can't take down the save path it's attached to.
 */
export async function tryRequestCutout(req: CutoutRequest): Promise<string | null> {
  try {
    return await requestCutout(req);
  } catch {
    return null;
  }
}

/**
 * Produce a cutout for a saved item and upload it, returning the hosted URL.
 *
 * The shared path for every "this item has a photo but no cutout" case: manual
 * add, replace-photo, the per-item retry in the edit sheet, and the closet
 * backfill. Returns null when no cutout could be made or stored, which callers
 * treat as "leave the item on its original photo".
 *
 * Throws CutoutBusyError (and only that) so the backfill can back off; every
 * other failure resolves to null.
 */
export async function generateCutoutForItem({
  item,
  userId,
  imageDataUrl,
}: {
  item: {
    id: number;
    imageUrl: string | null;
    name?: string | null;
    category?: string | null;
    subcategory?: string | null;
    style?: string | null;
    color?: string | null;
  };
  userId: string | number;
  /** Local source, when one is already in hand — saves a server-side fetch. */
  imageDataUrl?: string | null;
}): Promise<string | null> {
  // Prefer a local source when one is in hand. Otherwise use the item's stored
  // photo — which may itself be an inline data URI on older items, and has to be
  // sent as image *data*: the server only fetches `imageUrl` from our own object
  // storage, so passing a data: URI there is rejected outright.
  const localSource =
    imageDataUrl && isDataUri(imageDataUrl)
      ? imageDataUrl
      : item.imageUrl && isDataUri(item.imageUrl)
        ? item.imageUrl
        : null;

  if (!localSource && !item.imageUrl) return null;

  const cutoutDataUrl = await requestCutout({
    imageDataUrl: localSource ?? undefined,
    imageUrl: localSource ? undefined : item.imageUrl!,
    name: item.name ?? null,
    category: item.category ?? null,
    subcategory: item.subcategory ?? null,
    style: item.style ?? null,
    color: item.color ?? null,
  });
  if (!cutoutDataUrl) return null;

  try {
    return await uploadImageToR2(cutoutDataUrl, userId);
  } catch {
    // Never fall back to inlining the base64: unlike the original photo the
    // cutout is optional, and a data URL here would bloat every closet payload.
    return null;
  }
}
