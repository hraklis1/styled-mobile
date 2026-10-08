import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Haptics from '../../lib/haptics';
import { Directory, File, Paths } from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { scanWear } from './api';
import { dispatchWear, useWearLogStore } from './store';

/**
 * The scan photo lives in Documents (not Caches, which iOS may purge while
 * suspended) so a scan can be resumed after the app is killed or comes back
 * online. One flow at a time, so one file; anything else is swept.
 */
const ROOT = new Directory(Paths.document, 'wear-log');

function photoFile(flowId: string): File {
  ROOT.create({ intermediates: true, idempotent: true });
  return new File(ROOT, `${flowId}.jpg`);
}

function sweepPhotos(keepUri: string | null) {
  try {
    if (!ROOT.exists) return;
    for (const entry of ROOT.list()) {
      if (entry instanceof File && entry.uri !== keepUri) entry.delete();
    }
  } catch {
    // Best effort; the next launch sweeps again.
  }
}

async function readDataUrl(uri: string): Promise<string | null> {
  try {
    const file = new File(uri);
    if (!file.exists) return null;
    return `data:image/jpeg;base64,${await file.base64()}`;
  } catch {
    return null;
  }
}

let offline = false;
let running: string | null = null;

function isOfflineError(err: unknown): boolean {
  return !(err as { response?: unknown })?.response;
}

const statusOf = (err: unknown) => (err as { response?: { status?: number } })?.response?.status;

function messageFor(err: unknown): string {
  const status = statusOf(err);
  if (status === 402) return 'You’re out of scan credits. Top up to read this photo, or pick the pieces yourself.';
  if (status === 503) return 'The scanner is busy. Try again in a moment.';
  if (!status) return 'You’re offline. We’ll finish reading this photo when you’re back.';
  return 'Couldn’t read this photo. Try again, or pick the pieces yourself.';
}

async function run(id: string, photoUri: string) {
  if (running === id) return;
  running = id;
  try {
    if (offline) {
      dispatchWear({ type: 'scanFailed', id, message: messageFor(null), offline: true });
      return;
    }
    const dataUrl = await readDataUrl(photoUri);
    if (!dataUrl) {
      dispatchWear({ type: 'scanFailed', id, message: 'This photo is no longer available. Take it again.' });
      return;
    }
    const scan = await scanWear(id, dataUrl);
    dispatchWear({ type: 'scanSucceeded', id, scan, now: Date.now() });
    // Finished while the logger was closed: the tray changes, so say so.
    if (!useWearLogStore.getState().workspaceOpen) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  } catch (err) {
    dispatchWear({ type: 'scanFailed', id, message: messageFor(err), offline: isOfflineError(err), needsCredits: statusOf(err) === 402 });
  } finally {
    if (running === id) running = null;
  }
}

/** Start a new scan; replaces any flow in progress. */
export function startWearScan(image: { uri: string; dataUrl: string }, date: string): string {
  const id = Crypto.randomUUID();
  const file = photoFile(id);
  let photoUri = image.uri;
  try {
    file.write(image.dataUrl.slice(image.dataUrl.indexOf(',') + 1), { encoding: 'base64' });
    photoUri = file.uri;
  } catch {
    // Keep the picker's file; it still works for this session.
  }
  sweepPhotos(photoUri);
  dispatchWear({ type: 'capture', id, photoUri, date, now: Date.now() });
  void run(id, photoUri);
  return id;
}

/** Retry a failed scan with the same id, so a charged scan is replayed. */
export function retryWearScan(): boolean {
  const flow = useWearLogStore.getState().flow;
  if (flow.status !== 'failed') return false;
  dispatchWear({ type: 'retry', now: Date.now() });
  void run(flow.id, flow.photoUri);
  return true;
}

/** Pick up whatever was left mid-scan or waiting for the connection. */
function resume() {
  const flow = useWearLogStore.getState().flow;
  if (flow.status === 'processing') void run(flow.id, flow.photoUri);
  else if (flow.status === 'failed' && flow.offline && !offline) retryWearScan();
}

export function discardWearFlow() {
  sweepPhotos(null);
  dispatchWear({ type: 'reset' });
}

/**
 * Wire the scan to the app: resume on launch, and retry an offline scan on
 * reconnect or when the app comes back to the foreground. Returns an
 * unsubscribe.
 */
export function startWearRunner(): () => void {
  const start = () => {
    const flow = useWearLogStore.getState().flow;
    sweepPhotos(flow.status === 'idle' ? null : flow.photoUri);
    resume();
  };
  if (useWearLogStore.persist.hasHydrated()) start();
  const unsubscribeHydrate = useWearLogStore.persist.onFinishHydration(start);

  const unsubscribeNet = NetInfo.addEventListener((state) => {
    const wasOffline = offline;
    offline = state.isConnected === false;
    if (wasOffline && !offline) resume();
  });
  const appSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') resume();
  });
  return () => {
    unsubscribeHydrate();
    unsubscribeNet();
    appSub.remove();
  };
}
