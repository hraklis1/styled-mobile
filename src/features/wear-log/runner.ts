import * as Crypto from 'expo-crypto';
import { scanWear } from './api';
import { dispatchWear, useWearLogStore } from './store';

/**
 * The photo's data URL, kept in memory for a retry in this session. It is not
 * persisted (MMKV is not a place for megabytes); resuming a scan after a
 * relaunch is Phase 4's offline queue.
 */
const pending = new Map<string, string>();

function messageFor(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 402) return 'You’re out of scan credits. You can still pick the pieces yourself.';
  if (status === 503) return 'The scanner is busy. Try again in a moment.';
  if (!status) return 'Couldn’t reach Styled. Check your connection and try again.';
  return 'Couldn’t read this photo. Try again, or pick the pieces yourself.';
}

async function run(id: string, dataUrl: string) {
  try {
    const scan = await scanWear(id, dataUrl);
    dispatchWear({ type: 'scanSucceeded', id, scan, now: Date.now() });
  } catch (err) {
    dispatchWear({ type: 'scanFailed', id, message: messageFor(err) });
  }
}

/** Start a new scan; replaces any review in progress. */
export function startWearScan(image: { uri: string; dataUrl: string }, date: string): string {
  const id = Crypto.randomUUID();
  pending.clear();
  pending.set(id, image.dataUrl);
  dispatchWear({ type: 'capture', id, photoUri: image.uri, date, now: Date.now() });
  void run(id, image.dataUrl);
  return id;
}

/** Retry a failed scan with the same id, so a charged scan is replayed. */
export function retryWearScan(): boolean {
  const flow = useWearLogStore.getState().flow;
  if (flow.status !== 'failed') return false;
  const dataUrl = pending.get(flow.id);
  if (!dataUrl) return false;
  dispatchWear({ type: 'retry', now: Date.now() });
  void run(flow.id, dataUrl);
  return true;
}

export function discardWearFlow() {
  pending.clear();
  dispatchWear({ type: 'reset' });
}
