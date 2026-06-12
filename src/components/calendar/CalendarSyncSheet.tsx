import {
  View,
  Text,
  Modal,
  ScrollView,
  SectionList,
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
import { useEffect, useMemo, useState } from 'react';
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
import { track } from '../../lib/analytics';
import {
  connectGoogleCalendar,
  GOOGLE_CALENDAR_ERROR_MESSAGES,
} from '../../lib/googleCalendarAuth';
import { colors, spacing, typography, radii } from '../../theme';
import {
  createDefaultSelection,
  groupPreviewEventsByDate,
  partitionPreviewEvents,
} from './calendarSyncUtils';

const GREEN = '#22c55e';
type Provider = 'google' | 'apple';

function SheetHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <View style={s.header}>
      <View style={s.headerSide}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={s.headerAction} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={s.headerActionText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.headerTitle}>{title}</Text>
      <TouchableOpacity onPress={onClose} style={[s.headerSide, s.headerSideRight]}>
        <Text style={s.doneText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

function ProviderIcon({ provider }: { provider: Provider }) {
  return (
    <View
      style={[
        s.providerIcon,
        { backgroundColor: provider === 'google' ? '#EEF2FF' : colors.muted },
      ]}
    >
      <Ionicons
        name={provider === 'google' ? 'logo-google' : 'logo-apple'}
        size={20}
        color={provider === 'google' ? '#4285F4' : colors.foreground}
      />
    </View>
  );
}

function EventRow({
  event,
  selected,
  disabled,
  onToggle,
}: {
  event: CalendarPreviewEvent;
  selected: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  const date = new Date(event.date);
  return (
    <TouchableOpacity
      style={[s.eventRow, disabled && s.eventRowDisabled]}
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole={disabled ? undefined : 'checkbox'}
      accessibilityState={disabled ? undefined : { checked: selected }}
    >
      <View style={[s.eventCheck, selected && s.eventCheckSelected, disabled && s.eventCheckSynced]}>
        {selected && <Ionicons name="checkmark" size={13} color={colors.white} />}
        {disabled && <Ionicons name="checkmark" size={13} color={colors.mutedForeground} />}
      </View>
      <View style={s.eventBody}>
        <Text style={s.eventTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={s.eventMeta}>
          {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          {event.location ? ` · ${event.location}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function CalendarEventReview({
  provider,
  events,
  isLoading,
  isError,
  errorMessage,
  selected,
  isImporting,
  onToggle,
  onSelectAll,
  onClear,
  onRetry,
  onImport,
  onBack,
  onClose,
}: {
  provider: Provider;
  events?: CalendarPreviewEvent[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  selected: Set<string>;
  isImporting: boolean;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onRetry: () => void;
  onImport: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [syncedExpanded, setSyncedExpanded] = useState(false);
  const { newEvents, syncedEvents } = useMemo(
    () => partitionPreviewEvents(events ?? []),
    [events],
  );
  const sections = useMemo(
    () => [
      ...groupPreviewEventsByDate(newEvents).map((section) => ({ ...section, kind: 'new' as const })),
      ...(syncedExpanded
        ? [{ title: 'Previously synced', data: syncedEvents, kind: 'synced' as const }]
        : []),
    ],
    [newEvents, syncedEvents, syncedExpanded],
  );
  const providerName = provider === 'google' ? 'Google Calendar' : 'Apple Calendar';

  useEffect(() => {
    setSyncedExpanded(false);
  }, [provider]);

  return (
    <View style={s.root}>
      <SheetHeader title="Review Events" onBack={onBack} onClose={onClose} />
      {isLoading ? (
        <View style={s.centerState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.stateTitle}>Checking {providerName}</Text>
          <Text style={s.stateText}>Finding events that are ready to import.</Text>
        </View>
      ) : isError ? (
        <View style={s.centerState}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.mutedForeground} />
          <Text style={s.stateTitle}>Could not load events</Text>
          <Text style={s.stateText}>{errorMessage ?? 'Please try again.'}</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={onRetry}>
            <Text style={s.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.externalId}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.reviewContent}
            ListHeaderComponent={
              <View style={s.reviewIntro}>
                <View style={s.reviewProviderRow}>
                  <ProviderIcon provider={provider} />
                  <View style={s.providerText}>
                    <Text style={s.providerName}>{providerName}</Text>
                    <Text style={s.providerDesc}>
                      {selected.size} of {newEvents.length} new event{newEvents.length === 1 ? '' : 's'} selected
                    </Text>
                  </View>
                </View>
                {newEvents.length > 0 && (
                  <View style={s.selectionBar}>
                    <Text style={s.selectionTitle}>New events</Text>
                    <View style={s.selectionActions}>
                      <TouchableOpacity onPress={onSelectAll}>
                        <Text style={s.selectionActionText}>Select all</Text>
                      </TouchableOpacity>
                      <View style={s.actionDivider} />
                      <TouchableOpacity onPress={onClear}>
                        <Text style={s.selectionActionText}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              <View style={s.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={32} color={GREEN} />
                <Text style={s.stateTitle}>You’re all caught up</Text>
                <Text style={s.stateText}>There are no new events to import.</Text>
              </View>
            }
            renderSectionHeader={({ section }) => section.kind === 'synced' ? (
              <TouchableOpacity
                style={s.syncedListHeader}
                onPress={() => setSyncedExpanded(false)}
                activeOpacity={0.7}
              >
                <View>
                  <Text style={s.syncedTitle}>Previously synced</Text>
                  <Text style={s.syncedSubtitle}>
                    {syncedEvents.length} event{syncedEvents.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Ionicons name="chevron-up" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : (
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item, section }) => (
              <EventRow
                event={item}
                selected={selected.has(item.externalId)}
                disabled={section.kind === 'synced'}
                onToggle={section.kind === 'new' ? () => onToggle(item.externalId) : undefined}
              />
            )}
            ListFooterComponent={
              syncedEvents.length > 0 && !syncedExpanded ? (
                <View style={s.syncedSection}>
                  <TouchableOpacity
                    style={s.syncedHeader}
                    onPress={() => setSyncedExpanded((current) => !current)}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={s.syncedTitle}>Previously synced</Text>
                      <Text style={s.syncedSubtitle}>
                        {syncedEvents.length} event{syncedEvents.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Ionicons
                      name={syncedExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
          {newEvents.length > 0 && (
            <View style={s.stickyFooter}>
              <TouchableOpacity
                style={[s.importBtn, (selected.size === 0 || isImporting) && s.buttonDisabled]}
                onPress={onImport}
                disabled={selected.size === 0 || isImporting}
                activeOpacity={0.85}
              >
                {isImporting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="download-outline" size={16} color={colors.white} />
                )}
                <Text style={s.importBtnText}>
                  {isImporting
                    ? 'Importing…'
                    : `Import ${selected.size} event${selected.size === 1 ? '' : 's'}`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export function CalendarSyncSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reviewProvider, setReviewProvider] = useState<Provider | null>(null);
  const [googleSelected, setGoogleSelected] = useState(new Set<string>());
  const [appleSelected, setAppleSelected] = useState(new Set<string>());
  const [appleUrlInput, setAppleUrlInput] = useState('');
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const connections = useCalendarConnections();
  const googleConnected = connections.data?.google.connected ?? false;
  const appleConnected = connections.data?.apple.connected ?? false;
  const googlePreview = useGoogleCalendarPreview(reviewProvider === 'google' && googleConnected);
  const applePreview = useAppleCalendarPreview(reviewProvider === 'apple' && appleConnected);
  const importGoogle = useImportGoogleCalendarEvents();
  const importApple = useImportAppleCalendarEvents();
  const disconnectGoogle = useDisconnectGoogleCalendar();
  const connectApple = useConnectAppleCalendar();
  const disconnectApple = useDisconnectAppleCalendar();

  useEffect(() => {
    if (googlePreview.data) setGoogleSelected(createDefaultSelection(googlePreview.data));
  }, [googlePreview.data]);

  useEffect(() => {
    if (applePreview.data) setAppleSelected(createDefaultSelection(applePreview.data));
  }, [applePreview.data]);

  useEffect(() => {
    const errorData = (googlePreview.error as any)?.response?.data;
    if (!errorData?.reconnect) return;
    setReviewProvider(null);
    qc.invalidateQueries({ queryKey: CALENDAR_CONNECTIONS_KEY });
    Alert.alert(
      'Reconnect Google Calendar',
      errorData.message ?? 'Google Calendar access expired. Disconnect and reconnect your account.',
    );
  }, [googlePreview.error, qc]);

  useEffect(() => {
    if (!visible) {
      setReviewProvider(null);
      setGoogleSelected(new Set());
      setAppleSelected(new Set());
      setAppleUrlInput('');
      setConnectingGoogle(false);
    }
  }, [visible]);

  const closeAfterImport = (created: number, updated: number) => {
    onClose();
    Alert.alert(
      'Calendar updated',
      `${created} new event${created === 1 ? '' : 's'} added${updated ? `, ${updated} updated` : ''}.`,
    );
  };

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    track('calendar_google_connection_started');
    const result = await connectGoogleCalendar({
      apiBaseUrl: API_BASE_URL,
      getMobileToken: () =>
        api.get<{ token: string }>('/api/calendar/google/mobile-token').then(({ data }) => data.token),
      openAuthSession: WebBrowser.openAuthSessionAsync,
      verifyConnection: async () => {
        const refreshed = await connections.refetch();
        return refreshed.data?.google.connected === true;
      },
    });

    if (result.status === 'connected') {
      track('calendar_google_connection_succeeded');
      Alert.alert('Connected', 'Google Calendar is ready to sync.');
    } else if (result.status === 'cancelled') {
      track('calendar_google_connection_cancelled', { reason: result.reason });
    } else {
      track('calendar_google_connection_failed', { error_code: result.code });
      Alert.alert(
        'Connection Failed',
        GOOGLE_CALENDAR_ERROR_MESSAGES[result.code] ?? GOOGLE_CALENDAR_ERROR_MESSAGES.unknown,
      );
      if (result.code === 'session_expired') {
        await qc.invalidateQueries({ queryKey: CALENDAR_CONNECTIONS_KEY });
      }
    }
    setConnectingGoogle(false);
  };

  const disconnectProvider = (provider: Provider) => {
    const name = provider === 'google' ? 'Google Calendar' : 'Apple Calendar';
    const mutation = provider === 'google' ? disconnectGoogle : disconnectApple;
    Alert.alert(
      `Disconnect ${name}`,
      'This removes the connection. Imported events will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => mutation.mutate(undefined, {
            onSuccess: () => setReviewProvider(null),
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
      onError: (error: any) => Alert.alert(
        'Connection Failed',
        error?.response?.data?.message
          ?? 'Could not connect. Make sure the URL is a valid iCal / webcal link.',
      ),
    });
  };

  const toggleSelection = (provider: Provider, id: string) => {
    const setter = provider === 'google' ? setGoogleSelected : setAppleSelected;
    setter((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImport = (provider: Provider) => {
    const selected = provider === 'google' ? googleSelected : appleSelected;
    const mutation = provider === 'google' ? importGoogle : importApple;
    mutation.mutate(Array.from(selected), {
      onSuccess: (result) => closeAfterImport(result.created, result.updated),
      onError: (error: any) => {
        const errorData = error?.response?.data;
        if (provider === 'google' && errorData?.reconnect) {
          setReviewProvider(null);
          qc.invalidateQueries({ queryKey: CALENDAR_CONNECTIONS_KEY });
          Alert.alert(
            'Reconnect Google Calendar',
            errorData.message ?? 'Google Calendar access expired. Disconnect and reconnect your account.',
          );
          return;
        }
        Alert.alert('Import Failed', errorData?.message ?? 'Could not import events. Please try again.');
      },
    });
  };

  const reviewQuery = reviewProvider === 'google' ? googlePreview : applePreview;
  const reviewSelected = reviewProvider === 'google' ? googleSelected : appleSelected;
  const reviewEvents = reviewQuery.data ?? [];
  const newReviewEvents = partitionPreviewEvents(reviewEvents).newEvents;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        {reviewProvider ? (
          <CalendarEventReview
            provider={reviewProvider}
            events={reviewQuery.data}
            isLoading={reviewQuery.isLoading}
            isError={reviewQuery.isError}
            errorMessage={(reviewQuery.error as any)?.response?.data?.message}
            selected={reviewSelected}
            isImporting={reviewProvider === 'google' ? importGoogle.isPending : importApple.isPending}
            onToggle={(id) => toggleSelection(reviewProvider, id)}
            onSelectAll={() => {
              const setter = reviewProvider === 'google' ? setGoogleSelected : setAppleSelected;
              setter(new Set(newReviewEvents.map((event) => event.externalId)));
            }}
            onClear={() => {
              const setter = reviewProvider === 'google' ? setGoogleSelected : setAppleSelected;
              setter(new Set());
            }}
            onRetry={() => reviewQuery.refetch()}
            onImport={() => handleImport(reviewProvider)}
            onBack={() => setReviewProvider(null)}
            onClose={onClose}
          />
        ) : (
          <View style={s.root}>
            <SheetHeader title="Calendar Sync" onClose={onClose} />
            <ScrollView
              style={s.flex}
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.intro}>
                <Text style={s.introTitle}>Bring your plans into Styled</Text>
                <Text style={s.introText}>
                  Connect a calendar, then review only the new events you want to add.
                </Text>
              </View>

              <View style={s.card}>
                <View style={s.providerRow}>
                  <ProviderIcon provider="google" />
                  <View style={s.providerText}>
                    <Text style={s.providerName}>Google Calendar</Text>
                    <Text style={s.providerDesc}>
                      {googleConnected ? 'Connected and ready to review' : 'Import events from Google Calendar'}
                    </Text>
                  </View>
                  {googleConnected && <Ionicons name="checkmark-circle" size={20} color={GREEN} />}
                </View>
                {connections.isLoading ? (
                  <ActivityIndicator color={colors.primary} style={s.loader} />
                ) : googleConnected ? (
                  <View style={s.providerActions}>
                    <TouchableOpacity style={s.reviewBtn} onPress={() => setReviewProvider('google')}>
                      <Text style={s.reviewBtnText}>Review events</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => disconnectProvider('google')}
                      disabled={disconnectGoogle.isPending}
                    >
                      <Text style={s.quietDisconnect}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[s.primaryBtn, connectingGoogle && s.buttonDisabled]}
                    onPress={handleConnectGoogle}
                    disabled={connectingGoogle}
                  >
                    {connectingGoogle && <ActivityIndicator size="small" color={colors.white} />}
                    <Text style={s.primaryBtnText}>
                      {connectingGoogle ? 'Connecting…' : 'Connect Google Calendar'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.card}>
                <View style={s.providerRow}>
                  <ProviderIcon provider="apple" />
                  <View style={s.providerText}>
                    <Text style={s.providerName}>Apple Calendar</Text>
                    <Text style={s.providerDesc}>
                      {appleConnected ? 'Connected via iCal feed' : 'Connect with an iCal or webcal URL'}
                    </Text>
                  </View>
                  {appleConnected && <Ionicons name="checkmark-circle" size={20} color={GREEN} />}
                </View>
                {connections.isLoading ? (
                  <ActivityIndicator color={colors.primary} style={s.loader} />
                ) : appleConnected ? (
                  <View style={s.providerActions}>
                    <TouchableOpacity style={s.reviewBtn} onPress={() => setReviewProvider('apple')}>
                      <Text style={s.reviewBtnText}>Review events</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => disconnectProvider('apple')}
                      disabled={disconnectApple.isPending}
                    >
                      <Text style={s.quietDisconnect}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
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
                      style={[s.primaryBtn, connectApple.isPending && s.buttonDisabled]}
                      onPress={handleConnectApple}
                      disabled={connectApple.isPending}
                    >
                      {connectApple.isPending && <ActivityIndicator size="small" color={colors.white} />}
                      <Text style={s.primaryBtnText}>
                        {connectApple.isPending ? 'Connecting…' : 'Connect Apple Calendar'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={s.hint}>
                      In Calendar.app, share a calendar and copy its link.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerSide: { minWidth: 72 },
  headerSideRight: { alignItems: 'flex-end' },
  headerAction: { flexDirection: 'row', alignItems: 'center' },
  headerActionText: { fontSize: typography.size.md, color: colors.primary },
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
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  intro: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  introTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  introText: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reviewProviderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
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
  providerDesc: { fontSize: typography.size.xs, color: colors.mutedForeground },
  loader: { marginVertical: spacing.md },
  providerActions: { gap: spacing.md, alignItems: 'center' },
  reviewBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  reviewBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  quietDisconnect: { fontSize: typography.size.sm, color: colors.mutedForeground },
  primaryBtn: {
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  buttonDisabled: { opacity: 0.55 },
  appleForm: { gap: spacing.sm },
  urlInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
  hint: { fontSize: typography.size.xs, lineHeight: 17, color: colors.mutedForeground },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl },
  stateTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    textAlign: 'center',
  },
  stateText: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
  reviewContent: { paddingBottom: spacing.xxl },
  reviewIntro: { gap: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  selectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  selectionActionText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
  actionDivider: { width: 1, height: 14, backgroundColor: colors.border },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  eventRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  eventRowDisabled: { opacity: 0.72 },
  eventCheck: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCheckSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  eventCheckSynced: { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
  eventBody: { flex: 1, gap: 3 },
  eventTitle: { fontSize: typography.size.md, color: colors.foreground },
  eventMeta: { fontSize: typography.size.xs, color: colors.mutedForeground },
  syncedSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  syncedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  syncedListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
  },
  syncedTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  syncedSubtitle: { marginTop: 2, fontSize: typography.size.xs, color: colors.mutedForeground },
  stickyFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  importBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
});
