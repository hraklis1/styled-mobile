jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn(), remove: jest.fn() }),
}));
jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///var/mobile/Containers/Data/Application/NEW/Documents/' } },
}));

import { derivePhase, resetInFlight, migrateReviewBatch, useBatchImportStore } from '../store';
import { batchCost } from '../cost';
import { summarizeBatch } from '../summary';
import type { Batch, Piece, PhotoJob } from '../types';

function photo(id: string, patch: Partial<PhotoJob> = {}): PhotoJob {
  return {
    id,
    assetId: id,
    sourceUri: `file:///picker/${id}.jpg`,
    sourceWidth: 4000,
    sourceHeight: 3000,
    masterUri: null,
    masterWidth: null,
    masterHeight: null,
    scanUri: null,
    status: 'pending',
    attempts: 0,
    notBefore: 0,
    error: null,
    pieceCount: null,
    ...patch,
  };
}

function piece(id: string, photoId: string, patch: Partial<Piece> = {}): Piece {
  return {
    id,
    photoId,
    name: 'Navy blazer',
    brand: null,
    category: 'outerwear',
    subcategory: null,
    color: 'Navy',
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
    detectedName: 'Navy blazer',
    detectedCategory: 'outerwear',
    bbox: { x: 10, y: 10, width: 50, height: 60 },
    previewUri: null,
    cutoutUri: null,
    useCutout: false,
    edited: [],
    status: 'pending',
    failedStep: null,
    attempts: 0,
    notBefore: 0,
    error: null,
    imageUrl: null,
    cutoutUrl: null,
    ...patch,
  };
}

function batch(patch: Partial<Batch> = {}): Batch {
  return {
    id: 'b1',
    userId: 'u1',
    createdAt: Date.now(),
    phase: 'processing',
    photos: [],
    pieces: [],
    blocked: null,
    savedCount: 0,
    saveError: null,
    ...patch,
  };
}

const store = () => useBatchImportStore.getState();

beforeEach(() => {
  useBatchImportStore.setState({ batch: null, workspaceOpen: false });
});

describe('derivePhase', () => {
  it('stays processing while any photo or piece can still run', () => {
    expect(derivePhase(batch({ photos: [photo('a', { status: 'scanning' })] }))).toBe('processing');
    expect(derivePhase(batch({
      photos: [photo('a', { status: 'done' })],
      pieces: [piece('a-0', 'a', { status: 'extracting', extractionApproved: true })],
    }))).toBe('processing');
  });

  it('moves to review once everything has settled, failures included', () => {
    expect(derivePhase(batch({
      photos: [photo('a', { status: 'done' }), photo('b', { status: 'failed' }), photo('c', { status: 'blocked' })],
      pieces: [piece('a-0', 'a', { status: 'ready' }), piece('a-1', 'a', { status: 'failed' })],
    }))).toBe('review');
  });

  it('keeps saving until the save step says otherwise', () => {
    expect(derivePhase(batch({ phase: 'saving', photos: [photo('a', { status: 'done' })] }))).toBe('saving');
  });
});

describe('resetInFlight', () => {
  it('requeues work that a killed process left mid-request, keeping ids (and so idempotency keys)', () => {
    const reset = resetInFlight(batch({
      photos: [
        photo('a', { status: 'preparing' }),
        photo('b', { status: 'scanning', masterUri: 'm', scanUri: 's' }),
        photo('c', { status: 'done' }),
      ],
      pieces: [piece('c-0', 'c', { status: 'extracting', extractionApproved: true }), piece('c-1', 'c', { status: 'saving' })],
    }));
    expect(reset.photos.map((p) => [p.id, p.status])).toEqual([['a', 'pending'], ['b', 'ready'], ['c', 'done']]);
    expect(reset.pieces.map((p) => [p.id, p.status])).toEqual([['c-0', 'pending'], ['c-1', 'ready']]);
  });
});

describe('store actions', () => {
  it('replaces rather than duplicates a photo\'s pieces when a scan is replayed', () => {
    store().start(batch({ photos: [photo('a', { status: 'scanning' })] }));
    store().completeScan('a', [piece('a-0', 'a'), piece('a-1', 'a')]);
    store().completeScan('a', [piece('a-0', 'a'), piece('a-1', 'a')]);
    expect(store().batch?.pieces.map((p) => p.id)).toEqual(['a-0', 'a-1']);
    expect(store().batch?.photos[0]).toMatchObject({ status: 'done', pieceCount: 2 });
  });

  it('remembers which fields the user edited', () => {
    store().start(batch({ photos: [photo('a', { status: 'done' })], pieces: [piece('a-0', 'a', { status: 'ready' })] }));
    store().editPiece('a-0', { brand: 'COS', useCutout: true });
    expect(store().batch?.pieces[0]).toMatchObject({ brand: 'COS', useCutout: true, edited: ['brand'] });
  });

  it('blocks every photo still waiting when credits run out, and releases them on unblock', () => {
    store().start(batch({
      photos: [
        photo('a', { status: 'done' }),
        photo('b', { status: 'ready', masterUri: 'm', scanUri: 's' }),
        photo('c', { status: 'pending' }),
      ],
    }));
    store().block('credits');
    expect(store().batch?.photos.map((p) => p.status)).toEqual(['done', 'blocked', 'blocked']);
    expect(store().batch?.phase).toBe('review');
    store().unblock();
    expect(store().batch?.photos.map((p) => p.status)).toEqual(['done', 'ready', 'pending']);
    expect(store().batch?.phase).toBe('processing');
  });

  it('retries failed work from the step that failed', () => {
    store().start(batch({
      photos: [photo('a', { status: 'failed', masterUri: 'm', scanUri: 's', attempts: 3 }), photo('b', { status: 'done' })],
      pieces: [
        piece('b-0', 'b', { status: 'failed', failedStep: 'extract', attempts: 3, extractionApproved: true }),
        piece('b-1', 'b', { status: 'failed', failedStep: 'save' }),
      ],
    }));
    store().retryFailed();
    const b = store().batch!;
    expect(b.photos[0]).toMatchObject({ status: 'ready', attempts: 0 });
    expect(b.pieces.map((p) => p.status)).toEqual(['pending', 'ready']);
  });

  it('drops saved pieces and keeps failures for another try', () => {
    store().start(batch({
      photos: [photo('a', { status: 'done' })],
      pieces: [piece('a-0', 'a', { status: 'saving' }), piece('a-1', 'a', { status: 'saving' })],
      phase: 'saving',
    }));
    store().finishSave(['a-0'], [{ id: 'a-1', message: 'Nope' }]);
    const b = store().batch!;
    expect(b.pieces).toHaveLength(1);
    expect(b.pieces[0]).toMatchObject({ id: 'a-1', status: 'failed', failedStep: 'save' });
    expect(b).toMatchObject({ phase: 'review', savedCount: 1, saveError: "1 piece couldn't be added." });
  });
});

describe('summarizeBatch', () => {
  it('counts photos while scanning', () => {
    const s = summarizeBatch(batch({
      photos: [photo('a', { status: 'done', masterUri: 'm' }), photo('b', { status: 'scanning', masterUri: 'm' }), photo('c')],
      pieces: [piece('a-0', 'a', { status: 'ready' })],
    }));
    expect(s.title).toBe('Scanning 2 of 3 photos');
    expect(s.detail).toBe('1 piece found so far');
    expect(s.tone).toBe('working');
  });

  it('switches to details once every photo is scanned', () => {
    const s = summarizeBatch(batch({
      photos: [photo('a', { status: 'done', masterUri: 'm' })],
      pieces: [piece('a-0', 'a', { status: 'ready' }), piece('a-1', 'a', { status: 'extracting', extractionApproved: true })],
    }));
    expect(s.title).toBe('Reading details 2 of 2');
    expect(s.progress).toBeCloseTo(0.75);
  });

  it('flags what needs attention in review', () => {
    const s = summarizeBatch(batch({
      phase: 'review',
      photos: [photo('a', { status: 'done' }), photo('b', { status: 'failed' })],
      pieces: [piece('a-0', 'a', { status: 'ready' }), piece('a-1', 'a', { status: 'ready' })],
    }));
    expect(s).toMatchObject({ tone: 'attention', title: '2 pieces ready to review', detail: '1 needs attention' });
  });

  it('confirms and then dismisses a finished batch', () => {
    const s = summarizeBatch(batch({ phase: 'review', photos: [photo('a', { status: 'done' })], savedCount: 3 }));
    expect(s).toMatchObject({ tone: 'done', title: 'Added 3 pieces to your closet', action: 'dismiss' });
  });
});

describe('batchCost', () => {
  it('lets a batch through when the balance covers it', () => {
    expect(batchCost(10, 4, 540)).toEqual({ cost: 40, affordable: 10, sufficient: true });
  });

  it('says how many photos the balance does cover', () => {
    expect(batchCost(8, 4, 20)).toEqual({ cost: 32, affordable: 5, sufficient: false });
  });

  it('never blocks on an unknown balance or a free meter', () => {
    expect(batchCost(8, 4, null).sufficient).toBe(true);
    expect(batchCost(8, 0, 0).sufficient).toBe(true);
  });
});


describe('explicit extraction review', () => {
  function detected() {
    return batch({ photos: [photo('a', { status: 'done' })], pieces: Array.from({ length: 6 }, (_, i) => piece(`a-${i}`, 'a')) });
  }
  it('excludes four and snapshots exactly two, guarding duplicate submissions', () => {
    store().start(detected());
    expect(store().batch?.phase).toBe('pre-extract');
    store().setInclusion([0, 1, 2, 3].map(i => ({ id: `a-${i}`, included: false })));
    expect(store().beginExtraction(['a-0', 'a-4', 'a-5'])).toBe(true);
    expect(store().batch?.pieces.filter(p => p.extractionApproved).map(p => p.id)).toEqual(['a-4', 'a-5']);
    expect(store().beginExtraction(['a-4', 'a-5'])).toBe(false);
    expect(store().batch?.pieces[4].extractionInput?.piece.id).toBe('a-4');
  });
  it('preserves all cards at zero included; restoring does not authorize work', () => {
    store().start(detected());
    store().setInclusion(store().batch!.pieces.map(p => ({ id: p.id, included: false })));
    expect(store().batch?.pieces).toHaveLength(6);
    expect(store().beginExtraction(['a-0'])).toBe(false);
    store().setInclusion([{ id: 'a-0', included: true }]);
    expect(store().batch?.pieces.every(p => !p.extractionApproved)).toBe(true);
  });
  it('preserves edits and inclusion when a detection is replayed', () => {
    store().start(detected());
    store().editPiece('a-0', { brand: 'COS' });
    store().setInclusion([{ id: 'a-0', included: false }]);
    store().completeScan('a', detected().pieces);
    expect(store().batch?.pieces[0]).toMatchObject({ brand: 'COS', included: false });
  });
  it('requires explicit acceptance of failed basic details before saving', () => {
    store().start(batch({ photos: [photo('a', { status: 'done' })], pieces: [piece('a-0', 'a', { status: 'failed', failedStep: 'extract' })] }));
    store().beginSave(['a-0']);
    expect(store().batch?.phase).toBe('review');
    store().keepBasicDetails(['a-0']);
    store().beginSave(['a-0']);
    expect(store().batch).toMatchObject({ phase: 'saving', saveIds: ['a-0'] });
  });
  it('finishes selected saves even with excluded pending detections', () => {
    const b = detected();
    b.pieces = b.pieces.map((p, i) => ({ ...p, included: i === 0, status: i === 0 ? 'ready' : 'pending' }));
    store().start(b);
    store().beginSave(['a-0']);
    store().finishSave(['a-0'], []);
    expect(store().batch).toMatchObject({ pieces: [], savedCount: 1 });
    expect(summarizeBatch(store().batch!).tone).toBe('done');
  });
  it('migrates legacy saving targets but leaves pending extraction unapproved', () => {
    const legacy = detected();
    const migrated = migrateReviewBatch({ batch: legacy }).batch!;
    expect(migrated.pieces.every(p => p.included && !p.extractionApproved)).toBe(true);
    expect(derivePhase(migrated)).toBe('pre-extract');
    const saving = migrateReviewBatch({ batch: { ...legacy, phase: 'saving' } }).batch!;
    expect(saving.saveIds).toHaveLength(6);
  });
  it('restores approved jobs and preserves excluded pieces across restart', () => {
    store().start(detected());
    store().setInclusion([{ id: 'a-0', included: false }]);
    store().beginExtraction(['a-1']);
    store().patchPiece('a-1', { status: 'extracting' });
    const restored = resetInFlight(JSON.parse(JSON.stringify(store().batch)));
    expect(restored.pieces[0].included).toBe(false);
    expect(restored.pieces[1]).toMatchObject({ status: 'pending', extractionApproved: true });
    expect(restored.pieces[2].extractionApproved).toBeUndefined();
  });
});
