import type { Batch } from './types';

export type BatchSummary = {
  tone: 'working' | 'ready' | 'attention' | 'done';
  title: string;
  detail: string | null;
  /** 0–1, or null for an indeterminate step. */
  progress: number | null;
  /** What tapping the tray does. */
  action: 'open' | 'dismiss';
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Photo counts that drive the progress copy. */
export function photoCounts(batch: Batch) {
  const total = batch.photos.length;
  const scanned = batch.photos.filter((p) => p.status === 'done').length;
  const failed = batch.photos.filter((p) => p.status === 'failed').length;
  const blocked = batch.photos.filter((p) => p.status === 'blocked').length;
  const prepared = batch.photos.filter((p) => p.masterUri).length;
  return { total, scanned, failed, blocked, prepared, settled: scanned + failed + blocked };
}

export function pieceCounts(batch: Batch) {
  const total = batch.pieces.length;
  const ready = batch.pieces.filter((p) => p.status === 'ready').length;
  const failed = batch.pieces.filter((p) => p.status === 'failed').length;
  return { total, ready, failed, settled: ready + failed };
}

/** Everything the tray says, derived from the batch alone. */
export function summarizeBatch(batch: Batch): BatchSummary {
  const photos = photoCounts(batch);
  const pieces = pieceCounts(batch);

  if (batch.phase === 'saving') {
    return {
      tone: 'working',
      title: `Adding ${plural(pieces.total, 'piece')}…`,
      detail: null,
      progress: null,
      action: 'open',
    };
  }

  if (batch.phase === 'processing') {
    if (photos.settled < photos.total) {
      if (photos.prepared === 0) {
        return { tone: 'working', title: 'Preparing photos…', detail: null, progress: null, action: 'open' };
      }
      return {
        tone: 'working',
        title: `Scanning ${Math.min(photos.settled + 1, photos.total)} of ${plural(photos.total, 'photo')}`,
        detail: pieces.total ? `${plural(pieces.total, 'piece')} found so far` : null,
        // Scanning owns the first half of the bar, detail extraction the second.
        progress: (photos.settled / photos.total) * 0.5 + (pieces.total ? (pieces.settled / pieces.total) * 0.5 * (photos.settled / photos.total) : 0),
        action: 'open',
      };
    }
    return {
      tone: 'working',
      title: `Reading details ${Math.min(pieces.settled + 1, pieces.total)} of ${pieces.total}`,
      detail: null,
      progress: 0.5 + (pieces.total ? (pieces.settled / pieces.total) * 0.5 : 0),
      action: 'open',
    };
  }

  // review
  if (pieces.total === 0) {
    if (batch.savedCount > 0) {
      return {
        tone: 'done',
        title: `Added ${plural(batch.savedCount, 'piece')} to your closet`,
        detail: null,
        progress: null,
        action: 'dismiss',
      };
    }
    if (batch.blocked) {
      return {
        tone: 'attention',
        title: batch.blocked === 'free_limit' ? 'Your free closet is full' : 'Out of Studio credits',
        detail: `${plural(photos.blocked, 'photo')} not scanned`,
        progress: null,
        action: 'open',
      };
    }
    return {
      tone: 'attention',
      title: photos.failed ? "Couldn't scan your photos" : 'No clothing found',
      detail: photos.failed ? 'Tap to retry' : 'Try photos where the clothes are clearly visible',
      progress: null,
      action: photos.failed ? 'open' : 'dismiss',
    };
  }

  const problems = pieces.failed + photos.failed + photos.blocked;
  return {
    tone: problems || batch.saveError ? 'attention' : 'ready',
    title: `${plural(pieces.total, 'piece')} ready to review`,
    detail: batch.saveError
      ?? (batch.blocked ? `Out of credits · ${plural(photos.blocked, 'photo')} waiting` : null)
      ?? (problems ? `${problems} need${problems === 1 ? 's' : ''} attention` : null)
      ?? (batch.savedCount ? `${batch.savedCount} already added` : null),
    progress: null,
    action: 'open',
  };
}
