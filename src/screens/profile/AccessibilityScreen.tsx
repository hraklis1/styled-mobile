import React from 'react';
import { SettingsScaffold, Group, ToggleRow } from '../../components/profile/SettingsUI';
import { useAppPreferences } from '../../hooks/useAppPreferences';

/**
 * Comfort settings that apply app-wide through AppPreferencesEffects. Reduce
 * motion only ever adds to the iOS setting: "off" defers to the system rather
 * than forcing animation back on.
 */
export function AccessibilityScreen() {
  const { prefs, setPrefs } = useAppPreferences();
  return (
    <SettingsScaffold title="Accessibility">
      <Group footer="Even with this off, Styled still follows Reduce Motion in iOS Settings.">
        <ToggleRow icon="pulse-outline" label="Reduce motion"
          detail="Swap slides and springs for simple fades."
          value={prefs.reduceMotion}
          onChange={(value) => setPrefs({ reduceMotion: value })} />
      </Group>
      <Group>
        <ToggleRow icon="phone-portrait-outline" label="Haptics"
          detail="Subtle taps when you save, swipe and select."
          value={prefs.haptics}
          onChange={(value) => setPrefs({ haptics: value })} />
      </Group>
    </SettingsScaffold>
  );
}
