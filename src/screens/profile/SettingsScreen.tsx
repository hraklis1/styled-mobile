import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import { TemperatureSetting } from '../../components/profile/TemperatureSetting';
import Constants from 'expo-constants';
import { SettingsScaffold, Group, NavRow } from '../../components/profile/SettingsUI';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useAppPreferences } from '../../hooks/useAppPreferences';
import { useAuth } from '../../contexts/AuthContext';
import { resetAllTips } from '../../lib/resetTips';
import { track } from '../../lib/analytics';
import { confirmSheet } from '../../components/primitives/ConfirmSheet';
import * as Haptics from '../../lib/haptics';
import { SearchField } from '../../components/primitives/SearchField';
import { colors, spacing, typography } from '../../theme';
import type { ProfileStackScreenProps } from './types';
import { planTierLabel } from './membership';
import { searchSettings, type SettingsAction, type SettingsSearchEntry } from './settingsSearch';

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
  const { user } = useAuth();

  // The row itself confirms the reset, rather than a second sheet on top.
  const [tipsReset, setTipsReset] = useState(false);

  const confirmResetTips = () => {
    const userId = user?.id;
    if (!userId) return;
    confirmSheet({
      title: 'Show tips again?',
      message: 'The hints that explain each feature will reappear as you move around the app.',
      confirmLabel: 'Show tips',
      onConfirm: async () => {
        try {
          await resetAllTips(String(userId));
          track('tips_reset');
          setTipsReset(true);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          confirmSheet({ title: 'Couldn’t reset tips', message: 'Please try again.', confirmLabel: 'OK', cancelLabel: null, onConfirm: () => {} });
        }
      },
    });
  };

  const [query, setQuery] = useState('');
  const results = useMemo(() => searchSettings(query), [query]);
  const searching = query.trim().length > 0;

  const runAction = (action: SettingsAction) => {
    switch (action) {
      case 'resetTips': return confirmResetTips();
      case 'support': return void openExternalUrl('Contact support', SUPPORT_URL);
      case 'privacyPolicy': return void openExternalUrl('Privacy Policy', PRIVACY_URL);
      case 'terms': return void openExternalUrl('Terms of Service', TERMS_URL);
    }
  };

  const openResult = (entry: SettingsSearchEntry) => {
    track('settings_search_select', { id: entry.id, queryLength: query.trim().length });
    if ('action' in entry.target) runAction(entry.target.action);
    else navigation.navigate(entry.target.route);
  };

  return (
    <SettingsScaffold title="Settings">
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search settings"
        accessibilityLabel="Search settings"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
      />

      {searching ? (
        results.length ? (
          <Group title={`${results.length} ${results.length === 1 ? 'result' : 'results'}`}>
            {results.map((entry) => (
              <NavRow key={entry.id} icon={entry.icon} label={entry.title} detail={entry.path}
                external={'action' in entry.target && entry.target.action !== 'resetTips'}
                onPress={() => openResult(entry)} />
            ))}
          </Group>
        ) : (
          <View style={s.empty} accessibilityLiveRegion="polite">
            <Text style={s.emptyTitle}>No settings match “{query.trim()}”</Text>
            <Text style={s.emptyBody}>Try a different word, like “notifications”, “password” or “units”.</Text>
          </View>
        )
      ) : (
        <>
          <Group>
            <NavRow icon="diamond-outline" label="Membership & credits"
              value={[planTierLabel(planTier), credits ? `${credits.total} credits` : ''].filter(Boolean).join(' · ')}
              onPress={() => navigation.navigate('SettingsMembership')} />
          </Group>

          <Group title="Units">
            <TemperatureSetting />
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
            <NavRow icon="help-circle-outline" label="Show tips again"
              value={tipsReset ? 'Tips are back' : undefined}
              onPress={confirmResetTips} />
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
        </>
      )}
    </SettingsScaffold>
  );
}

const s = StyleSheet.create({
  empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyTitle: { ...typography.text.body, color: colors.foreground, textAlign: 'center' },
  emptyBody: { ...typography.text.caption, color: colors.mutedForeground, textAlign: 'center' },
  version: { ...typography.text.caption, color: colors.controlOutline, textAlign: 'center', marginTop: -spacing.sm },
});
