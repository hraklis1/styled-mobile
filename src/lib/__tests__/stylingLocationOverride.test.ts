jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateKey } from '../dailyStylistPick';
import {
  loadLocationOverride,
  saveLocationOverride,
} from '../stylingLocationOverride';

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const removeItem = AsyncStorage.removeItem as jest.Mock;

describe('styling location override', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
  });

  it('returns an override saved today', async () => {
    const today = toLocalDateKey(new Date());
    getItem.mockResolvedValue(
      JSON.stringify({ date: today, override: { mode: 'destination', label: 'Paris, FR' } }),
    );

    await expect(loadLocationOverride('1')).resolves.toEqual({
      mode: 'destination',
      label: 'Paris, FR',
    });
  });

  it('ignores an override stored on a previous day', async () => {
    getItem.mockResolvedValue(
      JSON.stringify({ date: '2000-01-01', override: { mode: 'home' } }),
    );

    await expect(loadLocationOverride('1')).resolves.toBeNull();
  });

  it('ignores a destination override with no label', async () => {
    const today = toLocalDateKey(new Date());
    getItem.mockResolvedValue(
      JSON.stringify({ date: today, override: { mode: 'destination', label: '  ' } }),
    );

    await expect(loadLocationOverride('1')).resolves.toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    getItem.mockResolvedValue('not json');
    await expect(loadLocationOverride('1')).resolves.toBeNull();
  });

  it('persists non-current overrides under a per-user, dated key', async () => {
    await saveLocationOverride('42', { mode: 'home' });

    expect(setItem).toHaveBeenCalledTimes(1);
    const [key, value] = setItem.mock.calls[0];
    expect(key).toContain('42');
    expect(JSON.parse(value)).toEqual({
      date: toLocalDateKey(new Date()),
      override: { mode: 'home' },
    });
  });

  it('clears storage instead of saving the current default', async () => {
    await saveLocationOverride('42', { mode: 'current' });

    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalledWith(expect.stringContaining('42'));
  });
});
