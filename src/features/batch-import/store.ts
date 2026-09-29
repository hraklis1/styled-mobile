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
 * `processing` until nothing is left to run automatically, then `review`.
 * `saving` is sticky: only the save step moves out of it.
 */
export function derivePhase(batch: Pick<Batch, 'phase' | 'photos' | 'pieces'>): BatchPhase {
  if (batch.phase === 'saving') return 'saving';
  const running = batch.photos.some((p) => !PHOTO_TERMINAL.has(p.status))
    || batch.pieces.some((p) => PIECE_ACTIVE.has(p.status));
  return running ? 'processing' : 'review';
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
  /** Record a photo's scan result: its pieces join the extraction queue. */
  completeScan: (photoId: string, pieces: Piece[]) => void;
  patchPiece: (id: string, patch: Partial<Piece>) => void;
  /** A change made by the user in review; remembered so extraction won't clobber it. */
  editPiece: (id: string, patch: Partial<PieceFields> & Partial<Pick<Piece, 'useCutout'>>) => void;
  removePiece: (id: string) => void;
  block: (reason: BlockReason) => void;
  unblock: () => void;
  /** Put failed photos/pieces back in the queue for another round of attempts. */
  retryFailed: () => void;
  beginSave: () => void;
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
    (set) => ({
      batch: null,
      workspaceOpen: false,
      start: (batch) => set({ batch: withPhase(batch), workspaceOpen: false }),
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
        pieces: [...b.pieces.filter((p) => p.photoId !== photoId), ...pieces],
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
          return { ...p, ...patch, edited: [...new Set([...p.edited, ...keys])] };
        }),
      }))),
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
          p.status === 'failed'
            ? { ...p, status: p.failedStep === 'extract' ? 'pending' : 'ready', failedStep: null, attempts: 0, notBefore: 0, error: null }
            : p),
      }))),
      beginSave: () => set((s) => update(s, (b) => ({
        ...b,
        phase: 'saving',
        saveError: null,
        // A piece whose extraction failed is still saved, with the name,
        // category and colour the scan found and needsDetails set.
        pieces: b.pieces.map((p) => (p.status === 'failed'
          ? { ...p, status: 'ready', failedStep: null, attempts: 0, notBefore: 0, error: null }
          : p)),
      }))),
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
            pieces,
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
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (key) => mmkv.getString(key) ?? null,
        setItem: (key, value) => mmkv.set(key, value),
        removeItem: (key) => mmkv.remove(key),
      })),
      partialize: (s) => ({ batch: s.batch }),
      migrate: (persisted, version) =>
        (version === 1 ? persisted : { batch: null }) as { batch: Batch | null },
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
