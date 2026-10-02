import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SettingsScaffold, Group, NavRow, ToggleRow, GroupBlock } from '../../components/profile/SettingsUI';
import { useAppPreferences } from '../../hooks/useAppPreferences';
import { ensureNotificationPermission, getNotificationPermission, type NotificationPermission } from '../../lib/notifications';

function toDate(time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour || 7, minute || 0, 0, 0);
  return date;
}

function toTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatTime(time: string): string {
  return toDate(time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Reminders are local notifications (lib/notifications.ts). Turning one on is
 * the only point where Styled asks for notification permission, so the
 * system prompt always appears with a reason the user just chose.
 */
export function NotificationsScreen() {
  const { prefs, setPrefs } = useAppPreferences();
  const n = prefs.notifications;
  const [permission, setPermission] = useState<NotificationPermission>('undetermined');
  const [pickingTime, setPickingTime] = useState(false);

  useFocusEffect(useCallback(() => { getNotificationPermission().then(setPermission).catch(() => {}); }, []));
  useEffect(() => { if (!n.dailyLook.enabled) setPickingTime(false); }, [n.dailyLook.enabled]);

  const enable = async (apply: () => void) => {
    const granted = await ensureNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
    if (!granted) {
      Alert.alert('Notifications are off', 'Allow notifications for Styled in Settings to get reminders.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    apply();
  };

  const toggle = (value: boolean, apply: () => void) => (value ? enable(apply) : apply());
  const blocked = permission === 'denied';

  return (
    <SettingsScaffold title="Notifications" lede="A few well-timed nudges. Everything is off until you turn it on.">
      {blocked && (
        <Group footer="Notifications are blocked for Styled in iOS Settings, so reminders can't be delivered.">
          <NavRow icon="alert-circle-outline" label="Allow notifications" onPress={() => Linking.openSettings()} external />
        </Group>
      )}

      <Group title="Daily">
        <ToggleRow icon="sunny-outline" label="Today's Look"
          detail="A morning note when your outfit for the day is ready."
          value={n.dailyLook.enabled}
          onChange={(value) => toggle(value, () => setPrefs({ notifications: { dailyLook: { enabled: value } } }))} />
        {n.dailyLook.enabled && (
          <NavRow label="Delivery time" value={formatTime(n.dailyLook.time)} onPress={() => setPickingTime((open) => !open)} />
        )}
        {n.dailyLook.enabled && pickingTime && (
          <GroupBlock>
            <View style={{ alignItems: 'center' }}>
              <DateTimePicker
                value={toDate(n.dailyLook.time)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minuteInterval={15}
                onChange={(_, date) => {
                  if (Platform.OS !== 'ios') setPickingTime(false);
                  if (date) setPrefs({ notifications: { dailyLook: { time: toTime(date) } } });
                }}
              />
            </View>
          </GroupBlock>
        )}
        <ToggleRow icon="shirt-outline" label="Wear log"
          detail="An 8 pm prompt to log what you wore. It makes your next suggestions better."
          value={n.wearLog}
          onChange={(value) => toggle(value, () => setPrefs({ notifications: { wearLog: value } }))} />
      </Group>

      <Group title="Plans">
        <ToggleRow icon="calendar-outline" label="Event outfits"
          detail="The evening before an event with no outfit planned yet."
          value={n.events}
          onChange={(value) => toggle(value, () => setPrefs({ notifications: { events: value } }))} />
      </Group>
    </SettingsScaffold>
  );
}
