import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Host, Switch } from '@expo/ui';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAvailableCalendars,
  useCalendarActions,
  useConnectedCalendars,
  type CalendarConnection,
} from '../../hooks/useCalendarConnections';
import { api, API_BASE_URL } from '../../lib/api';
import {
  connectGoogleCalendar,
  GOOGLE_CALENDAR_ERROR_MESSAGES,
} from '../../lib/googleCalendarAuth';
import {
  deviceCalendarProvider,
  listDeviceCalendars,
  type ConnectedCalendar,
} from '../../lib/device-calendar';
import { colors, typography, spacing } from '../../theme';

type Icon = keyof typeof Ionicons.glyphMap;
function providerInfo(provider: string): {
  name: string;
  icon: Icon;
  detail: string;
} {
  if (provider === 'google')
    return {
      name: 'Google Calendar',
      icon: 'logo-google',
      detail: 'Connect directly · Personal, work & shared calendars',
    };
  if (provider === 'apple')
    return {
      name: 'Calendar feed',
      icon: 'link-outline',
      detail: 'A secure iCal or webcal subscription',
    };
  return {
    name:
      Platform.OS === 'ios' ? 'Apple & device calendars' : 'Device calendars',
    icon: 'calendar-outline',
    detail: 'iCloud, Outlook & accounts on this device',
  };
}
function lastSynced(value: string | null) {
  if (!value) return 'Waiting for first sync';
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - +new Date(value)) / 60000),
  );
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  return `Updated ${new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
}
function Action({
  label,
  onPress,
  busy = false,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || disabled, busy }}
      disabled={busy || disabled}
      onPress={onPress}
      style={[
        s.action,
        secondary && s.secondary,
        (busy || disabled) && s.disabled,
      ]}
    >
      {busy && (
        <ActivityIndicator
          size="small"
          color={secondary ? colors.foreground : colors.white}
        />
      )}
      <Text style={[s.actionText, secondary && s.secondaryText]}>{label}</Text>
    </TouchableOpacity>
  );
}
export function CalendarSyncSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const query = useConnectedCalendars(visible);
  const actions = useCalendarActions();
  const [device, setDevice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [deviceCalendars, setDeviceCalendars] = useState<ConnectedCalendar[]>(
    [],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [automatic, setAutomatic] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const available = useAvailableCalendars(editing);
  const connections = query.data?.connections ?? [];
  const busy =
    actions.save.isPending ||
    actions.sync.isPending ||
    actions.disconnect.isPending ||
    actions.feed.isPending ||
    !!connecting;

  useEffect(() => {
    void deviceCalendarProvider().then(setDevice);
  }, []);
  useEffect(() => {
    if (!visible) {
      setEditing(null);
      setError(null);
      setFeedOpen(false);
      setFeedUrl('');
    }
  }, [visible]);
  const fail = (cause: unknown) => {
    const e = cause as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    setError(
      e.response?.data?.message ??
        e.message ??
        'Something went wrong. Please try again.',
    );
  };
  const openCalendars = async (provider: string) => {
    setError(null);
    const existing = connections.find((c) => c.provider === provider);
    setSelected(existing?.settings.calendarIds ?? []);
    setAutomatic(existing?.settings.automatic ?? true);
    setEditing(provider);
    if (provider.startsWith('device:')) {
      setDeviceCalendars([]);
      setConnecting(provider);
      try {
        setDeviceCalendars(await listDeviceCalendars(true));
      } catch (e) {
        fail(e);
      } finally {
        setConnecting(null);
      }
    }
  };
  const connect = async (provider: 'google') => {
    if (busy) return;
    setError(null);
    setConnecting(provider);
    try {
      const result = await connectGoogleCalendar({
        apiBaseUrl: API_BASE_URL,
        getMobileToken: () =>
          api
            .get<{ token: string }>('/api/calendar/google/mobile-token')
            .then((r) => r.data.token),
        openAuthSession: WebBrowser.openAuthSessionAsync,
        verifyConnection: () =>
          api
            .get<{ google: { connected: boolean } }>(
              '/api/calendar/connections',
            )
            .then((r) => r.data.google.connected),
      });
      if (result.status === 'cancelled') return;
      if (result.status === 'failed')
        throw new Error(
          GOOGLE_CALENDAR_ERROR_MESSAGES[result.code] ??
            GOOGLE_CALENDAR_ERROR_MESSAGES.unknown,
        );
      await query.refetch();
      setSelected([]);
      setAutomatic(true);
      setEditing(provider);
    } catch (e) {
      fail(e);
    } finally {
      setConnecting(null);
    }
  };
  const saveCalendars = async () => {
    if (!editing || busy) return;
    setError(null);
    try {
      const settings = {
        calendarIds: selected,
        automatic,
        ...(editing.startsWith('device:')
          ? { calendars: deviceCalendars }
          : {}),
      };
      await actions.save.mutateAsync({ provider: editing, ...settings });
      if (selected.length)
        await actions.sync.mutateAsync({
          provider: editing,
          settings,
          last_synced_at: null,
          last_error: null,
        });
      setEditing(null);
    } catch (e) {
      fail(e);
    }
  };
  const syncNow = async (connection: CalendarConnection) => {
    setError(null);
    try {
      await actions.sync.mutateAsync(connection);
    } catch (e) {
      fail(e);
    }
  };
  const disconnect = (connection: CalendarConnection) =>
    Alert.alert(
      'Disconnect calendar?',
      'Your imported events and outfit plans stay in Styled. The source calendar will not change.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            setError(null);
            actions.disconnect.mutate(connection.provider, { onError: fail });
          },
        },
      ],
    );
  const addFeed = async () => {
    if (!feedUrl.trim() || busy) return;
    setError(null);
    try {
      const url = new URL(feedUrl.trim().replace(/^webcal:\/\//i, 'https://'));
      if (url.protocol !== 'https:') throw new Error('invalid-feed-url');
    } catch {
      setError('Enter a complete https:// or webcal:// calendar link.');
      return;
    }
    try {
      await actions.feed.mutateAsync(feedUrl.trim());
      await actions.sync.mutateAsync({
        provider: 'apple',
        settings: { calendarIds: ['feed'], automatic: true },
        last_synced_at: null,
        last_error: null,
      });
      setFeedOpen(false);
      setFeedUrl('');
    } catch (e) {
      fail(e);
    }
  };
  const calendars = editing?.startsWith('device:')
    ? deviceCalendars
    : (available.data ?? []);
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
  // The Google primary alias is used by legacy imports. Resolve it to the
  // visible primary row while maintaining its identity during upgrade.
  const calendarId = (c: ConnectedCalendar) =>
    editing === 'google' && c.primary ? 'primary' : c.id;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.root}
      >
        <View style={s.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              editing || feedOpen ? 'Back' : 'Close calendar sync'
            }
            disabled={busy}
            onPress={() => {
              setError(null);
              if (editing) setEditing(null);
              else if (feedOpen) setFeedOpen(false);
              else onClose();
            }}
            style={s.headerButton}
          >
            <Ionicons
              name={editing || feedOpen ? 'chevron-back' : 'close'}
              size={22}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {editing
              ? 'Choose calendars'
              : feedOpen
                ? 'Add a calendar feed'
                : 'Calendars & sync'}
          </Text>
          <View style={s.headerButton} />
        </View>
        <ScrollView
          contentContainerStyle={[
            s.content,
            { paddingBottom: Math.max(insets.bottom, 24) + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          key={editing ?? (feedOpen ? 'feed' : 'connections')}
          contentInsetAdjustmentBehavior="automatic"
        >
          {error && (
            <View accessibilityRole="alert" style={s.error}>
              <Text selectable style={s.errorText}>
                {error}
              </Text>
              {error.includes('device settings') && (
                <Action
                  secondary
                  label="Open settings"
                  onPress={() => {
                    void Linking.openSettings();
                  }}
                />
              )}
            </View>
          )}
          {editing ? (
            <>
              <Text style={s.eyebrow}>{providerInfo(editing).name}</Text>
              <Text style={s.title}>Make room for your plans.</Text>
              <Text style={s.body}>
                Choose the calendars Styled follows. Events from the past 30
                days and the next year stay up to date, with your outfit plans
                kept intact.
              </Text>
              {connecting === editing || (!editing.startsWith('device:') && available.isPending) ? (
                <ActivityIndicator color={colors.primary} style={s.loader} />
              ) : editing.startsWith('device:') && error ? (
                <Action
                  label="Try again"
                  onPress={() => { void openCalendars(editing); }}
                />
              ) : !editing.startsWith('device:') && available.isError && !available.data ? (
                <View style={s.card}>
                  <Text style={s.body}>Could not load your calendars.</Text>
                  <Action
                    label="Try again"
                    onPress={() => {
                      void available.refetch();
                    }}
                  />
                </View>
              ) : (
                <View style={s.card}>
                  {calendars.length === 0 ? (
                    <Text style={s.body}>
                      {editing.startsWith('device:')
                        ? 'No calendars found. Add an account in your device calendar settings, then try again.'
                        : 'No calendars found in this account. Check your account or reconnect from Calendars & sync.'}
                    </Text>
                  ) : (
                    calendars.map((c) => {
                      const id = calendarId(c),
                        checked = selected.includes(id);
                      return (
                        <TouchableOpacity
                          key={c.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked }}
                          onPress={() => toggle(id)}
                          disabled={busy}
                          style={s.calendarRow}
                        >
                          <View
                            style={[
                              s.dot,
                              { backgroundColor: c.color || colors.accentInk },
                            ]}
                          />
                          <Text
                            style={[s.calendarName, checked && s.selectedName]}
                          >
                            {c.name}
                          </Text>
                          <Ionicons
                            name={
                              checked ? 'checkmark-circle' : 'ellipse-outline'
                            }
                            size={24}
                            color={
                              checked ? colors.primary : colors.controlOutline
                            }
                          />
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
              {calendars.length === 0 && !error && connecting !== editing && (editing.startsWith('device:') || !available.isPending) && (
                <Action secondary label="Refresh calendars" onPress={() => {
                  if (editing.startsWith('device:')) void openCalendars(editing);
                  else void available.refetch();
                }} disabled={busy} />
              )}
              <View style={s.card}>
                <Host matchContents>
                  <Switch
                    label="Keep calendars up to date"
                    value={automatic}
                    onValueChange={setAutomatic}
                    disabled={busy}
                  />
                </Host>
                <Text style={s.caption}>
                  Cloud calendars update periodically. Device calendars refresh
                  while Styled is open and when you return.
                </Text>
              </View>
              <Text style={s.caption}>
                Choose each calendar once. If you connect Google directly,
                leave the same calendars off in device calendars to avoid
                duplicates.
              </Text>
              <Action
                label={
                  selected.length
                    ? `Sync ${selected.length} calendar${selected.length === 1 ? '' : 's'}`
                    : 'Save without syncing'
                }
                onPress={() => {
                  void saveCalendars();
                }}
                busy={actions.save.isPending || actions.sync.isPending}
                disabled={busy || (editing.startsWith('device:') ? !!error : !available.data)}
              />
            </>
          ) : feedOpen ? (
            <>
              <Text style={s.eyebrow}>Calendar subscription</Text>
              <Text style={s.title}>A link to what’s next.</Text>
              <Text style={s.body}>
                Paste a secure iCal or webcal feed. For private Apple calendars,
                connect device calendars instead.
              </Text>
              <TextInput
                accessibilityLabel="Calendar feed URL"
                value={feedUrl}
                onChangeText={setFeedUrl}
                style={s.input}
                placeholder="webcal:// or https://"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
              />
              <Text style={s.caption}>
                The feed must be accessible to Styled without a sign-in. Treat
                its link as private.
              </Text>
              <Action
                label="Connect & sync feed"
                onPress={() => {
                  void addFeed();
                }}
                busy={actions.feed.isPending || actions.sync.isPending}
                disabled={!feedUrl.trim()}
              />
            </>
          ) : (
            <>
              {query.isPending ? (
                <ActivityIndicator color={colors.primary} style={s.loader} />
              ) : query.isError && !query.data ? (
                <View style={s.card}>
                  <Text style={s.body}>
                    Could not load your calendar connections.
                  </Text>
                  <Action
                    label="Try again"
                    onPress={() => {
                      void query.refetch();
                    }}
                  />
                </View>
              ) : (
                <>
                  {connections.length === 0 ? (
                    <>
                      <Text style={s.title}>Your plans, beautifully in sync.</Text>
                      <Text style={s.body}>
                        Connect a calendar to plan a look for what’s next.
                      </Text>
                      <View style={s.promise}>
                        <Ionicons name="lock-closed-outline" size={17} color={colors.accentInk} />
                        <Text style={s.promiseText}>Styled only reads. Your source calendars stay yours.</Text>
                      </View>
                    </>
                  ) : (
                    <Text accessibilityRole="header" style={s.sectionLabel}>CONNECTED CALENDARS</Text>
                  )}
                  {connections.map((connection) => {
                    const info = providerInfo(connection.provider),
                      otherDevice =
                        connection.provider.startsWith('device:') &&
                        connection.provider !== device;
                    const syncing =
                      actions.sync.isPending &&
                      actions.sync.variables?.provider === connection.provider;
                    return (
                      <View key={connection.provider} style={s.card}>
                        <View style={s.providerRow}>
                          <View style={s.providerIcon}>
                            <Ionicons
                              name={info.icon}
                              size={22}
                              color={colors.foreground}
                            />
                          </View>
                          <View style={s.grow}>
                            <Text style={s.providerName}>
                              {otherDevice ? 'Another device' : info.name}
                            </Text>
                            <Text style={s.caption}>
                              {connection.settings.calendarIds.length} calendar
                              {connection.settings.calendarIds.length === 1
                                ? ''
                                : 's'}{' '}
                              ·{' '}
                              {connection.settings.automatic
                                ? 'Automatic'
                                : 'Manual'}
                            </Text>
                          </View>
                        </View>
                        <View style={s.status}>
                          <View
                            style={[
                              s.statusDot,
                              {
                                backgroundColor: connection.last_error
                                  ? colors.error
                                  : colors.success,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              s.caption,
                              connection.last_error && s.errorText,
                            ]}
                          >
                            {syncing
                              ? 'Updating your plans…'
                              : (connection.last_error ??
                                (connection.settings.calendarIds.length ? lastSynced(connection.last_synced_at) : 'Choose calendars to begin'))}
                          </Text>
                        </View>
                        {otherDevice ? (
                          <Text style={s.caption}>
                            Manage and sync this connection on the device where
                            you added it.
                          </Text>
                        ) : (
                          <View style={s.actions}>
                            <View style={s.grow}>
                              <Action
                                secondary
                                label="Choose calendars"
                                onPress={() => {
                                  void openCalendars(connection.provider);
                                }}
                                disabled={busy}
                              />
                            </View>
                            <View style={s.grow}>
                              <Action
                                label="Sync now"
                                onPress={() => {
                                  void syncNow(connection);
                                }}
                                busy={syncing}
                                disabled={
                                  busy ||
                                  !connection.settings.calendarIds.length
                                }
                              />
                            </View>
                          </View>
                        )}
                        {!!connection.last_error &&
                          connection.provider === 'google' && (
                            <Action
                              secondary
                              label="Reconnect account"
                              onPress={() => {
                                void connect('google');
                              }}
                              disabled={busy}
                            />
                          )}
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => disconnect(connection)}
                          disabled={busy}
                          style={s.disconnect}
                        >
                          <Text style={s.disconnectText}>Disconnect</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  {connections.length > 0 && (
                    <Text style={s.caption}>Read-only connections. Your source calendars stay unchanged.</Text>
                  )}
                  <Text accessibilityRole="header" style={s.sectionLabel}>ADD A CALENDAR</Text>
                  <Text style={s.caption}>
                    Connect Google directly, or use accounts already on your device, including Outlook. Choose each calendar once to avoid duplicates.
                  </Text>
                  {(['device', 'google'] as const)
                    .filter((p) =>
                      p === 'device'
                        ? Platform.OS !== 'web' &&
                          !!device &&
                          !connections.some((c) => c.provider === device)
                        : !connections.some((c) => c.provider === p),
                    )
                    .map((provider) => {
                      const info = providerInfo(provider);
                      return (
                        <TouchableOpacity
                          key={provider}
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() => {
                            if (provider === 'device') {
                              if (device) void openCalendars(device);
                            } else void connect(provider);
                          }}
                          style={s.addRow}
                        >
                          <View style={s.providerIcon}>
                            <Ionicons
                              name={info.icon}
                              size={22}
                              color={colors.foreground}
                            />
                          </View>
                          <View style={s.grow}>
                            <Text style={s.providerName}>{info.name}</Text>
                            <Text style={s.caption}>
                              {info.detail}
                            </Text>
                          </View>
                          {connecting === (provider === 'device' ? device : provider) ? (
                            <ActivityIndicator color={colors.primary} />
                          ) : (
                            <Ionicons
                              name="add"
                              size={22}
                              color={colors.foreground}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  {!connections.some((c) => c.provider === 'apple') && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => setFeedOpen(true)}
                      disabled={busy}
                      style={s.feedLink}
                    >
                      <Ionicons
                        name="link-outline"
                        size={17}
                        color={colors.mutedForeground}
                      />
                      <Text style={s.disconnectText}>
                        Add an iCal / webcal feed
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={15}
                        color={colors.mutedForeground}
                      />
                    </TouchableOpacity>
                  )}
                  <Text style={s.footnote}>
                    Changes and cancellations follow the source calendar. Outfit
                    selections stay in Styled. Disconnecting keeps your imported
                    plans.
                  </Text>
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.text.body, fontWeight: '600' },
  content: { padding: spacing.lg, gap: spacing.lg },
  eyebrow: { ...typography.text.meta, color: colors.accentInk },
  title: {
    ...typography.text.editorialTitle,
    fontSize: 38,
    lineHeight: 43,
    color: colors.foreground,
  },
  body: {
    ...typography.text.body,
    color: colors.mutedForeground,
    lineHeight: 23,
  },
  caption: {
    ...typography.text.caption,
    color: colors.mutedForeground,
    lineHeight: 19,
  },
  promise: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  promiseText: {
    ...typography.text.caption,
    color: colors.accentInk,
    flex: 1,
    lineHeight: 19,
  },
  sectionLabel: {
    ...typography.text.meta,
    color: colors.mutedForeground,
    letterSpacing: 1.5,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  providerIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    ...typography.text.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  grow: { flex: 1, gap: 4 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', gap: 10 },
  action: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionText: {
    ...typography.text.body,
    fontSize: 14,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  secondary: { backgroundColor: colors.surfaceSubtle },
  secondaryText: { color: colors.foreground },
  disabled: { opacity: 0.45 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 78,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  disconnect: { alignSelf: 'flex-start', paddingVertical: 12, minHeight: 44 },
  disconnectText: { ...typography.text.caption, color: colors.mutedForeground },
  feedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    minHeight: 44,
  },
  footnote: {
    ...typography.text.caption,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  calendarName: {
    ...typography.text.body,
    flex: 1,
    color: colors.mutedForeground,
  },
  selectedName: { color: colors.foreground },
  error: {
    backgroundColor: colors.surfaceSelected,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  errorText: {
    ...typography.text.caption,
    color: colors.error,
    lineHeight: 20,
    flexShrink: 1,
  },
  loader: { padding: 24 },
  input: {
    ...typography.text.body,
    color: colors.foreground,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 54,
  },
});
