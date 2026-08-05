import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadPiecesViewMode,
  parsePiecesViewMode,
  PIECES_VIEW_MODE_STORAGE_KEY,
  savePiecesViewMode,
} from '../closet-preferences';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

describe('closet view preferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts known modes and defaults unknown values to grid', () => {
    expect(parsePiecesViewMode('grid')).toBe('grid');
    expect(parsePiecesViewMode('list')).toBe('list');
    expect(parsePiecesViewMode('dense')).toBe('grid');
    expect(parsePiecesViewMode(null)).toBe('grid');
  });

  it('loads a valid persisted mode', async () => {
    getItem.mockResolvedValue('list');
    await expect(loadPiecesViewMode()).resolves.toBe('list');
    expect(getItem).toHaveBeenCalledWith(PIECES_VIEW_MODE_STORAGE_KEY);
  });

  it('falls back to grid when storage fails', async () => {
    getItem.mockRejectedValue(new Error('unavailable'));
    await expect(loadPiecesViewMode()).resolves.toBe('grid');
  });

  it('persists a selected mode and swallows preference write failures', async () => {
    setItem.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('full'));
    await expect(savePiecesViewMode('list')).resolves.toBeUndefined();
    await expect(savePiecesViewMode('grid')).resolves.toBeUndefined();
    expect(setItem).toHaveBeenNthCalledWith(1, PIECES_VIEW_MODE_STORAGE_KEY, 'list');
  });
});
