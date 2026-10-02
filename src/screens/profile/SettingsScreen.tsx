import React from 'react';
import { Text, StyleSheet, Linking, Alert } from 'react-native';
import Constants from 'expo-constants';
import { SettingsScaffold, Group, NavRow } from '../../components/profile/SettingsUI';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useAppPreferences } from '../../hooks/useAppPreferences';
import { colors, spacing, typography } from '../../theme';
import type { ProfileStackScreenProps } from './types';
import { planTierLabel } from './membership';

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL;

export async function openExternalUrl(label: string, url?: string) {
  if (!url) {
    Alert.alert('Not configured', `${label} is not configured for this build.`);
    return;
  }
  if (!(await Linking.canOpenURL(url))) {
    Alert.alert('Unable to open link', `Could not open ${label.toLowerCase()}.`);
    return;
  }
  await Linking.openURL(url);
}

const TONE_LABEL = { concise: 'Concise', balanced: 'Balanced', detailed: 'Detailed' } as const;

/**
 * App settings, ordered by how often people come here for them: membership,
 * then how the stylist behaves, then device-level preferences, then account
 * and legal. Destructive actions live one level down, in Account.
 */
export function SettingsScreen({ navigation }: ProfileStackScreenProps<'Settings'>) {
  const { planTier, credits } = useEntitlement();
  const { prefs } = useAppPreferences();
  const n = prefs.notifications;
  const remindersOn = [n.dailyLook.enabled, n.wearLog, n.events].filter(Boolean).length;
  const version = Constants.expoConfig?.version ?? '';

  return (
    <SettingsScaffold title="Settings">
      <Group>
        <NavRow icon="diamond-outline" label="Membership & credits"
          value={[planTierLabel(planTier), credits ? `${credits.total} credits` : ''].filter(Boolean).join(' · ')}
          onPress={() => navigation.navigate('SettingsMembership')} />
      </Group>

      <Group title="Experience">
        <NavRow icon="chatbubble-ellipses-outline" label="Stylist"
          value={TONE_LABEL[prefs.stylistTone]}
          onPress={() => navigation.navigate('SettingsStylist')} />
        <NavRow icon="notifications-outline" label="Notifications"
          value={remindersOn ? `${remindersOn} on` : 'Off'}
          onPress={() => navigation.navigate('SettingsNotifications')} />
        <NavRow icon="accessibility-outline" label="Accessibility"
          onPress={() => navigation.navigate('SettingsAccessibility')} />
      </Group>

      <Group title="Your data">
        <NavRow icon="bulb-outline" label="What Styled has learned"
          onPress={() => navigation.navigate('SettingsLearned')} />
        <NavRow icon="shield-checkmark-outline" label="Privacy & data"
          onPress={() => navigation.navigate('SettingsPrivacy')} />
        <NavRow icon="person-circle-outline" label="Account"
          onPress={() => navigation.navigate('SettingsAccount')} />
      </Group>

      <Group title="Support">
        <NavRow label="Contact support" external onPress={() => openExternalUrl('Contact support', SUPPORT_URL)} />
        <NavRow label="Privacy Policy" external onPress={() => openExternalUrl('Privacy Policy', PRIVACY_URL)} />
        <NavRow label="Terms of Service" external onPress={() => openExternalUrl('Terms of Service', TERMS_URL)} />
      </Group>

      {!!version && <Text style={s.version}>Styled {version}</Text>}
    </SettingsScaffold>
  );
}

const s = StyleSheet.create({
  version: { ...typography.text.caption, color: colors.controlOutline, textAlign: 'center', marginTop: -spacing.sm },
});
