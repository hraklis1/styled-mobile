import AsyncStorage from '@react-native-async-storage/async-storage';

const SHORTCUT_COACH_VERSION = 'v1';
const SHORTCUT_COACH_KEY_PREFIX = 'shortcut_coach_seen';

function keyForUser(userId: string): string {
  return `${SHORTCUT_COACH_KEY_PREFIX}:${SHORTCUT_COACH_VERSION}:${userId}`;
}

export async function hasSeenShortcutCoach(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(keyForUser(userId))) === '1';
}

export async function markShortcutCoachSeen(userId: string): Promise<void> {
  await AsyncStorage.setItem(keyForUser(userId), '1');
}

