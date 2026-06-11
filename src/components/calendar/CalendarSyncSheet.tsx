import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCalendarConnections,
  useGoogleCalendarPreview,
  useAppleCalendarPreview,
  useImportGoogleCalendarEvents,
  useImportAppleCalendarEvents,
  useDisconnectGoogleCalendar,
  useConnectAppleCalendar,
  useDisconnectAppleCalendar,
  CALENDAR_CONNECTIONS_KEY,
  type CalendarPreviewEvent,
} from '../../hooks/useCalendarSync';
import { api, API_BASE_URL } from '../../lib/api';
import { colors, spacing, typography, radii } from '../../theme';

const GREEN = '#22c55e';

// ── Preview event list ─────────────────────────────────────────────────────────

function PreviewList({
  events,
  selected,
  onToggle,
}: {
  events: CalendarPreviewEvent[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const limited = events.slice(0, 100);
  return (
    <>
      {limited.map((ev) => {
        const isSel = selected.has(ev.externalId);
        const d = new Date(ev.date);
        return (
          <TouchableOpacity
            key={ev.externalId}
            style={[s.evRow, isSel && s.evRowSel]}
            onPress={() => onToggle(ev.externalId)}
            activeOpacity={0.7}
          >
            <View style={[s.evCheck, isSel && s.evCheckSel]}>
              {isSel && <Ionicons name="checkmark" size={12} color={colors.white} />}
            </View>
            <View style={s.evBody}>
              <Text style={s.evTitle} numberOfLines={1}>{ev.title}</Text>
              <Text style={s.evMeta}>
                {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' · '}
                {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </Text>
            </View>
            {ev.alreadyImported && (
              <View style={s.syncedBadge}>
                <Text style={s.syncedText}>Synced</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      {events.length > 100 && (
        <Text style={s.limitNote}>Showing first 100 of {events.length} events</Text>
      )}
    </>
  );
}

// ── Main sheet ─────────────────────────────────────────────────────────────────

export function CalendarSyncSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const [googlePreviewEnabled, setGooglePreviewEnabled] = useState(false);
  const [applePreviewEnabled, setApplePreviewEnabled] = useState(false);
  const [googleSelected, setGoogleSelected] = useState(new Set<string>());
  const [appleSelected, setAppleSelected] = useState(new Set<string>());
  const [appleUrlInput, setAppleUrlInput] = useState('');
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const connections = useCalendarConnections();
  const googleConnected = connections.data?.google.connected ?? false;
  const appleConnected = connections.data?.apple.connected ?? false;

  const googlePreview = useGoogleCalendarPreview(googlePreviewEnabled && googleConnected);
  const applePreview = useAppleCalendarPreview(applePreviewEnabled && appleConnected);
  const importGoogle = useImportGoogleCalendarEvents();
  const importApple = useImportAppleCalendarEvents();
  const disconnectGoogle = useDisconnectGoogleCalendar();
  const connectApple = useConnectAppleCalendar();
  const disconnectApple = useDisconnectAppleCalendar();

  // Auto-select newly imported events when preview loads
  useEffect(() => {
    if (googlePreview.data) {
      setGoogleSelected(
        new Set(googlePreview.data.filter((e) => !e.alreadyImported).map((e) => e.externalId)),
      );
    }
  }, [googlePreview.data]);

  useEffect(() => {
    if (applePreview.data) {
      setAppleSelected(
        new Set(applePreview.data.filter((e) => !e.alreadyImported).map((e) => e.externalId)),
      );
    }
  }, [applePreview.data]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!visible) {
      setGooglePreviewEnabled(false);
      setApplePreviewEnabled(false);
      setGoogleSelected(new Set());
      setAppleSelected(new Set());
      setAppleUrlInput('');
      setConnectingGoogle(false);
    }
  }, [visible]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const { data } = await api.get<{ token: string }>('/api/calendar/google/mobile-token');
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_BASE_URL}/api/calendar/google/mobile-connect?token=${data.token}`,
        'styled://',
      );
      if (result.type === 'success') {
        const url = result.url;
        if (url.includes('cal_connected=google')) {
          qc.invalidateQueries({ queryKey: CALENDAR_CONNECTIONS_KEY });
        } else {
          const errorCode = url.match(/cal_error=([^&]+)/)?.[1] ?? 'unknown';
          const messages: Record<string, string> = {
            access_denied: 'You denied access to Google Calendar.',
            not_configured: 'Google Calendar is not configured on this server.',
            state_mismatch: 'The connection attempt expired. Please try again.',
          };
          Alert.alert('Connection Failed', messages[errorCode] ?? 'Could not connect Google Calendar. Please try again.');
        }
      }
    } catch {
      Alert.alert('Error', 'Could not start Google Calendar connection. Please try again.');
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = () => {
    Alert.alert(
      'Disconnect Google Calendar',
      'This will remove the connection. Imported events will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () =>
            disconnectGoogle.mutate(undefined, {
              onSuccess: () => {
                setGooglePreviewEnabled(false);
                setGoogleSelected(new Set());
              },
              onError: () => Alert.alert('Error', 'Could not disconnect. Please try again.'),
            }),
        },
      ],
    );
  };

  const handleConnectApple = () => {
    const url = appleUrlInput.trim();
    if (!url) {
      Alert.alert('URL Required', 'Please enter your iCal or webcal URL.');
      return;
    }
    connectApple.mutate(url, {
      onSuccess: () => setAppleUrlInput(''),
      onError: (err: any) => {
        const msg =
          err?.response?.data?.message ??
          'Could not connect. Make sure the URL is a valid iCal / webcal link.';
        Alert.alert('Connection Failed', msg);
      },
    });
  };

  const handleDisconnectApple = () => {
    Alert.alert(
      'Disconnect Apple Calendar',
      'This will remove the iCal feed connection. Imported events will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () =>
            disconnectApple.mutate(undefined, {
              onSuccess: () => {
                setApplePreviewEnabled(false);
                setAppleSelected(new Set());
              },
              onError: () => Alert.alert('Error', 'Could not disconnect. Please try again.'),
            }),
        },
      ],
    );
  };

  const handleImportGoogle = () => {
    const ids = Array.from(googleSelected);
    if (ids.length === 0) {
      Alert.alert('No Events Selected', 'Select at least one event to import.');
      return;
    }
    importGoogle.mutate(ids, {
      onSuccess: (result) => {
        Alert.alert(
          'Imported!',
          `${result.created} new event${result.created !== 1 ? 's' : ''} added, ${result.updated} updated.`,
        );
        setGooglePreviewEnabled(false);
        setGoogleSelected(new Set());
      },
      onError: () => Alert.alert('Import Failed', 'Could not import events. Please try again.'),
    });
  };

  const handleImportApple = () => {
    const ids = Array.from(appleSelected);
    if (ids.length === 0) {
      Alert.alert('No Events Selected', 'Select at least one event to import.');
      return;
    }
    importApple.mutate(ids, {
      onSuccess: (result) => {
        Alert.alert(
          'Imported!',
          `${result.created} new event${result.created !== 1 ? 's' : ''} added, ${result.updated} updated.`,
        );
        setApplePreviewEnabled(false);
        setAppleSelected(new Set());
      },
      onError: () => Alert.alert('Import Failed', 'Could not import events. Please try again.'),
    });
  };

  const toggleGoogle = (id: string) =>
    setGoogleSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleApple = (id: string) =>
    setAppleSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={s.root}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerSide} />
            <Text style={s.headerTitle}>Calendar Sync</Text>
            <TouchableOpacity onPress={onClose} style={[s.headerSide, { alignItems: 'flex-end' }]}>
              <Text style={s.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Google Calendar ────────────────────────────────────────── */}
            <View style={s.card}>
              <View style={s.providerRow}>
                <View style={[s.providerIcon, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="logo-google" size={20} color="#4285F4" />
                </View>
                <View style={s.providerText}>
                  <Text style={s.providerName}>Google Calendar</Text>
                  <Text style={s.providerDesc}>
                    {googleConnected ? 'Connected' : 'Import events from Google Calendar'}
                  </Text>
                </View>
                {googleConnected && (
                  <Ionicons name="checkmark-circle" size={20} color={GREEN} />
                )}
              </View>

              {connections.isLoading ? (
                <ActivityIndicator color={colors.primary} style={s.loader} />
              ) : !googleConnected ? (
                <TouchableOpacity
                  style={[s.primaryBtn, connectingGoogle && s.primaryBtnDisabled]}
                  onPress={handleConnectGoogle}
                  disabled={connectingGoogle}
                  activeOpacity={0.85}
                >
                  {connectingGoogle ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Ionicons name="logo-google" size={15} color={colors.white} />
                  )}
                  <Text style={s.primaryBtnText}>
                    {connectingGoogle ? 'Connecting…' : 'Connect Google Calendar'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={s.actionRow}>
                    <TouchableOpacity
                      style={s.syncBtn}
                      onPress={() => {
                        if (googlePreviewEnabled) {
                          qc.invalidateQueries({ queryKey: ['/api/calendar/google/preview'] });
                        } else {
                          setGooglePreviewEnabled(true);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="refresh-outline" size={15} color={colors.primary} />
                      <Text style={s.syncBtnText}>Sync Events</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.disconnectBtn}
                      onPress={handleDisconnectGoogle}
                      disabled={disconnectGoogle.isPending}
                      activeOpacity={0.8}
                    >
                      {disconnectGoogle.isPending ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <Text style={s.disconnectText}>Disconnect</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {googlePreviewEnabled && (
                    <View style={s.previewSection}>
                      {googlePreview.isLoading && (
                        <ActivityIndicator color={colors.primary} style={s.loader} />
                      )}
                      {googlePreview.isError && (
                        <Text style={s.errorText}>
                          {(googlePreview.error as any)?.response?.data?.message ??
                            'Could not load events. Please try again.'}
                        </Text>
                      )}
                      {googlePreview.data && (
                        <>
                          <View style={s.previewHeader}>
                            <Text style={s.previewCount}>
                              {googlePreview.data.length} upcoming event
                              {googlePreview.data.length !== 1 ? 's' : ''}
                            </Text>
                            <TouchableOpacity
                              onPress={() =>
                                setGoogleSelected(
                                  new Set(
                                    googlePreview.data!
                                      .filter((e) => !e.alreadyImported)
                                      .map((e) => e.externalId),
                                  ),
                                )
                              }
                            >
                              <Text style={s.selectNewText}>Select New</Text>
                            </TouchableOpacity>
                          </View>

                          <PreviewList
                            events={googlePreview.data}
                            selected={googleSelected}
                            onToggle={toggleGoogle}
                          />

                          {googleSelected.size > 0 && (
                            <TouchableOpacity
                              style={[s.importBtn, importGoogle.isPending && s.importBtnDisabled]}
                              onPress={handleImportGoogle}
                              disabled={importGoogle.isPending}
                              activeOpacity={0.85}
                            >
                              {importGoogle.isPending ? (
                                <ActivityIndicator size="small" color={colors.white} />
                              ) : (
                                <Ionicons name="download-outline" size={15} color={colors.white} />
                              )}
                              <Text style={s.importBtnText}>
                                {importGoogle.isPending
                                  ? 'Importing…'
                                  : `Import ${googleSelected.size} Event${googleSelected.size !== 1 ? 's' : ''}`}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* ── Apple Calendar ─────────────────────────────────────────── */}
            <View style={s.card}>
              <View style={s.providerRow}>
                <View style={[s.providerIcon, { backgroundColor: colors.muted }]}>
                  <Ionicons name="logo-apple" size={20} color={colors.foreground} />
                </View>
                <View style={s.providerText}>
                  <Text style={s.providerName}>Apple Calendar</Text>
                  <Text style={s.providerDesc}>
                    {appleConnected ? 'Connected via iCal feed' : 'Connect via iCal / webcal URL'}
                  </Text>
                </View>
                {appleConnected && (
                  <Ionicons name="checkmark-circle" size={20} color={GREEN} />
                )}
              </View>

              {connections.isLoading ? (
                <ActivityIndicator color={colors.primary} style={s.loader} />
              ) : !appleConnected ? (
                <View style={s.appleForm}>
                  <TextInput
                    style={s.urlInput}
                    value={appleUrlInput}
                    onChangeText={setAppleUrlInput}
                    placeholder="webcal:// or https:// iCal URL"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="done"
                    onSubmitEditing={handleConnectApple}
                  />
                  <TouchableOpacity
                    style={[s.primaryBtn, connectApple.isPending && s.primaryBtnDisabled]}
                    onPress={handleConnectApple}
                    disabled={connectApple.isPending}
                    activeOpacity={0.85}
                  >
                    {connectApple.isPending ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Ionicons name="link-outline" size={15} color={colors.white} />
                    )}
                    <Text style={s.primaryBtnText}>
                      {connectApple.isPending ? 'Connecting…' : 'Connect Apple Calendar'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={s.hint}>
                    In Calendar.app → right-click a calendar → Share → Copy Link, or File → Export
                  </Text>
                </View>
              ) : (
                <>
                  <View style={s.actionRow}>
                    <TouchableOpacity
                      style={s.syncBtn}
                      onPress={() => {
                        if (applePreviewEnabled) {
                          qc.invalidateQueries({ queryKey: ['/api/calendar/apple/preview'] });
                        } else {
                          setApplePreviewEnabled(true);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="refresh-outline" size={15} color={colors.primary} />
                      <Text style={s.syncBtnText}>Sync Events</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.disconnectBtn}
                      onPress={handleDisconnectApple}
                      disabled={disconnectApple.isPending}
                      activeOpacity={0.8}
                    >
                      {disconnectApple.isPending ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <Text style={s.disconnectText}>Disconnect</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {applePreviewEnabled && (
                    <View style={s.previewSection}>
                      {applePreview.isLoading && (
                        <ActivityIndicator color={colors.primary} style={s.loader} />
                      )}
                      {applePreview.isError && (
                        <Text style={s.errorText}>
                          {(applePreview.error as any)?.response?.data?.message ??
                            'Could not load events. Please try again.'}
                        </Text>
                      )}
                      {applePreview.data && (
                        <>
                          <View style={s.previewHeader}>
                            <Text style={s.previewCount}>
                              {applePreview.data.length} upcoming event
                              {applePreview.data.length !== 1 ? 's' : ''}
                            </Text>
                            <TouchableOpacity
                              onPress={() =>
                                setAppleSelected(
                                  new Set(
                                    applePreview.data!
                                      .filter((e) => !e.alreadyImported)
                                      .map((e) => e.externalId),
                                  ),
                                )
                              }
                            >
                              <Text style={s.selectNewText}>Select New</Text>
                            </TouchableOpacity>
                          </View>

                          <PreviewList
                            events={applePreview.data}
                            selected={appleSelected}
                            onToggle={toggleApple}
                          />

                          {appleSelected.size > 0 && (
                            <TouchableOpacity
                              style={[s.importBtn, importApple.isPending && s.importBtnDisabled]}
                              onPress={handleImportApple}
                              disabled={importApple.isPending}
                              activeOpacity={0.85}
                            >
                              {importApple.isPending ? (
                                <ActivityIndicator size="small" color={colors.white} />
                              ) : (
                                <Ionicons name="download-outline" size={15} color={colors.white} />
                              )}
                              <Text style={s.importBtnText}>
                                {importApple.isPending
                                  ? 'Importing…'
                                  : `Import ${appleSelected.size} Event${appleSelected.size !== 1 ? 's' : ''}`}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>

            <Text style={s.footerNote}>
              Imported events appear on your Calendar. Each event can have an AI outfit suggestion added to it.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSide: { minWidth: 60 },
  headerTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  doneText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },

  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },

  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerText: { flex: 1, gap: 2 },
  providerName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  providerDesc: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },

  loader: { marginVertical: spacing.md },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },

  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  syncBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}12`,
  },
  syncBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
  disconnectBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.error,
  },

  appleForm: { gap: spacing.sm },
  urlInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
  hint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    lineHeight: typography.size.xs * 1.5,
  },

  previewSection: { gap: spacing.sm },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  previewCount: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selectNewText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },

  evRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  evRowSel: { backgroundColor: `${colors.primary}06` },
  evCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  evCheckSel: { borderColor: colors.primary, backgroundColor: colors.primary },
  evBody: { flex: 1, gap: 2 },
  evTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  evMeta: { fontSize: typography.size.xs, color: colors.mutedForeground },
  syncedBadge: {
    backgroundColor: colors.muted,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  syncedText: { fontSize: 10, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  limitNote: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
  },
  importBtnDisabled: { opacity: 0.65 },
  importBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },

  errorText: {
    fontSize: typography.size.sm,
    color: colors.error,
    lineHeight: typography.size.sm * 1.5,
  },

  footerNote: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: typography.size.xs * 1.6,
    paddingHorizontal: spacing.md,
  },
});
