import AsyncStorage from '@react-native-async-storage/async-storage';

export type PiecesViewMode = 'grid' | 'list';

export const PIECES_VIEW_MODE_STORAGE_KEY = 'styled:closet:pieces-view-mode:v1';

export function parsePiecesViewMode(value: string | null | undefined): PiecesViewMode {
  return value === 'list' || value === 'grid' ? value : 'grid';
}

export async function loadPiecesViewMode(): Promise<PiecesViewMode> {
  try {
    return parsePiecesViewMode(await AsyncStorage.getItem(PIECES_VIEW_MODE_STORAGE_KEY));
  } catch {
    return 'grid';
  }
}

export async function savePiecesViewMode(viewMode: PiecesViewMode): Promise<void> {
  try {
    await AsyncStorage.setItem(PIECES_VIEW_MODE_STORAGE_KEY, viewMode);
  } catch {
    // A view preference should never block the closet from rendering.
  }
}
