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
  /** Same category and name as an earlier included piece; derived in review. */
  possibleDuplicate?: boolean;
  /** Extraction gave up on this piece; it keeps only what detection found. */
  extractFailed?: boolean;
  /** Pre-extract: the box overlaps an earlier piece's in the same category. */
  overlap?: { of: string; strong: boolean };
};

export type ExtractTrigger = 'completed_review' | 'extract_now';

export type PiecePatch = Partial<ScanReviewPiece>;

/** Which in-tree sheet is open, and what it edits. */
export type SheetRequest =
  | { kind: 'brand'; target: string[]; includedOnly?: boolean; returnTo?: string }
  | { kind: 'material'; target: string[]; returnTo?: string }
  | { kind: 'category'; target: string[]; returnTo?: string }
  /** The review's per-piece editor: preview, crop, type and brand. */
  | { kind: 'editor'; target: string[] }
  /** Choosing the type of a piece the user is adding by hand. */
  | { kind: 'add-type'; target: string[] }
  | { kind: 'season'; target: string[] }
  /** A before/after of a polished piece. */
  | { kind: 'polish-example'; target: string[] }
  /** Menus: the footer's batch edits and the header's import options. */
  | { kind: 'options'; target: string[] };

export function isReviewStage(stage: ScanReviewStage): boolean {
  return stage === 'review' || stage === 'saving';
}


export function pieceCountLabel(count: number): string {
  return count === 1 ? '1 piece' : `${count} pieces`;
}
