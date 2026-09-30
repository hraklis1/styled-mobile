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
 * What the user has decided for one detection. `suggested` is a medium match
 * applied on the user's behalf: it logs as a match, but the Check filter keeps
 * it in view until confirmed or changed.
 */
export type Resolution =
  | { kind: 'unresolved' }
  | { kind: 'matched'; itemId: number; source: 'auto' | 'suggested' | 'user' }
  | { kind: 'new' }
  | { kind: 'dismissed'; previous: Exclude<Resolution, { kind: 'dismissed' }> };

export type ResolveMode = 'library' | 'new';

type Base = { id: string; photoUri: string; date: string };

export type WearFlow =
  | { status: 'idle' }
  | (Base & { status: 'processing'; startedAt: number })
  | (Base & { status: 'failed'; message: string })
  | (Base & {
      status: 'reviewing' | 'saving';
      scan: WearScan;
      resolutions: Record<string, Resolution>;
      resolving: { detectionId: string; mode: ResolveMode } | null;
      saveError: string | null;
      updatedAt: number;
    })
  | (Base & { status: 'logged'; logId: number; itemIds: number[]; alreadyLoggedItemIds: number[] });

export type ReviewFlow = Extract<WearFlow, { status: 'reviewing' | 'saving' }>;

export type WearEvent =
  | { type: 'capture'; id: string; photoUri: string; date: string; now: number }
  | { type: 'scanSucceeded'; id: string; scan: WearScan; now: number }
  | { type: 'scanFailed'; id: string; message: string }
  | { type: 'retry'; now: number }
  | { type: 'confirm'; detectionId: string; itemId: number }
  | { type: 'openResolve'; detectionId: string; mode: ResolveMode }
  | { type: 'closeResolve' }
  | { type: 'markNew'; detectionId: string }
  | { type: 'clear'; detectionId: string }
  | { type: 'dismiss'; detectionId: string }
  | { type: 'restore'; detectionId: string }
  | { type: 'setDate'; date: string }
  | { type: 'saveStarted' }
  | { type: 'saveFailed'; message: string }
  | { type: 'saved'; logId: number; itemIds: number[]; alreadyLoggedItemIds: number[] }
  | { type: 'reset' };
