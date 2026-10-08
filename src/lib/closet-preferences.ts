import AsyncStorage from '@react-native-async-storage/async-storage';

export type PiecesViewMode = 'grid' | 'grid3' | 'grid4' | 'rails' | 'list';

/** Grid densities a pinch steps through, loosest first. */
export const GRID_DENSITIES = ['grid', 'grid3', 'grid4'] as const satisfies readonly PiecesViewMode[];

export function gridColumns(viewMode: PiecesViewMode): 1 | 2 | 3 | 4 {
  return viewMode === 'list' ? 1 : viewMode === 'grid3' ? 3 : viewMode === 'grid4' ? 4 : 2;
}

/** Pinch out (zoom in) loosens the grid; pinch in tightens it. List zooms into the loosest grid. */
export function pinchViewMode(viewMode: PiecesViewMode, direction: 'in' | 'out'): PiecesViewMode {
  if (viewMode === 'rails') return viewMode;
  if (viewMode === 'list') return direction === 'in' ? 'grid' : 'list';
  const index = GRID_DENSITIES.indexOf(viewMode);
  const next = direction === 'in' ? index + 1 : index - 1;
  return GRID_DENSITIES[Math.max(0, Math.min(GRID_DENSITIES.length - 1, next))];
}

export const PIECES_VIEW_MODE_STORAGE_KEY = 'styled:closet:pieces-view-mode:v1';

export function parsePiecesViewMode(value: string | null | undefined): PiecesViewMode {
  return value === 'list' || value === 'grid' || value === 'grid3' || value === 'grid4' || value === 'rails' ? value : 'grid';
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
