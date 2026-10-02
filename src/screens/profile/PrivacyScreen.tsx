import React, { useCallback, useState } from 'react';
import { Alert, Linking, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { SettingsScaffold, Group, NavRow, ToggleRow } from '../../components/profile/SettingsUI';
import { ClosetVisualsCard } from '../../components/profile/ClosetVisualsCard';
import { useAppPreferences } from '../../hooks/useAppPreferences';
import { api } from '../../lib/api';
import type { ProfileStackScreenProps } from './types';

const ACCOUNT_DELETION_URL = process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL;

/** Clears the on-device copies StylistChatView keeps of each thread. */
async function clearLocalStylistThreads() {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith('stylist_thread_') || key === 'stylist_active_thread_id' || key === 'stylist_last_session'));
}

export function PrivacyScreen({ navigation }: ProfileStackScreenProps<'SettingsPrivacy'>) {
  const { prefs, setPrefs } = useAppPreferences();
  const [locationStatus, setLocationStatus] = useState<string>('…');
  const [exporting, setExporting] = useState(false);

  useFocusEffect(useCallback(() => {
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => setLocationStatus(status === 'granted' ? 'Allowed' : status === 'denied' ? 'Off' : 'Not asked'))
      .catch(() => setLocationStatus('Unknown'));
  }, []));

  const exportData = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/api/account/export', { timeout: 60_000 });
      const file = new File(Paths.cache, `styled-export-${new Date().toISOString().slice(0, 10)}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(data, null, 2));
      await Share.share({ url: file.uri, title: 'Styled data export' });
    } catch (err: any) {
      Alert.alert('Export failed', err?.response?.data?.message ?? 'Please try again in a moment.');
    } finally {
      setExporting(false);
    }
  };

  const clearHistory = () => {
    Alert.alert('Clear stylist history?', 'Deletes every conversation. What Styled has learned about your taste is kept. Manage that separately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            const { data } = await api.delete<{ deleted: number }>('/api/stylist/conversations');
            await clearLocalStylistThreads();
            Alert.alert('Cleared', `${data.deleted} conversation${data.deleted === 1 ? '' : 's'} deleted.`);
          } catch {
            Alert.alert('Error', "Couldn't clear your history. Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <SettingsScaffold title="Privacy & Data">
      <Group title="Permissions" footer="Location is used only to fetch your local weather when you ask for a look.">
        <NavRow icon="location-outline" label="Location" value={locationStatus} onPress={() => Linking.openSettings()} />
      </Group>

      <Group footer="Anonymous usage analytics help us find bugs and improve features. Your wardrobe photos are never included.">
        <ToggleRow icon="analytics-outline" label="Share usage analytics"
          value={!prefs.analyticsOptOut}
          onChange={(value) => setPrefs({ analyticsOptOut: !value })} />
      </Group>

      <Group title="Your stylist">
        <NavRow icon="bulb-outline" label="What Styled has learned" onPress={() => navigation.navigate('SettingsLearned')} />
        <NavRow icon="chatbubbles-outline" label="Clear stylist history" onPress={clearHistory} />
      </Group>

      <ClosetVisualsCard />

      <Group title="Your data">
        <NavRow icon="download-outline" label={exporting ? 'Preparing export…' : 'Export my data'}
          detail="Your profile, closet, outfits, events and conversations as JSON."
          onPress={() => { if (!exporting) void exportData(); }} />
        {!!ACCOUNT_DELETION_URL && (
          <NavRow label="Account deletion on the web" external onPress={() => Linking.openURL(ACCOUNT_DELETION_URL)} />
        )}
      </Group>
    </SettingsScaffold>
  );
}
