import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import type { Bbox } from './types';

/**
 * Working files for batch imports. Documents, not Caches: iOS may purge the
 * cache directory while the app is suspended, and a batch has to survive an
 * app kill. Persisted URIs are absolute and re-rooted on load by
 * relocateLocalUris (iOS moves the sandbox on every install/update).
 */
const ROOT = new Directory(Paths.document, 'batch-import');

export function batchDirectory(batchId: string): Directory {
  const dir = new Directory(ROOT, batchId);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function deleteBatchFiles(batchId: string): void {
  try {
    const dir = new Directory(ROOT, batchId);
    if (dir.exists) dir.delete();
  } catch {
    // Best effort; pruneBatchFiles sweeps leftovers on the next launch.
  }
}

/** Remove every batch folder except the one still in use. */
export function pruneBatchFiles(keepBatchId: string | null): void {
  try {
    if (!ROOT.exists) return;
    for (const entry of ROOT.list()) {
      if (entry instanceof Directory && entry.name !== keepBatchId) entry.delete();
    }
  } catch {
    // Best effort.
  }
}

export function fileExists(uri: string | null | undefined): boolean {
  if (!uri) return false;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export function deleteFile(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best effort.
  }
}

export async function readBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}

export async function writeBase64(dir: Directory, name: string, base64: string): Promise<string> {
  const file = new File(dir, name);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

/** Move a manipulator output (cache dir) into the batch folder under a stable name. */
async function adopt(dir: Directory, name: string, tempUri: string): Promise<string> {
  const target = new File(dir, name);
  if (target.exists) target.delete();
  await new File(tempUri).move(target);
  return target.uri;
}

/**
 * Downscale so the long edge is at most `maxDim`, re-encode as JPEG and store
 * it in the batch folder. Re-encoding bakes in orientation and drops all EXIF
 * (GPS, device) — nothing identifying leaves the phone.
 */
export async function resizeToFile(
  sourceUri: string,
  size: { width: number | null; height: number | null },
  maxDim: number,
  compress: number,
  dir: Directory,
  name: string,
): Promise<{ uri: string; width: number; height: number }> {
  const { width, height } = size;
  const actions: ImageManipulator.Action[] = [];
  if (width && height && Math.max(width, height) > maxDim) {
    actions.push(width >= height ? { resize: { width: maxDim } } : { resize: { height: maxDim } });
  } else if (!width || !height) {
    // Unknown size (rare picker omission): bound the width and let height follow.
    actions.push({ resize: { width: maxDim } });
  }
  const result = await ImageManipulator.manipulateAsync(sourceUri, actions, {
    compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: await adopt(dir, name, result.uri), width: result.width, height: result.height };
}

/**
 * Crop a percentage bbox out of an image of known size.
 *
 * With `dir` + `name` the crop is stored and its URI returned; without, the
 * crop is returned as a data URL and nothing is kept (request payloads).
 */
export async function cropRegion(
  sourceUri: string,
  size: { width: number; height: number },
  bbox: Bbox,
  opts: { maxDim: number; compress: number },
  target?: { dir: Directory; name: string },
): Promise<string | null> {
  const sx = Math.max(0, Math.round((bbox.x / 100) * size.width));
  const sy = Math.max(0, Math.round((bbox.y / 100) * size.height));
  const sw = Math.min(size.width - sx, Math.round((bbox.width / 100) * size.width));
  const sh = Math.min(size.height - sy, Math.round((bbox.height / 100) * size.height));
  if (sw <= 0 || sh <= 0) return null;

  const actions: ImageManipulator.Action[] = [
    { crop: { originX: sx, originY: sy, width: sw, height: sh } },
  ];
  if (Math.max(sw, sh) > opts.maxDim) {
    actions.push(sw >= sh ? { resize: { width: opts.maxDim } } : { resize: { height: opts.maxDim } });
  }
  const result = await ImageManipulator.manipulateAsync(sourceUri, actions, {
    compress: opts.compress,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: !target,
  });
  if (target) return adopt(target.dir, target.name, result.uri);
  new File(result.uri).delete();
  return result.base64 ? `data:image/jpeg;base64,${result.base64}` : null;
}
