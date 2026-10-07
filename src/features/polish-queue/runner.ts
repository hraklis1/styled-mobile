import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { applyPolishedItem, requestPolish } from '../../hooks/useItems';
import { queryClient } from '../../lib/queryClient';
import { PROFILE_QUERY_KEY } from '../../hooks/useProfile';
import { track } from '../../lib/analytics';
import { classifyError } from '../batch-import/retryPolicy';
import { polishQueue, usePolishQueueStore, type PolishJob } from './store';

/**
 * Generations are slow and the server allows 10 a minute; two at a time keeps
 * a batch moving without tripping the rate limit.
 */
const CONCURRENCY = 2;

let inFlight = 0;
let offline = false;
let appState: AppStateStatus = AppState.currentState;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleWake(at: number) {
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    kickPolish();
  }, Math.max(0, at - Date.now()));
}

async function runJob(job: PolishJob) {
  try {
    const { item } = await requestPolish(job.itemId, job.idempotencyKey);
    applyPolishedItem(queryClient, item);
    // The charge landed server-side; the balance shown in the app follows it.
    void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    polishQueue.get().patch(job.itemId, { status: 'done', error: null });
    track('item_polish_completed', { source: 'import' });
  } catch (error) {
    const attempts = job.attempts + 1;
    const decision = classifyError(error, attempts);
    const store = polishQueue.get();
    if (decision.kind === 'retry') {
      // A drop while backgrounded is iOS suspending us, not the request failing.
      const counted = decision.countsAttempt && appState !== 'background' ? attempts : attempts - 1;
      store.patch(job.itemId, { status: 'pending', attempts: counted, notBefore: Date.now() + decision.delayMs });
    } else if (decision.kind === 'block') {
      store.patch(job.itemId, { status: 'blocked', error: decision.message });
      store.block(decision.reason);
    } else {
      store.patch(job.itemId, { status: 'failed', error: decision.message });
    }
  }
}

let kicking = false;
let kickAgain = false;

/** Start whatever can run now. Cheap and re-entrant safe, like the batch runner's kick. */
export function kickPolish(): void {
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
  const { jobs, blocked } = polishQueue.get();
  if (blocked || offline || appState === 'background') return;
  const now = Date.now();
  let nextWake = Infinity;
  for (const job of jobs) {
    if (inFlight >= CONCURRENCY) break;
    if (job.status !== 'pending') continue;
    if (job.notBefore > now) {
      nextWake = Math.min(nextWake, job.notBefore);
      continue;
    }
    polishQueue.get().patch(job.itemId, { status: 'running' });
    inFlight += 1;
    void runJob(job).finally(() => {
      inFlight -= 1;
      kickPolish();
    });
  }
  if (nextWake !== Infinity) scheduleWake(nextWake);
}

/**
 * Queue polishes for items that just reached the closet. Keys derive from the
 * import's own id, so enqueuing the same save twice is harmless.
 */
export function enqueuePolish(userId: string, items: { id: number; clientImportId?: string | null }[]): void {
  if (!items.length) return;
  polishQueue.get().enqueue(userId, items.map((item) => ({
    itemId: item.id,
    idempotencyKey: `polish-import:${item.clientImportId ?? item.id}`,
  })));
  track('item_polish_queued', { item_count: items.length });
}

/** Resume on launch, pause offline/backgrounded, pick up again after. Returns an unsubscribe. */
export function startPolishRunner(): () => void {
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    const wasOffline = offline;
    offline = state.isConnected === false;
    if (wasOffline && !offline) kickPolish();
  });
  const appSub = AppState.addEventListener('change', (next) => {
    appState = next;
    if (next !== 'background') kickPolish();
  });
  const unsubscribeStore = usePolishQueueStore.subscribe((state, prev) => {
    if (state.jobs !== prev.jobs || state.blocked !== prev.blocked) kickPolish();
  });
  kickPolish();
  return () => {
    unsubscribeNet();
    appSub.remove();
    unsubscribeStore();
    if (wakeTimer) clearTimeout(wakeTimer);
  };
}
