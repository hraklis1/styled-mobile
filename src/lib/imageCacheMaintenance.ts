import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Directory, Paths } from 'expo-file-system';

const LAST_CHECK_KEY = 'image_cache_last_check';

/**
 * Cache ceiling before we evict. A closet of a few hundred items pulls its
 * originals (a couple of hundred KB each) plus cutouts (~30 KB each) through
 * the image cache; 250 MB leaves plenty of headroom for normal browsing while
 * stopping the app from quietly growing without bound on a long-lived install.
 */
const MAX_CACHE_BYTES = 250 * 1024 * 1024;

/** Measuring the cache walks the directory tree, so do it at most once a day. */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function shouldCheck(now: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return true;
    const last = Number(raw);
    return !Number.isFinite(last) || now - last > CHECK_INTERVAL_MS;
  } catch {
    return false;
  }
}

/**
 * Evict expo-image's disk cache if the app's cache directory has grown past
 * MAX_CACHE_BYTES.
 *
 * expo-image (SDWebImage on iOS, Glide on Android) applies no size ceiling of
 * its own, so on a large wardrobe the cache only ever grows. Eviction is
 * all-or-nothing because expo-image exposes no per-entry API — acceptable
 * because everything in it is remote and re-fetchable, and because at a day's
 * granularity a user will rarely notice one cold reload.
 *
 * Returns true if the cache was cleared.
 */
export async function maintainImageCache(now = Date.now()): Promise<boolean> {
  if (!(await shouldCheck(now))) return false;

  try {
    // Record the attempt before doing the work: a failure part-way through
    // shouldn't turn into a directory walk on every single launch.
    await AsyncStorage.setItem(LAST_CHECK_KEY, String(now));

    const size = new Directory(Paths.cache).info().size ?? 0;
    if (size <= MAX_CACHE_BYTES) return false;

    await Image.clearDiskCache();
    return true;
  } catch {
    // Cache maintenance is opportunistic — never surface or escalate a failure.
    return false;
  }
}

/**
 * Schedule a cache check off the critical path.
 *
 * `Directory.info()` is a synchronous recursive walk, so it must not run during
 * launch or render — this waits for interactions to settle first.
 */
export function scheduleImageCacheMaintenance(): void {
  InteractionManager.runAfterInteractions(() => {
    void maintainImageCache();
  });
}
