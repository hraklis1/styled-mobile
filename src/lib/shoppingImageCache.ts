import { Directory, File, Paths } from 'expo-file-system';
import { createMMKV } from 'react-native-mmkv';
import type { ShoppingSnap } from '../types/shoppingSnap';
import { queryClient } from './queryClient';
import { useShoppingOfflineStore } from '../stores/useShoppingOfflineStore';

const LIMIT = 250 * 1024 * 1024;
const access = createMMKV({ id: 'styled.shopping-image-access' });
const active = new Set<string>();
function folder(userId: string) {
  const directory = new Directory(Paths.cache, 'shopping-previews', userId);
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}
export function touchShoppingImage(uri: string) {
  if (uri.includes('/shopping-previews/')) access.set(uri, Date.now());
}
function prune(directory: Directory, userId: string) {
  const files = directory
    .list()
    .filter((file): file is File => file instanceof File);
  let size = files.reduce((total, file) => total + file.size, 0);
  const evicted = new Set<string>();
  for (const file of files.sort(
    (a, b) => (access.getNumber(a.uri) ?? 0) - (access.getNumber(b.uri) ?? 0),
  )) {
    if (size <= LIMIT) break;
    size -= file.size;
    evicted.add(file.uri);
    access.remove(file.uri);
    file.delete();
  }
  if (!evicted.size) return;
  const restoreRemote = (snap: ShoppingSnap) =>
    evicted.has(snap.imageUri) && snap.remoteImageUri
      ? { ...snap, imageUri: snap.remoteImageUri }
      : snap;
  const account = useShoppingOfflineStore.getState().accounts[userId];
  if (account)
    useShoppingOfflineStore
      .getState()
      .cache(userId, account.snaps.map(restoreRemote));
  queryClient.setQueryData<ShoppingSnap[]>(['shopping-snaps', userId], (old) =>
    old?.map(restoreRemote),
  );
}
/** Only acknowledged originals enter this cache; pending originals are elsewhere. */
export function retainShoppingImage(
  userId: string,
  snapId: string,
  original: string,
): string {
  const directory = folder(userId);
  const source = new File(original);
  const target = new File(directory, `${snapId}.jpg`);
  if (!target.exists) source.copy(target);
  touchShoppingImage(target.uri);
  prune(directory, userId);
  // An exceptional oversized photo must not cause its original to be deleted.
  return target.exists ? target.uri : original;
}
export function resolveShoppingImage(snap: ShoppingSnap): ShoppingSnap {
  if (
    snap.remoteImageUri &&
    snap.imageUri.startsWith('file:') &&
    !new File(snap.imageUri).exists
  )
    return { ...snap, imageUri: snap.remoteImageUri };
  return snap;
}
/** Local-first metadata reads never wait for downloads. */
export async function cacheShoppingImages(
  userId: string,
  snaps: ShoppingSnap[],
): Promise<ShoppingSnap[]> {
  const directory = folder(userId);
  const result = snaps.map((snap) => {
    const file = new File(directory, `${snap.id}.jpg`);
    return file.exists
      ? { ...snap, imageUri: file.uri }
      : resolveShoppingImage(snap);
  });
  if (active.has(userId)) return result;
  active.add(userId);
  void (async () => {
    // Prioritize recent photographs and stop prefetching when the cache is full.
    for (const snap of snaps) {
      const file = new File(directory, `${snap.id}.jpg`);
      const remote = snap.remoteImageUri ?? snap.imageUri;
      if (file.exists || !/^https?:/.test(remote)) continue;
      try {
        await File.downloadFileAsync(remote, file, { idempotent: true });
        access.set(file.uri, Date.parse(snap.capturedAt));
        prune(directory, userId);
        if (!file.exists) break;
        const local = (value: ShoppingSnap) =>
          value.id === snap.id
            ? { ...value, imageUri: file.uri, remoteImageUri: remote }
            : value;
        const account = useShoppingOfflineStore.getState().accounts[userId];
        if (account)
          useShoppingOfflineStore
            .getState()
            .cache(userId, account.snaps.map(local));
        queryClient.setQueryData<ShoppingSnap[]>(
          ['shopping-snaps', userId],
          (old) => old?.map(local),
        );
      } catch {
        break;
      }
    }
  })().finally(() => active.delete(userId));
  return result;
}
