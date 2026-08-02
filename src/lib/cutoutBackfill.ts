import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { generateCutoutForItem, isCutoutBusyError, observedCutoutPipeline } from './cutout';
import type { Item } from '../types/item';

const CURSOR_KEY = 'cutout_backfill_cursor';

/**
 * Gap between requests on the legacy pipeline. One in flight, ~1.6/s —
 * deliberately unhurried, because segmentation there is serialised behind an
 * inference gate and queueing against it only makes the queue longer.
 */
const PACE_MS = 600;

/**
 * The hosted pipeline has no inference gate, so the shape of the work changes:
 * cutouts are ~10s each and the bottleneck is the round trip, not a server-side
 * lock. Measured on a real closet, the 600ms pause is about 6% of cycle time —
 * dropping it alone is a rounding error, and overlapping requests is the only
 * thing that moves the number.
 *
 * 3 is chosen from measurement, not optimism. Throughput scales sublinearly
 * (4 concurrent gave 1.74x, not 4x, and per-item latency roughly doubled), so
 * something upstream saturates; past ~3 you are buying latency, not speed.
 * The server's own /api/cutout limit is 60/min, which at ~10s a cutout stays
 * far out of reach at this concurrency.
 */
const SAM3_CONCURRENCY = 3;

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
 * Give the whole library cutouts.
 *
 * How hard this pushes depends on which pipeline is answering, which the run
 * discovers rather than assumes. It always starts single-flight and paced,
 * because that is the only safe assumption against a `legacy` server whose
 * segmentation is serialised behind an inference gate. Once a response
 * identifies the pipeline it adapts: `legacy` stays exactly as before, `sam3`
 * drops the pause and opens up to SAM3_CONCURRENCY requests in flight.
 *
 * Both paths keep exponential backoff when the server reports it is busy and a
 * hard stop after a run of failures — `sam3` returns no 503, but the endpoint's
 * abuse rate limit still returns 429 and is handled identically.
 *
 * The run pauses while the app is backgrounded and resumes on return, and
 * persists a cursor so a killed app picks up roughly where it left off. With
 * several requests in flight the cursor advances over the completed *contiguous
 * prefix* only, so a resume never skips an item that was still in progress when
 * the app died.
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

    // Shared across workers on purpose: a busy server is a property of the
    // server, so every worker should back off together rather than each
    // discovering saturation on its own.
    let backoff = BACKOFF_START_MS;
    let consecutiveFailures = 0;

    // Claimed by index so workers never process the same item twice.
    let nextIndex = 0;
    const finished: boolean[] = new Array(queue.length).fill(false);
    let commitIdx = 0;

    // Only ever persist a cursor covering an unbroken run of finished items.
    // Writing the highest finished id instead would silently skip anything
    // still in flight below it if the app died here.
    const commitPrefix = async () => {
      let advanced = false;
      while (commitIdx < queue.length && finished[commitIdx]) {
        commitIdx += 1;
        advanced = true;
      }
      if (advanced) await writeCursor(queue[commitIdx - 1].id);
    };

    let paceMs = PACE_MS;
    let ramped = false;
    const workers: Promise<void>[] = [];

    // Widen once a response has told us which pipeline is answering. Workers
    // pull from the shared index, so a late arrival just joins the run.
    const maybeRamp = () => {
      if (ramped) return;
      const pipeline = observedCutoutPipeline();
      if (pipeline === 'unknown') return;
      ramped = true;
      if (pipeline !== 'sam3') return;
      paceMs = 0;
      for (let i = workers.length; i < SAM3_CONCURRENCY; i++) workers.push(worker());
    };

    async function worker(): Promise<void> {
      while (!cancelled && progress.stoppedReason === null) {
        const idx = nextIndex;
        if (idx >= queue.length) return;
        nextIndex += 1;
        const item = queue[idx];

        // Don't hold the connection open behind a lock screen — wait for the
        // user to come back rather than burning requests they can't see.
        //
        // Gated on 'background' specifically, not on "not active": iOS reports a
        // transient 'inactive' during ordinary interruptions, and a cold start can
        // report 'unknown', neither of which should stall the run indefinitely.
        while (AppState.currentState === 'background' && !cancelled) {
          await sleep(1000);
        }
        if (cancelled) return;

        // Retry loop for this one item. A busy server means "come back later",
        // so the same item is re-attempted after a backoff rather than skipped.
        let settled = false;
        while (!settled && !cancelled && progress.stoppedReason === null) {
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
                return;
              }
              await sleep(backoff);
              backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
              continue; // same item, after backing off
            }
            // Anything else is this item's problem, not the server's: move on.
            settled = true;
          }
        }
        if (cancelled || progress.stoppedReason !== null) return;

        consecutiveFailures = 0;
        backoff = BACKOFF_START_MS;
        finished[idx] = true;
        progress.completed += 1;
        await commitPrefix();
        onProgress?.({ ...progress });

        maybeRamp();
        if (paceMs > 0) await sleep(paceMs);
      }
    }

    workers.push(worker());
    // Indexed rather than Promise.all: maybeRamp appends workers while this is
    // running, and the loop re-reads length so late arrivals are awaited too.
    for (let i = 0; i < workers.length; i++) await workers[i];

    if (cancelled && progress.stoppedReason === null) {
      progress.stoppedReason = 'cancelled';
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
