jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn(), remove: jest.fn() }),
}));
jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///var/mobile/Containers/Data/Application/NEW/Documents/' } },
}));

import { canLog, clientImportIdFor, draftFrom, IDLE, matchedItemIds, needsCheck, orderedDetections, reduce, reviewCounts, sharedMatch } from '../reducer';
import { REVIEW_MAX_AGE_MS, rehydrateFlow } from '../store';
import type { ReviewFlow, WearDetection, WearFlow, WearScan } from '../types';

function det(id: string, band: WearDetection['match']['band'], itemId: number | null, layer: WearDetection['layer'] = 'base'): WearDetection {
  return {
    id,
    bbox_pct: null,
    cutoutUrl: null,
    layer,
    attributes: { name: id, category: 'top', color: 'black', description: '' },
    lowConfidenceFields: [],
    match: { itemId, confidence: band === 'high' ? 0.9 : band === 'medium' ? 0.6 : 0.2, band },
    candidates: itemId ? [{ itemId, score: 0.9 }] : [],
  };
}

const scan: WearScan = {
  format: 2,
  scanId: 'flow-1',
  imageUrl: null,
  detections: [det('d0', 'high', 1), det('d1', 'medium', 2), det('d2', 'low', null), det('d3', 'high', 4, 'outer')],
};

function reviewing(): ReviewFlow {
  let flow: WearFlow = reduce(IDLE, { type: 'capture', id: 'flow-1', photoUri: 'file:///p.jpg', date: '2026-09-30', now: 1 });
  flow = reduce(flow, { type: 'scanSucceeded', id: 'flow-1', scan, now: 2 });
  return flow as ReviewFlow;
}

describe('wear-log reducer', () => {
  it('capture → processing → reviewing seeds resolutions by band', () => {
    const flow = reviewing();
    expect(flow.status).toBe('reviewing');
    expect(flow.resolutions.d0).toEqual({ kind: 'matched', itemId: 1, source: 'auto' });
    expect(flow.resolutions.d1).toEqual({ kind: 'matched', itemId: 2, source: 'suggested' });
    expect(flow.resolutions.d2).toEqual({ kind: 'unresolved' });
  });

  it('drops a late scan response for a replaced capture', () => {
    const flow = reduce(IDLE, { type: 'capture', id: 'new', photoUri: 'x', date: '2026-09-30', now: 1 });
    expect(reduce(flow, { type: 'scanSucceeded', id: 'old', scan, now: 2 })).toBe(flow);
  });

  it('failure keeps the photo and retry goes back to processing', () => {
    let flow = reduce(IDLE, { type: 'capture', id: 'f', photoUri: 'x', date: '2026-09-30', now: 1 });
    flow = reduce(flow, { type: 'scanFailed', id: 'f', message: 'offline', offline: true });
    expect(flow).toMatchObject({ status: 'failed', photoUri: 'x', offline: true });
    expect(reduce(flow, { type: 'retry', now: 3 })).toMatchObject({ status: 'processing', id: 'f' });
  });

  it('resolving one detection leaves every other one untouched', () => {
    const before = reviewing();
    let flow = reduce(before, { type: 'openResolve', detectionId: 'd2', mode: 'library' }) as ReviewFlow;
    expect(flow.resolving).toEqual({ detectionId: 'd2', mode: 'library' });
    flow = reduce(flow, { type: 'confirm', detectionId: 'd2', itemId: 9 }) as ReviewFlow;
    expect(flow.resolving).toBeNull();
    expect(flow.resolutions.d2).toEqual({ kind: 'matched', itemId: 9, source: 'user' });
    for (const id of ['d0', 'd1', 'd3']) expect(flow.resolutions[id]).toBe(before.resolutions[id]);
  });

  it('cancelling a resolve changes nothing', () => {
    const before = reviewing();
    const open = reduce(before, { type: 'openResolve', detectionId: 'd2', mode: 'new' }) as ReviewFlow;
    const closed = reduce(open, { type: 'closeResolve' }) as ReviewFlow;
    expect(closed.resolutions).toBe(before.resolutions);
  });

  it('dismiss is undoable back to the exact previous decision', () => {
    let flow = reduce(reviewing(), { type: 'dismiss', detectionId: 'd1' }) as ReviewFlow;
    expect(flow.resolutions.d1.kind).toBe('dismissed');
    flow = reduce(flow, { type: 'restore', detectionId: 'd1' }) as ReviewFlow;
    expect(flow.resolutions.d1).toEqual({ kind: 'matched', itemId: 2, source: 'suggested' });
  });

  it('Log waits for every detection to be decided', () => {
    let flow = reviewing();
    expect(canLog(flow)).toBe(false);
    expect(reduce(flow, { type: 'saveStarted' })).toBe(flow);
    flow = reduce(flow, { type: 'markNew', detectionId: 'd2' }) as ReviewFlow;
    // d1 is a medium match: suggested, not yet confirmed.
    expect(reviewCounts(flow)).toMatchObject({ unresolved: 0, toCheck: 1, logging: 4, newItems: 1 });
    expect(canLog(flow)).toBe(false);
    flow = reduce(flow, { type: 'confirm', detectionId: 'd1', itemId: 2 }) as ReviewFlow;
    expect(canLog(flow)).toBe(true);
  });

  it('Add as new seeds a draft from the scan and opens it for editing', () => {
    const flow = reduce(reviewing(), { type: 'markNew', detectionId: 'd2' }) as ReviewFlow;
    expect(flow.resolving).toEqual({ detectionId: 'd2', mode: 'new' });
    expect(flow.resolutions.d2).toMatchObject({ kind: 'new', draft: { name: 'd2', category: 'top', color: 'black', brand: '' } });
  });

  it('draft edits persist, and re-choosing Add as new keeps them', () => {
    let flow = reduce(reviewing(), { type: 'markNew', detectionId: 'd2' }) as ReviewFlow;
    flow = reduce(flow, { type: 'editDraft', detectionId: 'd2', patch: { brand: 'COS', material: 'Wool' } }) as ReviewFlow;
    flow = reduce(flow, { type: 'clear', detectionId: 'd2' }) as ReviewFlow;
    expect(flow.resolutions.d2).toEqual({ kind: 'unresolved' });
    flow = reduce(flow, { type: 'markNew', detectionId: 'd2' }) as ReviewFlow;
    // Clearing drops the draft; only an uncleared re-open keeps it.
    expect(flow.resolutions.d2).toMatchObject({ draft: { brand: '' } });
    flow = reduce(flow, { type: 'editDraft', detectionId: 'd2', patch: { brand: 'COS' } }) as ReviewFlow;
    flow = reduce(flow, { type: 'markNew', detectionId: 'd2' }) as ReviewFlow;
    expect(flow.resolutions.d2).toMatchObject({ draft: { brand: 'COS' } });
  });

  it('editDraft is ignored for rows that are not new', () => {
    const before = reviewing();
    expect(reduce(before, { type: 'editDraft', detectionId: 'd0', patch: { brand: 'X' } })).toBe(before);
  });

  it('a failed save returns to review with nothing lost', () => {
    const ready = reduce(reduce(reviewing(), { type: 'dismiss', detectionId: 'd2' }), { type: 'confirm', detectionId: 'd1', itemId: 2 }) as ReviewFlow;
    const saving = reduce(ready, { type: 'saveStarted' });
    expect(saving.status).toBe('saving');
    const failed = reduce(saving, { type: 'saveFailed', message: 'offline' }) as ReviewFlow;
    expect(failed.status).toBe('reviewing');
    expect(failed.saveError).toBe('offline');
    expect(failed.resolutions).toBe(ready.resolutions);
  });

  it('saved → logged, and edits are ignored while saving', () => {
    const decided = reduce(reduce(reviewing(), { type: 'dismiss', detectionId: 'd2' }), { type: 'confirm', detectionId: 'd1', itemId: 2 });
    const saving = reduce(decided, { type: 'saveStarted' });
    expect(reduce(saving, { type: 'confirm', detectionId: 'd0', itemId: 7 })).toBe(saving);
    expect(reduce(saving, { type: 'setDate', date: '2026-09-01' })).toBe(saving);
    const logged = reduce(saving, { type: 'saved', logId: 5, itemIds: [1, 2, 4], alreadyLoggedItemIds: [] });
    expect(logged).toMatchObject({ status: 'logged', logId: 5 });
  });

  it('two rows on one item log it once and point at each other', () => {
    const flow = reduce(reviewing(), { type: 'confirm', detectionId: 'd2', itemId: 1 }) as ReviewFlow;
    expect(matchedItemIds(flow)).toEqual([1, 2, 4]);
    expect(sharedMatch(flow, 'd2')).toEqual(['d0']);
  });

  it('orders outer layers first', () => {
    expect(orderedDetections(scan).map((d) => d.id)).toEqual(['d3', 'd0', 'd1', 'd2']);
  });

  it('needsCheck covers undecided rows and unconfirmed suggestions only', () => {
    expect(needsCheck({ kind: 'unresolved' })).toBe(true);
    expect(needsCheck({ kind: 'matched', itemId: 1, source: 'suggested' })).toBe(true);
    expect(needsCheck({ kind: 'matched', itemId: 1, source: 'user' })).toBe(false);
    expect(needsCheck({ kind: 'new', draft: draftFrom(det('d9', 'low', null)) })).toBe(false);
  });
});

describe('wear-log persistence', () => {
  it('resumes a review, turns an interrupted save back into review', () => {
    const flow = reviewing();
    expect(rehydrateFlow(flow, flow.updatedAt + 1000).status).toBe('reviewing');
    expect(rehydrateFlow({ ...flow, status: 'saving' }, flow.updatedAt).status).toBe('reviewing');
  });

  it('drops stale reviews and finished logs', () => {
    const flow = reviewing();
    expect(rehydrateFlow(flow, flow.updatedAt + REVIEW_MAX_AGE_MS + 1)).toEqual(IDLE);
    expect(rehydrateFlow({ status: 'logged', id: 'a', photoUri: 'x', date: 'd', logId: 1, itemIds: [], alreadyLoggedItemIds: [] }, 2)).toEqual(IDLE);
  });

  it('keeps an interrupted or offline scan so the runner can resume it', () => {
    const processing = { status: 'processing', id: 'a', photoUri: 'x', date: 'd', startedAt: 1 } as const;
    expect(rehydrateFlow(processing, 5)).toMatchObject({ status: 'processing', id: 'a', startedAt: 5 });
    expect(rehydrateFlow(processing, REVIEW_MAX_AGE_MS + 2)).toEqual(IDLE);
    const offline = { status: 'failed', id: 'b', photoUri: 'x', date: 'd', message: 'm', offline: true } as const;
    expect(rehydrateFlow(offline, 5)).toBe(offline);
  });

  it('gives a draft to a new piece saved before drafts existed', () => {
    const flow = reviewing();
    const legacy = { ...flow, resolutions: { ...flow.resolutions, d2: { kind: 'new' } } } as unknown as WearFlow;
    const restored = rehydrateFlow(legacy, flow.updatedAt) as ReviewFlow;
    expect(restored.resolutions.d2).toMatchObject({ kind: 'new', draft: { name: 'd2' } });
  });

  it('builds import ids the server accepts', () => {
    expect(clientImportIdFor('3f2a-uuid', 'd1')).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  });
});
