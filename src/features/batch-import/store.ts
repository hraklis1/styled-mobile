import { applyInclusionChanges, type InclusionChange } from '../../lib/extraction-review';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import { relocateLocalUris } from '../../lib/relocateLocalUri';
import type { Batch, BatchPhase, BlockReason, Piece, PieceFields, PhotoJob } from './types';

const mmkv = createMMKV({ id: 'styled.batch-import' });

/** A batch nobody has touched for this long is abandoned; its files are reclaimed. */
export const BATCH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const PHOTO_TERMINAL = new Set<PhotoJob['status']>(['done', 'failed', 'blocked']);
const PIECE_ACTIVE = new Set<Piece['status']>(['pending', 'extracting']);

/**
 * Processing covers detection and explicitly approved extraction jobs.
 * `saving` is sticky: only the save step moves out of it.
 */
export function derivePhase(batch: Pick<Batch, 'phase' | 'photos' | 'pieces'>): BatchPhase {
  if (batch.phase === 'saving') return 'saving';
  const detecting = batch.photos.some(p => !PHOTO_TERMINAL.has(p.status));
  const extracting = batch.pieces.some(p => p.included !== false && p.extractionApproved && PIECE_ACTIVE.has(p.status));
  if (detecting || extracting) return 'processing';
  if (batch.pieces.some(p => p.status === 'pending' && p.included !== false)
    || (batch.pieces.length > 0 && batch.pieces.every(p => p.status === 'pending'))) return 'pre-extract';
  return 'review';
}

function withPhase(batch: Batch): Batch {
  const phase = derivePhase(batch);
  return phase === batch.phase ? batch : { ...batch, phase };
}

/**
 * A process that died mid-request left jobs marked in-flight. Put them back
 * in the queue; they rerun with the same idempotency key, so a scan the
 * server already charged for is replayed rather than charged again.
 */
export function resetInFlight(batch: Batch): Batch {
  return {
    ...batch,
    photos: batch.photos.map((p) =>
      p.status === 'preparing' ? { ...p, status: 'pending', notBefore: 0 }
      : p.status === 'scanning' ? { ...p, status: 'ready', notBefore: 0 }
      : p),
    pieces: batch.pieces.map((p) =>
      p.status === 'extracting' ? { ...p, status: 'pending', notBefore: 0 }
      : p.status === 'saving' ? { ...p, status: 'ready', notBefore: 0 }
      : p),
  };
}

type BatchImportState = {
  batch: Batch | null;
  /** Whether the full-screen progress/review workspace is showing. */
  workspaceOpen: boolean;
  start: (batch: Batch) => void;
  discard: () => void;
  openWorkspace: () => void;
  closeWorkspace: () => void;
  patchPhoto: (id: string, patch: Partial<PhotoJob>) => void;
  /** Record detections without authorizing their extraction. */
  completeScan: (photoId: string, pieces: Piece[]) => void;
  patchPiece: (id: string, patch: Partial<Piece>) => void;
  /** A change made by the user in review; remembered so extraction won't clobber it. */
  editPiece: (id: string, patch: Partial<PieceFields> & Partial<Pick<Piece, 'useCutout'>>) => void;
  removePiece: (id: string) => void;
  setInclusion: (changes: InclusionChange[]) => void;
  beginExtraction: (ids: readonly string[]) => boolean;
  keepBasicDetails: (ids: readonly string[]) => void;
  block: (reason: BlockReason) => void;
  unblock: () => void;
  /** Put failed photos/pieces back in the queue for another round of attempts. */
  retryFailed: () => void;
  beginSave: (ids?: readonly string[], polishIds?: readonly string[]) => void;
  /** Saved pieces leave the batch; the batch ends once nothing is left. */
  finishSave: (savedIds: string[], failures: { id: string; message: string }[]) => void;
  failSave: (message: string) => void;
};

function update(
  state: BatchImportState,
  fn: (batch: Batch) => Batch,
): Partial<BatchImportState> {
  if (!state.batch) return {};
  return { batch: withPhase(fn(state.batch)) };
}

export const useBatchImportStore = create<BatchImportState>()(
  persist(
    (set, get) => ({
      batch: null,
      workspaceOpen: false,
      start: (batch) => set({ batch: withPhase(batch), workspaceOpen: true }),
      discard: () => set({ batch: null, workspaceOpen: false }),
      openWorkspace: () => set({ workspaceOpen: true }),
      closeWorkspace: () => set({ workspaceOpen: false }),
      patchPhoto: (id, patch) => set((s) => update(s, (b) => ({
        ...b,
        photos: b.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }))),
      completeScan: (photoId, pieces) => set((s) => update(s, (b) => ({
        ...b,
        photos: b.photos.map((p) =>
          p.id === photoId ? { ...p, status: 'done', error: null, pieceCount: pieces.length } : p),
        // A resumed scan can replay: never add the same photo's pieces twice.
        pieces: b.photos.flatMap(photo => photo.id === photoId
          ? pieces.map(piece => b.pieces.find(old => old.id === piece.id) ?? { ...piece, included: true, extractionApproved: false })
          : b.pieces.filter(piece => piece.photoId === photo.id)),
      }))),
      patchPiece: (id, patch) => set((s) => update(s, (b) => ({
        ...b,
        pieces: b.pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }))),
      editPiece: (id, patch) => set((s) => update(s, (b) => ({
        ...b,
        pieces: b.pieces.map((p) => {
          if (p.id !== id) return p;
          const keys = Object.keys(patch).filter((k) => k !== 'useCutout') as (keyof PieceFields)[];
          return { ...p, ...patch, extractionInput: undefined, edited: [...new Set([...p.edited, ...keys])] };
        }),
      }))),
      setInclusion: (changes) => set(s => update(s, b => b.phase === 'saving' || b.phase === 'processing' ? b : ({
        ...b, revision: (b.revision ?? 0) + 1, pieces: applyInclusionChanges(b.pieces, changes),
      }))),
      beginExtraction: (ids) => {
        const b = get().batch;
        if (!b || b.phase === 'saving' || b.phase === 'processing') return false;
        const targets = b.pieces.filter(p => ids.includes(p.id) && p.included !== false && (p.status === 'pending' || (p.status === 'failed' && p.failedStep === 'extract')));
        if (!targets.length) return false;
        const targetIds = new Set(targets.map(p => p.id));
        set(s => update(s, current => ({ ...current, submission: { sessionId: current.id, revision: current.revision ?? 0, pieceIds: [...targetIds] }, pieces: current.pieces.map(p => {
          if (!targetIds.has(p.id)) return p;
          const { extractionInput: _old, ...input } = p;
          return { ...p, status: 'pending', extractionApproved: true, failedStep: null, error: null, attempts: 0, notBefore: 0,
            extractionInput: { piece: input, photo: current.photos.find(photo => photo.id === p.photoId)!,
              siblings: current.pieces.filter(sibling => sibling.photoId === p.photoId).map(({ extractionInput: _snapshot, ...sibling }) => sibling) } };
        }) })));
        return true;
      },
      keepBasicDetails: (ids) => set(s => update(s, b => b.phase === 'processing' || b.phase === 'saving' ? b : ({ ...b, pieces: b.pieces.map(p =>
        ids.includes(p.id) && p.status === 'failed' && p.failedStep === 'extract'
          ? { ...p, basicDetails: true, status: 'ready', failedStep: null, error: null } : p) }))),
      removePiece: (id) => set((s) => update(s, (b) => ({
        ...b,
        pieces: b.pieces.filter((p) => p.id !== id),
      }))),
      block: (reason) => set((s) => update(s, (b) => ({
        ...b,
        blocked: reason,
        // Everything still waiting to scan would be refused the same way.
        photos: b.photos.map((p) =>
          p.status === 'pending' || p.status === 'ready' ? { ...p, status: 'blocked' } : p),
      }))),
      unblock: () => set((s) => update(s, (b) => ({
        ...b,
        blocked: null,
        photos: b.photos.map((p) =>
          p.status === 'blocked'
            ? { ...p, status: p.masterUri && p.scanUri ? 'ready' : 'pending', notBefore: 0 }
            : p),
      }))),
      retryFailed: () => set((s) => update(s, (b) => ({
        ...b,
        saveError: null,
        photos: b.photos.map((p) =>
          p.status === 'failed'
            ? { ...p, status: p.masterUri && p.scanUri ? 'ready' : 'pending', attempts: 0, notBefore: 0, error: null }
            : p),
        pieces: b.pieces.map((p) =>
          p.status === 'failed' && p.included !== false && (p.failedStep !== 'extract' || p.extractionApproved)
            ? { ...p, status: p.failedStep === 'extract' ? 'pending' : 'ready', failedStep: null, attempts: 0, notBefore: 0, error: null }
            : p),
      }))),
      beginSave: (ids, polishIds) => {
        const b = get().batch;
        if (!b || b.phase !== 'review') return;
        const selected = b.pieces.filter(p => p.included !== false && (!ids || ids.includes(p.id)));
        if (!selected.length || selected.some(p => p.status !== 'ready' && !(p.status === 'failed' && p.failedStep === 'save'))) return;
        set(s => update(s, current => ({ ...current, phase: 'saving', saveError: null,
          // A retry (no list given) keeps the choice made at the first save.
          polishIds: polishIds ? [...polishIds] : current.polishIds,
          saveIds: selected.map(p => p.id), pieces: current.pieces.map(p => selected.some(t => t.id === p.id)
            ? { ...p, status: 'ready', failedStep: null, error: null } : p) })));
      },
      finishSave: (savedIds, failures) => set((s) => {
        if (!s.batch) return {};
        const saved = new Set(savedIds);
        const failed = new Map(failures.map((f) => [f.id, f.message]));
        const pieces = s.batch.pieces
          .filter((p) => !saved.has(p.id))
          .map((p) => (failed.has(p.id)
            ? { ...p, status: 'failed' as const, failedStep: 'save' as const, error: failed.get(p.id) ?? null }
            : p));
        return {
          batch: {
            ...s.batch,
            pieces: failures.length ? pieces : [],
            saveIds: failures.map(f => f.id),
            phase: 'review',
            savedCount: s.batch.savedCount + saved.size,
            saveError: failures.length
              ? failures.length === 1
                ? "1 piece couldn't be added."
                : `${failures.length} pieces couldn't be added.`
              : null,
          },
        };
      }),
      failSave: (message) => set((s) => (s.batch
        ? { batch: { ...s.batch, phase: 'review', saveError: message } }
        : {})),
    }),
    {
      name: 'batch-import-v1',
      version: 2,
      storage: createJSONStorage(() => ({
        getItem: (key) => mmkv.getString(key) ?? null,
        setItem: (key, value) => mmkv.set(key, value),
        removeItem: (key) => mmkv.remove(key),
      })),
      partialize: (s) => ({ batch: s.batch }),
      migrate: (persisted, version) =>
        (version === 1 || version === 2 ? migrateReviewBatch(persisted) : { batch: null }) as { batch: Batch | null },
      merge: (persisted, current) => {
        const stored = (persisted as { batch?: Batch | null } | undefined)?.batch ?? null;
        const fresh = stored && Date.now() - stored.createdAt < BATCH_MAX_AGE_MS ? stored : null;
        return {
          ...current,
          batch: fresh ? withPhase(resetInFlight(relocateLocalUris(fresh))) : null,
        };
      },
    },
  ),
);

/** Non-hook accessor for the runner. */
export const batchImport = {
  get: () => useBatchImportStore.getState(),
  batch: () => useBatchImportStore.getState().batch,
};

/** Existing results survive; old unapproved pending jobs require review. */
export function migrateReviewBatch(value: unknown): { batch: Batch | null } {
  const batch = (value as { batch?: Batch } | null)?.batch;
  if (!batch) return { batch: null };
  return { batch: { ...batch,
    saveIds: batch.phase === 'saving' ? batch.saveIds ?? batch.pieces.filter(p => p.included !== false).map(p => p.id) : batch.saveIds,
    pieces: batch.pieces.map(p => ({ ...p, included: p.included !== false,
      extractionApproved: p.extractionApproved ?? false })) } };
}
