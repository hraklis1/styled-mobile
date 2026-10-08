import { resetAiActionCoaches } from './aiActionCoach';
import { resetBrandTip } from './scanBrandTip';
import { resetCropTip } from './scanCropTip';
import { resetOrganizerHint } from './shoppingOrganizerHint';
import { resetShortcutCoach } from './shortcutCoach';

/**
 * Brings back every one-time tip — coachmarks, tours, the shortcut coach and
 * the inline scan and shopping hints — for this user on this device. Screens
 * that are already open read their flags on focus or next mount, so a tip
 * reappears the next time its screen is visited.
 */
export async function resetAllTips(userId: string): Promise<void> {
  await Promise.all([
    resetAiActionCoaches(userId),
    resetShortcutCoach(userId),
    resetOrganizerHint(),
    resetBrandTip(),
    resetCropTip(),
  ]);
}
