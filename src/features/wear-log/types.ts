import type { SizeProfile } from '../../lib/sizes';
import type { SleeveLength } from '../../types/item';

// The outfit-log scan's v2 contract (server/vision/wearScan.ts in ../Styled)
// and the review flow built on it.

export type WearBand = 'high' | 'medium' | 'low';
export type WearLayer = 'outer' | 'mid' | 'base' | 'accessory';

export type BboxPct = { x: number; y: number; width: number; height: number };

export type WearCandidate = { itemId: number; score: number; reason?: 'color' | 'shape' };

export type WearDetection = {
  id: string;
  bbox_pct: BboxPct | null;
  cutoutUrl: string | null;
  /** Background-intact crop for thumbnails; absent on scans from before it existed. */
  cropUrl?: string | null;
  layer: WearLayer;
  occludedBy?: string;
  attributes: { name: string; category: string; color: string; description: string };
  lowConfidenceFields: string[];
  match: { itemId: number | null; confidence: number; band: WearBand };
  candidates: WearCandidate[];
  holdReason?: 'occluded' | 'lookalike';
};

export type WearScan = {
  format: 2;
  scanId: string;
  imageUrl: string | null;
  detections: WearDetection[];
};

/**
 * A new closet piece being described before it's logged: the Add Clothing
 * spec fields, seeded from what the scan saw. Saved with the review, so an
 * edit survives closing the app, and only created when the log is saved.
 */
export type WearDraft = {
  name: string;
  brand: string;
  category: string | null;
  subcategory: string | null;
  color: string | null;
  colorNormalized: string | null;
  style: string | null;
  seasons: string[];
  occasions: string[];
  material: string | null;
  fit: string | null;
  sizeProfile: SizeProfile | null;
  sleeveLength: SleeveLength | null;
};

/**
 * What the user has decided for one detection. `suggested` is a medium match
 * pre-filled on the user's behalf: it must be confirmed (or changed) before
 * the outfit can be logged.
 */
export type Resolution =
  | { kind: 'unresolved' }
  | { kind: 'matched'; itemId: number; source: 'auto' | 'suggested' | 'user' }
  | { kind: 'new'; draft: WearDraft }
  | { kind: 'dismissed'; previous: Exclude<Resolution, { kind: 'dismissed' }> };

export type ResolveMode = 'library' | 'new';

type Base = { id: string; photoUri: string; date: string };

export type WearFlow =
  | { status: 'idle' }
  | (Base & { status: 'processing'; startedAt: number })
  /** `offline` failures wait for the connection and retry on their own. */
  | (Base & { status: 'failed'; message: string; offline: boolean })
  | (Base & {
      status: 'reviewing' | 'saving';
      scan: WearScan;
      resolutions: Record<string, Resolution>;
      /** Existing closet items the photo scan missed. */
      additionalItemIds: number[];
      resolving: { detectionId: string; mode: ResolveMode } | null;
      saveError: string | null;
      updatedAt: number;
    })
  | (Base & { status: 'logged'; logId: number; itemIds: number[]; alreadyLoggedItemIds: number[] });

export type ReviewFlow = Extract<WearFlow, { status: 'reviewing' | 'saving' }>;

export type WearEvent =
  | { type: 'capture'; id: string; photoUri: string; date: string; now: number }
  | { type: 'scanSucceeded'; id: string; scan: WearScan; now: number }
  | { type: 'scanFailed'; id: string; message: string; offline?: boolean }
  | { type: 'retry'; now: number }
  | { type: 'confirm'; detectionId: string; itemId: number }
  | { type: 'addAdditionalItem'; itemId: number }
  | { type: 'removeAdditionalItem'; itemId: number }
  | { type: 'openResolve'; detectionId: string; mode: ResolveMode }
  | { type: 'closeResolve' }
  | { type: 'markNew'; detectionId: string }
  | { type: 'editDraft'; detectionId: string; patch: Partial<WearDraft> }
  | { type: 'clear'; detectionId: string }
  | { type: 'dismiss'; detectionId: string }
  | { type: 'restore'; detectionId: string }
  | { type: 'setDate'; date: string }
  | { type: 'saveStarted' }
  | { type: 'saveFailed'; message: string }
  | { type: 'saved'; logId: number; itemIds: number[]; alreadyLoggedItemIds: number[] }
  | { type: 'reset' };
