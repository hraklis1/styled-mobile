jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn(), remove: jest.fn() }),
}));
jest.mock('expo-file-system', () => ({ Paths: { document: { uri: 'file:///docs/' } } }));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => jest.fn()) }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../files', () => ({
  batchDirectory: jest.fn(),
  cropRegion: jest.fn(),
  deleteBatchFiles: jest.fn(),
  deleteFile: jest.fn(),
  pruneBatchFiles: jest.fn(),
  readBase64: jest.fn(),
  writeBase64: jest.fn(),
}));
jest.mock('../save', () => ({ runSave: jest.fn(() => Promise.resolve()) }));
jest.mock('../steps', () => ({
  preparePhoto: jest.fn(),
  scanPhoto: jest.fn(),
  extractPiece: jest.fn(),
  applyExtraction: jest.fn(() => ({ status: 'ready', failedStep: null, error: null })),
}));

import { kick, startBatchRunner } from '../runner';
import { useBatchImportStore } from '../store';
import { extractPiece, preparePhoto, scanPhoto } from '../steps';
import type { Batch, Piece, PhotoJob } from '../types';

const prepare = preparePhoto as jest.Mock;
const scan = scanPhoto as jest.Mock;
const extract = extractPiece as jest.Mock;

function photo(id: string): PhotoJob {
  return {
    id, assetId: id, sourceUri: id, sourceWidth: 100, sourceHeight: 100,
    masterUri: null, masterWidth: null, masterHeight: null, scanUri: null,
    status: 'pending', attempts: 0, notBefore: 0, error: null, pieceCount: null,
  };
}

function pieceFor(photoId: string, index: number): Piece {
  return {
    id: `${photoId}-${index}`, photoId, name: 'Tee', brand: null, category: 'top', subcategory: null,
    color: 'White', style: null, seasons: [], occasions: [], material: null, fit: null, pattern: null,
    neckline: null, sleeveLength: null, care: null, notableDetails: [], colorPalette: [],
    colorNormalized: null, colorTemperature: null, warmthRating: null, sizeProfile: null,
    detectedName: 'Tee', detectedCategory: 'top', bbox: null, previewUri: null,
    edited: [], status: 'pending', failedStep: null, attempts: 0, notBefore: 0,
    error: null, imageUrl: null,
  };
}

function startBatch(count: number) {
  const batch: Batch = {
    id: 'b1', userId: 'u1', createdAt: Date.now(), phase: 'processing',
    photos: Array.from({ length: count }, (_, i) => photo(`p${i}`)),
    pieces: [], blocked: null, savedCount: 0, saveError: null,
  };
  useBatchImportStore.getState().start(batch);
}

const httpError = (status: number, data: Record<string, unknown> = {}) => ({
  isAxiosError: true,
  response: { status, data, headers: {} },
});

/** Let every pending promise chain (and the kicks they trigger) run. */
async function drain(rounds = 50) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

let stop: () => void;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useBatchImportStore.setState({ batch: null, workspaceOpen: false });
  prepare.mockImplementation(async (_batchId: string, p: PhotoJob) => ({
    masterUri: `m-${p.id}`, masterWidth: 100, masterHeight: 100, scanUri: `s-${p.id}`, status: 'ready', error: null,
  }));
  scan.mockImplementation(async (_batchId: string, p: PhotoJob) => [pieceFor(p.id, 0)]);
  extract.mockResolvedValue({});
  stop = startBatchRunner();
});

afterEach(() => {
  stop();
  jest.useRealTimers();
});

async function runUntilSettled() {
  for (let i = 0; i < 40; i++) {
    await drain();
    jest.advanceTimersByTime(20_000);
  }
  await drain();
}

it('pauses after detection and extracts only explicitly approved pieces', async () => {
  startBatch(3);
  kick();
  await runUntilSettled();
  const batch = useBatchImportStore.getState().batch!;
  expect(batch.phase).toBe('pre-extract');
  expect(batch.photos.every((p) => p.status === 'done')).toBe(true);
  expect(extract).not.toHaveBeenCalled();
  useBatchImportStore.getState().beginExtraction(['p0-0', 'p2-0']);
  await runUntilSettled();
  expect(extract.mock.calls.map(([p]) => p.id)).toEqual(['p0-0', 'p2-0']);
  expect(useBatchImportStore.getState().batch!.pieces.map(p => p.status)).toEqual(['ready', 'pending', 'ready']);
});

it('finishes the other nine when one photo keeps failing', async () => {
  scan.mockImplementation(async (_batchId: string, p: PhotoJob) => {
    if (p.id === 'p4') throw httpError(500);
    return [pieceFor(p.id, 0)];
  });
  startBatch(10);
  kick();
  await runUntilSettled();
  const batch = useBatchImportStore.getState().batch!;
  expect(batch.phase).toBe('pre-extract');
  expect(batch.photos.filter((p) => p.status === 'done')).toHaveLength(9);
  expect(batch.photos.find((p) => p.id === 'p4')).toMatchObject({ status: 'failed' });
  // Three automatic attempts, each with the same photo (and so the same idempotency key).
  expect(scan.mock.calls.filter(([, p]) => p.id === 'p4')).toHaveLength(3);
  expect(batch.pieces).toHaveLength(9);
});

it('stops scanning the moment the server says the credits are gone', async () => {
  let scans = 0;
  scan.mockImplementation(async (_batchId: string, p: PhotoJob) => {
    scans += 1;
    if (scans >= 3) throw httpError(402, { code: 'INSUFFICIENT_CREDITS', message: 'Out of credits' });
    return [pieceFor(p.id, 0)];
  });
  startBatch(10);
  kick();
  await runUntilSettled();
  const batch = useBatchImportStore.getState().batch!;
  expect(batch.blocked).toBe('credits');
  expect(batch.phase).toBe('pre-extract');
  // Only the scans already in flight when the refusal arrived were attempted.
  expect(scan.mock.calls.length).toBeLessThanOrEqual(5);
  expect(batch.photos.filter((p) => p.status === 'blocked').length).toBeGreaterThanOrEqual(5);
});

it('never runs more than three scans or one prepare at a time', async () => {
  let scansInFlight = 0;
  let maxScans = 0;
  let preparesInFlight = 0;
  let maxPrepares = 0;
  prepare.mockImplementation(async (_batchId: string, p: PhotoJob) => {
    preparesInFlight += 1;
    maxPrepares = Math.max(maxPrepares, preparesInFlight);
    await drain(3);
    preparesInFlight -= 1;
    return { masterUri: `m-${p.id}`, masterWidth: 100, masterHeight: 100, scanUri: `s-${p.id}`, status: 'ready', error: null };
  });
  scan.mockImplementation(async (_batchId: string, p: PhotoJob) => {
    scansInFlight += 1;
    maxScans = Math.max(maxScans, scansInFlight);
    await drain(10);
    scansInFlight -= 1;
    return [pieceFor(p.id, 0)];
  });
  startBatch(10);
  kick();
  await runUntilSettled();
  expect(maxPrepares).toBe(1);
  expect(maxScans).toBeLessThanOrEqual(3);
  expect(maxScans).toBeGreaterThan(1);
  expect(useBatchImportStore.getState().batch!.phase).toBe('pre-extract');
});

it('does not extract while scanning or after detection without approval', async () => {
  const order: string[] = [];
  scan.mockImplementation(async (_batchId: string, p: PhotoJob) => {
    order.push(`scan:${p.id}`);
    await drain(5);
    return [pieceFor(p.id, 0)];
  });
  extract.mockImplementation(async (piece: Piece) => {
    order.push(`extract:${piece.id}`);
    return {};
  });
  startBatch(6);
  kick();
  await runUntilSettled();
  expect(order).toHaveLength(6);
  expect(extract).not.toHaveBeenCalled();
  useBatchImportStore.getState().beginExtraction(['p0-0']);
  await runUntilSettled();
  expect(order.indexOf('extract:p0-0')).toBeGreaterThan(order.indexOf('scan:p5'));
  expect(extract).toHaveBeenCalledTimes(1);
});
