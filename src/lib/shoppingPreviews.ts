import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import { useShoppingSessionStore } from '../stores/useShoppingSessionStore';
import { isShoppingVisitExpired } from './shoppingVisit';

export const SHOPPING_PREVIEW_DIRECTORY = new Directory(Paths.document, 'shopping-snap-previews');

export async function createShoppingPreview(sourceUri: string, id: string): Promise<string> {
  SHOPPING_PREVIEW_DIRECTORY.create({ intermediates: true, idempotent: true });
  const resized = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 240 } }],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
  );
  const destination = new File(SHOPPING_PREVIEW_DIRECTORY, `${id}.jpg`);
  await new File(resized.uri).copy(destination);
  return destination.uri;
}

export function deleteShoppingPreview(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Preview cleanup is opportunistic and must never block capture or exit.
  }
}

/** Reconciles persisted visit state and removes previews no longer referenced. */
export function maintainShoppingPreviews(now = Date.now()): void {
  const state = useShoppingSessionStore.getState();
  if (isShoppingVisitExpired(state.currentSession, now)) {
    state.endVisit(now);
  }

  const current = useShoppingSessionStore.getState();
  const retained = new Set(
    current.visitPreviews
      .map((preview) => preview.previewUri)
      .filter((uri): uri is string => Boolean(uri)),
  );
  for (const upload of current.pendingUploads) {
    if (upload.previewUri) retained.add(upload.previewUri);
  }

  try {
    if (!SHOPPING_PREVIEW_DIRECTORY.exists) return;
    for (const entry of SHOPPING_PREVIEW_DIRECTORY.list()) {
      if (entry instanceof File && !retained.has(entry.uri)) entry.delete();
    }
  } catch {
    // A missing/corrupt preview is recoverable from the original or remote URL.
  }
}
