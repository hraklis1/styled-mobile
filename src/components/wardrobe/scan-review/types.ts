import type { Bbox } from '../CropAdjustModal';
import type { SizeProfile } from '../../../lib/sizes';
import type { SleeveLength } from '../../../types/item';

export type ScanReviewStage = 'scanning' | 'pre-extract' | 'extracting' | 'review' | 'saving';

export type ScanReviewPiece = {
  id: string;
  included?: boolean;
  extraction?: 'not-started' | 'running' | 'ready' | 'failed';
  sourceLabel?: string;
  name: string;
  brand: string;
  photo: string | null;
  cutout: string | null;
  useCutout: boolean;
  canAdjustCrop: boolean;
  cropSource: string | null;
  cropBbox: Bbox | null;
  category: string | null;
  subcategory: string | null;
  color: string | null;
  /** The canonical swatch behind `color`; picking a swatch sets both. */
  colorNormalized?: string | null;
  style: string | null;
  seasons: string[];
  occasions: string[];
  material: string | null;
  fit: string | null;
  sizeProfile: SizeProfile | null;
  sleeveLength: SleeveLength | null;
  /** Fields the extraction was unsure of — drives the "worth a look" marks. */
  lowConfidenceFields?: string[];
  /** Extraction gave up on this piece; it keeps only what detection found. */
  extractFailed?: boolean;
};

export type ExtractTrigger = 'completed_review' | 'extract_now';

export type PiecePatch = Partial<ScanReviewPiece>;

/** Which in-tree sheet is open, and what it edits. */
export type SheetRequest =
  | { kind: 'brand'; target: string[] }
  | { kind: 'material'; target: string[] }
  | { kind: 'category'; target: string[] }
  | { kind: 'season'; target: string[] };

export function isReviewStage(stage: ScanReviewStage): boolean {
  return stage === 'review' || stage === 'saving';
}

export function coverUri(piece: ScanReviewPiece, stage: ScanReviewStage): string | null {
  const showingCutout = isReviewStage(stage) && Boolean(piece.cutout && piece.useCutout);
  return showingCutout ? piece.cutout : piece.photo;
}

export function pieceCountLabel(count: number): string {
  return count === 1 ? '1 piece' : `${count} pieces`;
}
