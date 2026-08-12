import AsyncStorage from '@react-native-async-storage/async-storage';

export type AiActionCoachSurface = 'item_polish' | 'outfit_flatlay';

const AI_ACTION_COACH_VERSION = 'v1';
const AI_ACTION_COACH_KEY_PREFIX = 'ai_action_coach_seen';

function keyForUser(surface: AiActionCoachSurface, userId: string): string {
  return `${AI_ACTION_COACH_KEY_PREFIX}:${surface}:${AI_ACTION_COACH_VERSION}:${userId}`;
}

export async function hasSeenAiActionCoach(
  surface: AiActionCoachSurface,
  userId: string,
): Promise<boolean> {
  return (await AsyncStorage.getItem(keyForUser(surface, userId))) === '1';
}

export async function markAiActionCoachSeen(
  surface: AiActionCoachSurface,
  userId: string,
): Promise<void> {
  await AsyncStorage.setItem(keyForUser(surface, userId), '1');
}
