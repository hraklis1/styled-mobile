import type { SleeveLength } from '../../types/item';
import type { SizeProfile } from '../../lib/sizes';

export type Bbox = { x: number; y: number; width: number; height: number };

/**
 * One picked photo on its way through the pipeline:
 *
 *   pending ─prepare→ preparing → ready ─scan→ scanning → done
 *                                                      ↘ failed | blocked
 *
 * `ready` means both working files exist on disk; nothing past that point
 * needs the picker's own (cache-dir) copy any more.
 */
export type PhotoStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'scanning'
  | 'done'
  | 'failed'
  | 'blocked';

export type PhotoJob = {
  id: string;
  /** Picker asset id, for skipping the same photo picked twice. */
  assetId: string | null;
  /** The picker's temporary copy. Only read by the prepare step. */
  sourceUri: string;
  sourceWidth: number | null;
  sourceHeight: number | null;
  /** 2048px working copy every crop is cut from. */
  masterUri: string | null;
  masterWidth: number | null;
  masterHeight: number | null;
  /** 1024px frame sent to the scan. */
  scanUri: string | null;
  status: PhotoStatus;
  attempts: number;
  /** Epoch ms before which a retry must not start (backoff / Retry-After). */
  notBefore: number;
  error: string | null;
  /** Pieces found; null until the scan returns. */
  pieceCount: number | null;
};

/**
 *   pending ─extract→ extracting → ready ─save→ saving → saved
 *                               ↘ failed
 */
export type PieceStatus = 'pending' | 'extracting' | 'ready' | 'failed' | 'saving' | 'saved';

/** The editable garment fields, shared by the extraction result and the user's edits. */
export type PieceFields = {
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  color: string | null;
  style: string | null;
  seasons: string[];
  occasions: string[];
  material: string | null;
  fit: string | null;
  pattern: string | null;
  neckline: string | null;
  sleeveLength: SleeveLength | null;
  care: string | null;
  notableDetails: string[];
  colorPalette: string[];
  colorNormalized: string | null;
  colorTemperature: string | null;
  warmthRating: number | null;
  sizeProfile: SizeProfile | null;
};

export type Piece = PieceFields & {
  id: string;
  photoId: string;
  /** The label pass's answer, kept for the extraction prompt. */
  detectedName: string;
  detectedCategory: string;
  bbox: Bbox | null;
  /** Review-size crop (800px) of `bbox`, on disk. */
  previewUri: string | null;
  /** Background-removed WebP from the scan, on disk. */
  cutoutUri: string | null;
  useCutout: boolean;
  /**
   * Fields the user changed in review. Extraction that lands afterwards
   * (a retry, or a resume after an app kill) must not overwrite them.
   */
  edited: (keyof PieceFields)[];
  status: PieceStatus;
  /** Which step a `failed` piece failed at, so Retry knows where to resume. */
  failedStep: 'extract' | 'save' | null;
  attempts: number;
  notBefore: number;
  error: string | null;
  /** Hosted URLs once uploaded, so a retried save does not upload twice. */
  imageUrl: string | null;
  cutoutUrl: string | null;
};

export type BlockReason = 'credits' | 'free_limit';

/**
 * `phase` is the user-facing step. `processing` and `review` are derived from
 * the jobs; `saving` is entered explicitly when the user taps Save.
 */
export type BatchPhase = 'processing' | 'review' | 'saving';

export type Batch = {
  id: string;
  /** Supabase user id — a batch never survives into another account. */
  userId: string;
  createdAt: number;
  phase: BatchPhase;
  photos: PhotoJob[];
  pieces: Piece[];
  /** Set when the server refused for credits/free cap; pauses the queue. */
  blocked: BlockReason | null;
  /** Pieces saved to the closet so far, for the completion message. */
  savedCount: number;
  /** Save failed after automatic retries — the user has to act. */
  saveError: string | null;
};

