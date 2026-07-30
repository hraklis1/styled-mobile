import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { generateCutoutForItem, isCutoutBusyError } from './cutout';
import type { Item } from '../types/item';

const CURSOR_KEY = 'cutout_backfill_cursor';

/** Gap between requests. One in flight, ~1.6/s — deliberately unhurried. */
const PACE_MS = 600;

/** Backoff when the server says it's saturated. */
const BACKOFF_START_MS = 600;
const BACKOFF_MAX_MS = 30_000;

/** Give up rather than grind if the server keeps refusing. */
const MAX_CONSECUTIVE_FAILURES = 5;

export type BackfillProgress = {
  completed: number;
  total: number;
  succeeded: number;
  /** Set when the run stopped early; null while running or on clean completion. */
  stoppedReason: 'cancelled' | 'too_many_failures' | null;
};

export type BackfillHandle = {
  /** Resolves when the run finishes, is cancelled, or gives up. */
  done: Promise<BackfillProgress>;
  cancel: () => void;
};

/** Items that have a photo but no cutout yet, oldest first for a stable cursor. */
export function itemsNeedingCutout(items: Item[]): Item[] {
  return items
    .filter((i) => !!i.imageUrl && !i.cutoutUrl && !i.isArchived)
    .sort((a, b) => a.id - b.id);
}

async function readCursor(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(CURSOR_KEY);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function writeCursor(itemId: number): Promise<void> {
  try {
    await AsyncStorage.setItem(CURSOR_KEY, String(itemId));
  } catch {
    // A lost cursor costs a re-scan of already-done items, which are skipped
    // anyway because they now have a cutout. Not worth surfacing.
  }
}

export async function resetBackfillCursor(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CURSOR_KEY);
  } catch {
    /* ignore */
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Give the whole library cutouts, one item at a time.
 *
 * Segmentation runs strictly serially on the server, so this trickles rather
 * than parallelises: one request in flight, a pause between each, exponential
 * backoff whenever the server reports it is busy, and a hard stop after a run
 * of failures. Running a closet through `mapWithConcurrency` would just queue
 * work against a box that can only ever process one image at a time.
 *
 * The run pauses while the app is backgrounded and resumes on return, and
 * persists a cursor so a killed app picks up roughly where it left off.
 */
export function runCutoutBackfill({
  items,
  userId,
  onProgress,
  onItemCutout,
}: {
  items: Item[];
  userId: string | number;
  onProgress?: (p: BackfillProgress) => void;
  /** Called per successful cutout so the caller can persist it as it lands. */
  onItemCutout?: (itemId: number, cutoutUrl: string) => void;
}): BackfillHandle {
  let cancelled = false;

  const done = (async (): Promise<BackfillProgress> => {
    const pending = itemsNeedingCutout(items);

    // Resume from the cursor when the list still contains it; otherwise start
    // from the top (the library changed, or this is a fresh run).
    const cursor = await readCursor();
    const resumeAt = cursor ? pending.findIndex((i) => i.id > cursor) : 0;
    const queue = resumeAt > 0 ? pending.slice(resumeAt) : pending;

    const progress: BackfillProgress = {
      completed: 0,
      total: queue.length,
      succeeded: 0,
      stoppedReason: null,
    };
    onProgress?.({ ...progress });

    let backoff = BACKOFF_START_MS;
    let consecutiveFailures = 0;

    for (const item of queue) {
      if (cancelled) {
        progress.stoppedReason = 'cancelled';
        break;
      }

      // Don't hold the connection open behind a lock screen — wait for the
      // user to come back rather than burning requests they can't see.
      //
      // Gated on 'background' specifically, not on "not active": iOS reports a
      // transient 'inactive' during ordinary interruptions, and a cold start can
      // report 'unknown', neither of which should stall the run indefinitely.
      while (AppState.currentState === 'background' && !cancelled) {
        await sleep(1000);
      }
      if (cancelled) {
        progress.stoppedReason = 'cancelled';
        break;
      }

      // Retry loop for this one item. A busy server means "come back later",
      // so the same item is re-attempted after a backoff rather than skipped —
      // `continue` here would advance the for-of and silently drop it.
      let settled = false;
      while (!settled && !cancelled) {
        try {
          const cutoutUrl = await generateCutoutForItem({ item, userId });
          if (cutoutUrl) {
            progress.succeeded += 1;
            onItemCutout?.(item.id, cutoutUrl);
          }
          // A null result means the quality gate rejected this photo. That is a
          // property of the image, not a transient error — treat it as done so
          // the next run doesn't keep retrying what will never succeed.
          settled = true;
        } catch (err) {
          if (isCutoutBusyError(err)) {
            consecutiveFailures += 1;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              progress.stoppedReason = 'too_many_failures';
              break;
            }
            await sleep(backoff);
            backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
            continue; // same item, after backing off
          }
          // Anything else is this item's problem, not the server's: move on.
          settled = true;
        }
      }

      if (progress.stoppedReason === 'too_many_failures') break;
      if (cancelled) {
        progress.stoppedReason = 'cancelled';
        break;
      }

      consecutiveFailures = 0;
      backoff = BACKOFF_START_MS;
      progress.completed += 1;
      await writeCursor(item.id);
      onProgress?.({ ...progress });
      await sleep(PACE_MS);
    }

    if (progress.stoppedReason === null && !cancelled) {
      await resetBackfillCursor();
    }
    onProgress?.({ ...progress });
    return progress;
  })();

  return {
    done,
    cancel: () => {
      cancelled = true;
    },
  };
}
