import { normalizeScanCategory } from '../../lib/outfit-log-scan';
import type { Resolution, ReviewFlow, WearDetection, WearDraft, WearEvent, WearFlow, WearScan } from './types';

export const IDLE: WearFlow = { status: 'idle' };

/** Starting decisions: confident matches are applied, medium ones suggested. */
export function initialResolution(d: WearDetection): Resolution {
  if (d.match.itemId == null) return { kind: 'unresolved' };
  if (d.match.band === 'high') return { kind: 'matched', itemId: d.match.itemId, source: 'auto' };
  if (d.match.band === 'medium') return { kind: 'matched', itemId: d.match.itemId, source: 'suggested' };
  return { kind: 'unresolved' };
}

/** A new piece starts as what the scan saw; everything else is left for the user. */
export function draftFrom(d: WearDetection): WearDraft {
  return {
    name: d.attributes.name,
    brand: '',
    category: normalizeScanCategory(d.attributes.category),
    subcategory: null,
    color: d.attributes.color || null,
    colorNormalized: null,
    style: null,
    seasons: [],
    occasions: [],
    material: null,
    fit: null,
    sizeProfile: null,
    sleeveLength: null,
  };
}

export function initialResolutions(scan: WearScan): Record<string, Resolution> {
  return Object.fromEntries(scan.detections.map((d) => [d.id, initialResolution(d)]));
}

function inReview(flow: WearFlow): flow is ReviewFlow {
  return flow.status === 'reviewing';
}

/** Change one detection; everything else in the review is left as it was. */
function resolve(flow: ReviewFlow, detectionId: string, next: Resolution): ReviewFlow {
  if (!(detectionId in flow.resolutions)) return flow;
  return {
    ...flow,
    resolutions: { ...flow.resolutions, [detectionId]: next },
    resolving: null,
    saveError: null,
  };
}

/**
 * The whole flow as a pure function, so every transition is testable and the
 * persisted state is the only state. Events that don't apply to the current
 * status are ignored rather than thrown: a late scan response for a capture
 * the user has already replaced is simply dropped.
 */
export function reduce(flow: WearFlow, event: WearEvent): WearFlow {
  switch (event.type) {
    case 'capture':
      return { status: 'processing', id: event.id, photoUri: event.photoUri, date: event.date, startedAt: event.now };

    case 'scanSucceeded':
      if (flow.status !== 'processing' || flow.id !== event.id) return flow;
      return {
        status: 'reviewing',
        id: flow.id,
        photoUri: flow.photoUri,
        date: flow.date,
        scan: event.scan,
        resolutions: initialResolutions(event.scan),
        additionalItemIds: [],
        resolving: null,
        saveError: null,
        updatedAt: event.now,
      };

    case 'scanFailed':
      if (flow.status !== 'processing' || flow.id !== event.id) return flow;
      return { status: 'failed', id: flow.id, photoUri: flow.photoUri, date: flow.date, message: event.message, offline: event.offline ?? false };

    case 'retry':
      if (flow.status !== 'failed') return flow;
      return { status: 'processing', id: flow.id, photoUri: flow.photoUri, date: flow.date, startedAt: event.now };

    case 'confirm':
      if (!inReview(flow)) return flow;
      return resolve(flow, event.detectionId, { kind: 'matched', itemId: event.itemId, source: 'user' });

    case 'addAdditionalItem':
      if (!inReview(flow) || selectedItemIds(flow).includes(event.itemId)) return flow;
      return { ...flow, additionalItemIds: [...flow.additionalItemIds, event.itemId], saveError: null };

    case 'removeAdditionalItem':
      if (!inReview(flow) || !flow.additionalItemIds.includes(event.itemId)) return flow;
      return { ...flow, additionalItemIds: flow.additionalItemIds.filter((id) => id !== event.itemId), saveError: null };

    case 'markNew': {
      if (!inReview(flow)) return flow;
      const current = flow.resolutions[event.detectionId];
      const detection = flow.scan.detections.find((d) => d.id === event.detectionId);
      if (!detection) return flow;
      // Re-choosing "Add as new" keeps the edits already made to the draft.
      const draft = current?.kind === 'new' ? current.draft : draftFrom(detection);
      return {
        ...resolve(flow, event.detectionId, { kind: 'new', draft }),
        resolving: { detectionId: event.detectionId, mode: 'new' },
      };
    }

    case 'editDraft': {
      if (!inReview(flow)) return flow;
      const current = flow.resolutions[event.detectionId];
      if (current?.kind !== 'new') return flow;
      return {
        ...flow,
        resolutions: { ...flow.resolutions, [event.detectionId]: { kind: 'new', draft: { ...current.draft, ...event.patch } } },
        saveError: null,
      };
    }

    case 'clear':
      if (!inReview(flow)) return flow;
      return resolve(flow, event.detectionId, { kind: 'unresolved' });

    case 'dismiss': {
      if (!inReview(flow)) return flow;
      const current = flow.resolutions[event.detectionId];
      if (!current || current.kind === 'dismissed') return flow;
      return resolve(flow, event.detectionId, { kind: 'dismissed', previous: current });
    }

    case 'restore': {
      if (!inReview(flow)) return flow;
      const current = flow.resolutions[event.detectionId];
      if (current?.kind !== 'dismissed') return flow;
      return resolve(flow, event.detectionId, current.previous);
    }

    case 'openResolve':
      if (!inReview(flow) || !(event.detectionId in flow.resolutions)) return flow;
      return { ...flow, resolving: { detectionId: event.detectionId, mode: event.mode } };

    case 'closeResolve':
      if (!inReview(flow)) return flow;
      return { ...flow, resolving: null };

    case 'setDate':
      if (flow.status === 'saving' || flow.status === 'logged' || flow.status === 'idle') return flow;
      return { ...flow, date: event.date };

    case 'saveStarted':
      if (!inReview(flow) || !canLog(flow)) return flow;
      return { ...flow, status: 'saving', resolving: null, saveError: null };

    case 'saveFailed':
      if (flow.status !== 'saving') return flow;
      return { ...flow, status: 'reviewing', saveError: event.message };

    case 'saved':
      if (flow.status !== 'saving') return flow;
      return {
        status: 'logged',
        id: flow.id,
        photoUri: flow.photoUri,
        date: flow.date,
        logId: event.logId,
        itemIds: event.itemIds,
        alreadyLoggedItemIds: event.alreadyLoggedItemIds,
      };

    case 'reset':
      return IDLE;
  }
}

// ── Selectors ────────────────────────────────────────────────────────────────

/** A row the Check filter should show: undecided, or a suggestion not yet confirmed. */
export function needsCheck(r: Resolution): boolean {
  return r.kind === 'unresolved' || (r.kind === 'matched' && r.source === 'suggested');
}

export function reviewCounts(flow: ReviewFlow) {
  const all = Object.values(flow.resolutions);
  return {
    total: all.length + flow.additionalItemIds.length,
    toCheck: all.filter(needsCheck).length,
    unresolved: all.filter((r) => r.kind === 'unresolved').length,
    logging: selectedItemIds(flow).length + all.filter((r) => r.kind === 'new').length,
    newItems: all.filter((r) => r.kind === 'new').length,
  };
}

/**
 * Log once every piece is decided — a medium match counts only after the
 * user confirms it, so a wrong guess never inflates a wear count — and at
 * least one piece will be logged.
 */
export function canLog(flow: ReviewFlow): boolean {
  const c = reviewCounts(flow);
  return c.toCheck === 0 && c.logging > 0;
}

/** Existing closet items to log, deduplicated (two rows can land on one item). */
export function matchedItemIds(flow: ReviewFlow): number[] {
  const ids: number[] = [];
  for (const r of Object.values(flow.resolutions)) {
    if (r.kind === 'matched' && !ids.includes(r.itemId)) ids.push(r.itemId);
  }
  return ids;
}

/** Unique closet IDs, including manually added garments. */
export function selectedItemIds(flow: ReviewFlow): number[] {
  return [...new Set([...matchedItemIds(flow), ...flow.additionalItemIds])];
}

/** A removed closet item must be corrected after the wardrobe has loaded. */
export function reviewQueue(flow: ReviewFlow, availableIds?: ReadonlySet<number>): string[] {
  return orderedDetections(flow.scan).filter((d) => {
    const r = flow.resolutions[d.id];
    return needsCheck(r) || (r.kind === 'matched' && availableIds != null && !availableIds.has(r.itemId));
  }).map((d) => d.id);
}

export function newDetections(flow: ReviewFlow): WearDetection[] {
  return flow.scan.detections.filter((d) => flow.resolutions[d.id]?.kind === 'new');
}

/** Other rows already mapped to this item — shown so a double match is visible. */
export function sharedMatch(flow: ReviewFlow, detectionId: string): string[] {
  const r = flow.resolutions[detectionId];
  if (r?.kind !== 'matched') return [];
  return Object.entries(flow.resolutions)
    .filter(([id, o]) => id !== detectionId && o.kind === 'matched' && o.itemId === r.itemId)
    .map(([id]) => id);
}

/** Outer layers first, then what's under them, accessories last. */
const LAYER_ORDER = { outer: 0, mid: 1, base: 2, accessory: 3 } as const;
export function orderedDetections(scan: WearScan): WearDetection[] {
  return [...scan.detections].sort(
    (a, b) => LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer] || Number(a.id.slice(1)) - Number(b.id.slice(1)),
  );
}

/** Stable per flow and detection, so a retried save reuses the item it made. */
export function clientImportIdFor(flowId: string, detectionId: string): string {
  return `wear-${flowId}-${detectionId}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
}
