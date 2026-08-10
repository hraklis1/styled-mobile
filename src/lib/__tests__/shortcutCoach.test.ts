import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSeenShortcutCoach, markShortcutCoachSeen } from '../shortcutCoach';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

describe('shortcut coach persistence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses a versioned, user-scoped key', async () => {
    getItem.mockResolvedValue('1');

    await expect(hasSeenShortcutCoach('user-123')).resolves.toBe(true);
    expect(getItem).toHaveBeenCalledWith('shortcut_coach_seen:v1:user-123');
  });

  it('marks the coach as seen for the current user', async () => {
    await markShortcutCoachSeen('user-456');

    expect(setItem).toHaveBeenCalledWith('shortcut_coach_seen:v1:user-456', '1');
  });
});

