/**
 * expo-haptics behind the user's Settings → Accessibility switch.
 *
 * Every screen imports haptics from here instead of from 'expo-haptics', so a
 * single flag silences the whole app. The flag is pushed in by
 * AppPreferencesEffects when the profile loads or changes.
 */
import * as ExpoHaptics from 'expo-haptics';

export {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from 'expo-haptics';

let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export function impactAsync(style?: ExpoHaptics.ImpactFeedbackStyle): Promise<void> {
  return enabled ? ExpoHaptics.impactAsync(style) : Promise.resolve();
}

export function notificationAsync(type?: ExpoHaptics.NotificationFeedbackType): Promise<void> {
  return enabled ? ExpoHaptics.notificationAsync(type) : Promise.resolve();
}

export function selectionAsync(): Promise<void> {
  return enabled ? ExpoHaptics.selectionAsync() : Promise.resolve();
}
