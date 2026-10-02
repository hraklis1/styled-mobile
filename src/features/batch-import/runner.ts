import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from '../../lib/haptics';
import { tryRequestCutout } from '../../lib/cutout';
import { track } from '../../lib/analytics';
import { batchDirectory, cropRegion, deleteBatchFiles, deleteFile, pruneBatchFiles, readBase64, writeBase64 } from './files';
import { classifyError } from './retryPolicy';
import { runSave } from './save';
import { applyExtraction, extractPiece, preparePhoto, scanPhoto } from './steps';
import { batchImport, useBatchImportStore } from './store';
import type { Bbox, Piece, PhotoJob } from './types';

/**
 * Lanes and their widths. Preparing decodes a full-resolution original, so it
 * runs one at a time to bound memory. Scans stay at 3. Detected garments
 * wait for review; the extraction lane consumes explicitly approved inputs.
 */
const LANES = { prepare: 1, scan: 3, extract: 3 } as const;
type Lane = keyof typeof LANES;

const inFlight: Record<Lane, number> = { prepare: 0, scan: 0, extract: 0 };
let saving = false;
let offline = false;
let appState: AppStateStatus = AppState.currentState;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;

function isCurrent(batchId: string): boolean {
  return batchImport.batch()?.id === batchId;
}

function scheduleWake(at: number) {
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    kick();
  }, Math.max(0, at - Date.now()));
}

/**
 * A failed attempt made while the app was backgrounded (iOS suspends the JS
 * thread and in-flight requests drop) is not the request's fault, so it does
 * not use up one of the automatic attempts.
 */
function attemptsAfterFailure(attempts: number, countsAttempt: boolean): number {
  return countsAttempt && appState !== 'background' ? attempts : attempts - 1;
}

async function runPrepare(batchId: string, photo: PhotoJob) {
  try {
    const patch = await preparePhoto(batchId, photo);
    if (isCurrent(batchId)) batchImport.get().patchPhoto(photo.id, patch);
  } catch (error) {
    if (!isCurrent(batchId)) return;
    const decision = classifyError(error, photo.attempts + 1);
    batchImport.get().patchPhoto(photo.id, decision.kind === 'retry'
      ? { status: 'pending', attempts: attemptsAfterFailure(photo.attempts + 1, decision.countsAttempt), notBefore: Date.now() + decision.delayMs }
      : { status: 'failed', error: "This photo couldn't be opened." });
  }
}

async function runScan(batchId: string, photo: PhotoJob) {
  try {
    const pieces = await scanPhoto(batchId, photo);
    if (!isCurrent(batchId)) return;
    batchImport.get().completeScan(photo.id, pieces);
    track('closet_batch_photo_scanned', { item_count: pieces.length });
  } catch (error) {
    if (!isCurrent(batchId)) return;
    const store = batchImport.get();
    const attempts = photo.attempts + 1;
    const decision = classifyError(error, attempts);
    if (decision.kind === 'retry') {
      store.patchPhoto(photo.id, {
        status: 'ready',
        attempts: attemptsAfterFailure(attempts, decision.countsAttempt),
        notBefore: Date.now() + decision.delayMs,
      });
    } else if (decision.kind === 'block') {
      // Stop spending: every photo still waiting would be refused the same way.
      store.patchPhoto(photo.id, { status: 'blocked', error: decision.message });
      store.block(decision.reason);
    } else {
      store.patchPhoto(photo.id, { status: 'failed', error: decision.message });
    }
  }
}

async function runExtract(batchId: string, piece: Piece) {
  const batch = batchImport.batch();
  const photo = batch?.photos.find((p) => p.id === piece.photoId);
  if (!batch || !photo) return;
  try {
    const siblings = batch.pieces.filter((p) => p.photoId === piece.photoId);
    const input = piece.extractionInput;
    const result = await extractPiece(input?.piece ?? piece, input?.photo ?? photo, input?.siblings ?? siblings);
    if (!isCurrent(batchId)) return;
    // Re-read: the user may have edited the piece while the request ran.
    const latest = batchImport.batch()?.pieces.find((p) => p.id === piece.id);
    if (latest) batchImport.get().patchPiece(piece.id, applyExtraction(latest, result));
  } catch (error) {
    if (!isCurrent(batchId)) return;
    const attempts = piece.attempts + 1;
    const decision = classifyError(error, attempts);
    batchImport.get().patchPiece(piece.id, decision.kind === 'retry'
      ? { status: 'pending', attempts: attemptsAfterFailure(attempts, decision.countsAttempt), notBefore: Date.now() + decision.delayMs }
      : { status: 'failed', failedStep: 'extract', error: decision.message });
  }
}

function start(lane: Lane, work: () => Promise<void>) {
  inFlight[lane] += 1;
  void work().finally(() => {
    inFlight[lane] -= 1;
    kick();
  });
}

let kicking = false;
let kickAgain = false;

/**
 * Start whatever can run now. Idempotent and cheap: every state change calls
 * it. Jobs are marked in-flight in the store before their request starts.
 *
 * Those store writes notify subscribers synchronously, which calls kick()
 * again mid-loop. A nested pass would work from a fresher snapshot than the
 * outer loop and could start a job the outer loop is about to start too, so
 * nested calls only request another pass once the current one finishes.
 */
export function kick(): void {
  if (kicking) {
    kickAgain = true;
    return;
  }
  kicking = true;
  try {
    do {
      kickAgain = false;
      kickOnce();
    } while (kickAgain);
  } finally {
    kicking = false;
  }
}

function kickOnce(): void {
  const store = batchImport.get();
  const batch = store.batch;
  // Only 'background' pauses. At launch AppState can still read 'unknown',
  // and 'inactive' (a pulled-down Control Center) doesn't stop requests.
  if (!batch || offline || appState === 'background') return;

  if (batch.phase === 'saving') {
    if (!saving) {
      saving = true;
      void runSave(batch.id).finally(() => {
        saving = false;
      });
    }
    return;
  }

  const now = Date.now();
  let nextWake = Infinity;
  const due = (job: { notBefore: number }) => {
    if (job.notBefore <= now) return true;
    nextWake = Math.min(nextWake, job.notBefore);
    return false;
  };

  for (const photo of batch.photos) {
    if (photo.status === 'pending' && inFlight.prepare < LANES.prepare && due(photo)) {
      store.patchPhoto(photo.id, { status: 'preparing' });
      start('prepare', () => runPrepare(batch.id, photo));
    } else if (photo.status === 'ready' && !batch.blocked && inFlight.scan < LANES.scan && due(photo)) {
      store.patchPhoto(photo.id, { status: 'scanning' });
      start('scan', () => runScan(batch.id, photo));
    }
  }
  for (const piece of batch.pieces) {
    if (piece.status === 'pending' && piece.extractionApproved && piece.included !== false && inFlight.extract < LANES.extract && due(piece)) {
      store.patchPiece(piece.id, { status: 'extracting' });
      start('extract', () => runExtract(batch.id, piece));
    }
  }
  if (nextWake !== Infinity) scheduleWake(nextWake);
}

/**
 * Wire the runner to the app: resume on launch (the store has already reset
 * anything that was mid-request), pause while offline or backgrounded, and
 * pick up again on reconnect / foreground. Returns an unsubscribe.
 */
export function startBatchRunner(): () => void {
  pruneBatchFiles(batchImport.batch()?.id ?? null);

  const unsubscribeNet = NetInfo.addEventListener((state) => {
    const wasOffline = offline;
    offline = state.isConnected === false;
    if (wasOffline && !offline) kick();
  });
  const appSub = AppState.addEventListener('change', (next) => {
    appState = next;
    if (next !== 'background') kick();
  });
  // Any change to the batch (a job finishing, a Retry, a Save) may free a
  // lane or make new work runnable.
  let lastPhase = batchImport.batch()?.phase;
  const unsubscribeStore = useBatchImportStore.subscribe((state, prev) => {
    if (state.batch === prev.batch) return;
    const phase = state.batch?.phase;
    if (phase === 'review' && lastPhase === 'processing' && state.batch?.pieces.length) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    lastPhase = phase;
    kick();
  });

  kick();
  return () => {
    unsubscribeNet();
    appSub.remove();
    unsubscribeStore();
    if (wakeTimer) clearTimeout(wakeTimer);
  };
}

/** End the batch and reclaim its files. In-flight results are discarded on arrival. */
export function discardBatch(): void {
  const batch = batchImport.batch();
  batchImport.get().discard();
  if (batch) deleteBatchFiles(batch.id);
}

/**
 * The review's crop editor: re-cut the preview from the master straight away,
 * then fetch a new cutout in the background (the old one was masked to the
 * previous box, so it is dropped rather than shown against the new crop).
 */
export async function applyPieceCrop(pieceId: string, bbox: Bbox): Promise<void> {
  const batch = batchImport.batch();
  const piece = batch?.pieces.find((p) => p.id === pieceId);
  const photo = batch?.photos.find((p) => p.id === piece?.photoId);
  if (!batch || !piece || !photo?.masterUri || !photo.masterWidth || !photo.masterHeight) return;
  const dir = batchDirectory(batch.id);
  const previewUri = await cropRegion(
    photo.masterUri,
    { width: photo.masterWidth, height: photo.masterHeight },
    bbox,
    { maxDim: 800, compress: 0.82 },
    // A fresh name so image caches keyed on the URI show the new crop.
    { dir, name: `${piece.id}-preview-${Date.now()}.jpg` },
  );
  if (!previewUri || !isCurrent(batch.id)) return;
  deleteFile(piece.previewUri);
  deleteFile(piece.cutoutUri);
  batchImport.get().patchPiece(pieceId, {
    extractionInput: undefined,
    bbox,
    previewUri,
    cutoutUri: null,
    cutoutUrl: null,
    imageUrl: null,
    useCutout: false,
  });

  if (!photo.scanUri) return;
  const imageDataUrl = `data:image/jpeg;base64,${await readBase64(photo.scanUri)}`;
  const cutout = await tryRequestCutout({ imageDataUrl, bbox, category: piece.category });
  if (!cutout || !isCurrent(batch.id)) return;
  const current = batchImport.batch()?.pieces.find((p) => p.id === pieceId);
  if (!current || current.bbox !== bbox) return;
  const cutoutUri = await writeBase64(dir, `${pieceId}-cutout-${Date.now()}.webp`, cutout.slice(cutout.indexOf(',') + 1));
  batchImport.get().patchPiece(pieceId, { cutoutUri });
}
