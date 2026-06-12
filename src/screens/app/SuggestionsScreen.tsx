import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { track } from '../../lib/analytics';
import { OCCASIONS as SHARED_OCCASIONS, type OccasionId } from '../../lib/occasions';
import { useEntitlement } from '../../hooks/useEntitlement';
import { presentPaywall } from '../../lib/paywall';
import { useGenerateSuggestion } from '../../hooks/useSuggestions';
import {
  useAcceptEventOutfitPlan,
  useCreateOutfit,
  useGenerateEventOutfitPlan,
  type GenerateOutfitResult,
} from '../../hooks/useOutfits';
import { useItems } from '../../hooks/useItems';
import { useEvents } from '../../hooks/useEvents';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, spacing, typography, radii } from '../../theme';
import type { SuggestionsScreenProps } from '../../navigation/types';
import type { Item } from '../../types/item';
import { OutfitGeneratedSheet } from '../../components/calendar/OutfitGeneratedSheet';

// ── Constants ────────────────────────────────────────────────────────────────

type WeatherId = 'sunny' | 'rainy' | 'cold' | 'mild';

const WEATHER_OPTIONS: { id: WeatherId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'sunny', label: 'Sunny & Warm',     icon: 'sunny-outline' },
  { id: 'rainy', label: 'Rainy',             icon: 'rainy-outline' },
  { id: 'cold',  label: 'Cold & Crisp',      icon: 'snow-outline' },
  { id: 'mild',  label: 'Mild / Overcast',   icon: 'cloud-outline' },
];

const OCCASION_OPTIONS = SHARED_OCCASIONS;


// ── Helpers ──────────────────────────────────────────────────────────────────

function formatEventDate(isoDate: string): string {
  const d = new Date(isoDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return 'Today';
  if (day.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Item card inside result ───────────────────────────────────────────────────

function OutfitItemCard({ item }: { item: Item }) {
  const uri = resolveImageUri(item.imageUrl);
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemImageBox}>
        {uri ? (
          <Image source={{ uri }} style={styles.itemImage} resizeMode="contain" />
        ) : (
          <Ionicons name="shirt-outline" size={28} color={colors.border} />
        )}
      </View>
      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.itemCategory}>{item.category}</Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export function SuggestionsScreen({ navigation, route }: SuggestionsScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPremium } = useEntitlement();
  const eventIdParam = route?.params?.eventId;

  const [weather, setWeather]             = useState<WeatherId>('sunny');
  const [occasion, setOccasion]           = useState<OccasionId>('casual');
  const [details, setDetails]             = useState('');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(eventIdParam ?? null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName]           = useState('');
  const [refreshing, setRefreshing]       = useState(false);
  const [eventPlan, setEventPlan] = useState<GenerateOutfitResult | null>(null);

  const generateMutation = useGenerateSuggestion();
  const generateEventPlan = useGenerateEventOutfitPlan();
  const acceptEventPlan = useAcceptEventOutfitPlan();
  const createOutfit     = useCreateOutfit();
  const { data: items, refetch: refetchItems }   = useItems();
  const { data: events, refetch: refetchEvents } = useEvents();

  // If launched with eventId, pre-select that event
  useEffect(() => {
    if (!eventIdParam || !events) return;
    const ev = events.find((e) => e.id === eventIdParam);
    if (ev) {
      setSelectedEventId(eventIdParam);
      setOccasion(ev.occasion as OccasionId);
    }
  }, [eventIdParam, events]);

  const upcomingEvents = (events ?? [])
    .filter((e) => new Date(e.date).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const selectedEvent = selectedEventId
    ? upcomingEvents.find((e) => e.id === selectedEventId) ?? null
    : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchItems(), refetchEvents()]);
    setRefreshing(false);
  }, [refetchItems, refetchEvents]);

  const pickEvent = (id: number) => {
    const ev = upcomingEvents.find((e) => e.id === id);
    if (!ev) return;
    setSelectedEventId(id);
    setOccasion(ev.occasion as OccasionId);
    generateMutation.reset();
    setEventPlan(null);
  };

  const clearEvent = () => {
    setSelectedEventId(null);
    generateMutation.reset();
    setEventPlan(null);
  };

  const handleGenerate = async () => {
    if (!isPremium) {
      const shouldUpgrade = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Unlock Outfit Suggestions',
          'Get AI-powered outfit suggestions tailored to the weather, occasion, and your actual wardrobe.',
          [
            { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
            { text: 'See Plans', onPress: () => resolve(true) },
          ],
        );
      });
      if (!shouldUpgrade) return;
      await presentPaywall();
      return;
    }
    if (selectedEvent) {
      generateEventPlan.mutate(
        { eventId: selectedEvent.id },
        {
          onSuccess: (result) => {
            setEventPlan(result);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
          onError: (err: any) => {
            Alert.alert('Could not plan outfit', err?.response?.data?.message ?? 'Please try again.');
          },
        },
      );
      return;
    }
    track('outfit_suggestion_generated', { weather, occasion });
    generateMutation.mutate({
      weather,
      event: occasion,
      ...(details.trim() && { details: details.trim() }),
    });
  };

  const handleSave = () => {
    if (!generateMutation.data) return;
    const wLabel = WEATHER_OPTIONS.find((w) => w.id === weather)?.label ?? '';
    const oLabel = OCCASION_OPTIONS.find((o) => o.id === occasion)?.label ?? '';
    setSaveName(selectedEvent?.title ?? `${oLabel} — ${wLabel}`);
    setSaveModalOpen(true);
  };

  const confirmSave = () => {
    if (!generateMutation.data) return;
    const name = saveName.trim();
    if (!name) return;
    const { outfit, suggestion } = generateMutation.data;
    createOutfit.mutate(
      {
        name,
        description: suggestion,
        event:   occasion,
        itemIds: outfit.itemIds ?? [],
      },
      {
        onSuccess: () => {
          track('outfit_suggestion_saved', { occasion });
          setSaveModalOpen(false);
          Alert.alert('Saved', 'Outfit added to your history.');
        },
        onError: () => {
          Alert.alert('Error', 'Could not save outfit. Please try again.');
        },
      },
    );
  };

  // Resolve item objects from the suggestion result
  const resultItems: Item[] = generateMutation.data
    ? (generateMutation.data.outfit.itemIds ?? [])
        .map((e) => (items ?? []).find((i) => i.id === e.id))
        .filter((i): i is Item => i != null)
    : [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Outfit Suggestions</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="sparkles" size={24} color={colors.primary} />
            </View>
            <Text style={styles.heroTitle}>One outfit, curated.</Text>
            <Text style={styles.heroSubtitle}>
              Tell us the weather and occasion — we'll do the rest.
            </Text>
          </View>

          {/* No events nudge */}
          {upcomingEvents.length === 0 && (
            <TouchableOpacity
              style={styles.noEventsCard}
              onPress={() => navigation.getParent()?.navigate('Calendar' as never)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add an event"
            >
              <View style={styles.noEventsIcon}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noEventsTitle}>Style ahead for an event</Text>
                <Text style={styles.noEventsSub}>Add an upcoming occasion to plan the perfect outfit.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}

          {/* Upcoming events */}
          {upcomingEvents.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={styles.sectionTitle}>Style for an event</Text>
                {selectedEvent && (
                  <TouchableOpacity onPress={clearEvent} style={styles.clearBtn}>
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventsScroll}>
                {upcomingEvents.slice(0, 8).map((ev) => {
                  const isSelected = selectedEventId === ev.id;
                  return (
                    <TouchableOpacity
                      key={ev.id}
                      onPress={() => pickEvent(ev.id)}
                      style={[styles.eventCard, isSelected && styles.eventCardSelected]}
                    >
                      <Text style={[styles.eventTitle, isSelected && styles.eventTitleSelected]} numberOfLines={1}>
                        {ev.title}
                      </Text>
                      <Text style={styles.eventDate}>{formatEventDate(ev.date)}</Text>
                      {ev.location ? (
                        <Text style={styles.eventLocation} numberOfLines={1}>
                          {ev.location}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Weather picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. How's the weather?</Text>
            <View style={styles.optionGrid}>
              {WEATHER_OPTIONS.map((w) => {
                const active = weather === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => setWeather(w.id)}
                    style={[styles.optionPill, active && styles.optionPillActive]}
                  >
                    <Ionicons
                      name={w.icon}
                      size={22}
                      color={active ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                      {w.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Occasion picker */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>2. What's the occasion?</Text>
              {selectedEvent && (
                <Text style={styles.fromEvent}>From: {selectedEvent.title}</Text>
              )}
            </View>
            <View style={styles.optionGrid}>
              {OCCASION_OPTIONS.map((o) => {
                const active = occasion === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    onPress={() => {
                      setOccasion(o.id);
                      if (selectedEvent && selectedEvent.occasion !== o.id) {
                        setSelectedEventId(null);
                      }
                    }}
                    style={[styles.optionPill, active && styles.optionPillActive]}
                  >
                    <Ionicons
                      name={o.icon}
                      size={22}
                      color={active ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Details input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              3. Anything else?{' '}
              <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="e.g. I prefer earth tones, need pockets, on my feet all day…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              maxLength={500}
              style={styles.detailsInput}
            />
            {details.length > 0 && (
              <Text style={styles.charCount}>{details.length}/500</Text>
            )}
          </View>

          {/* Generate button */}
          <TouchableOpacity
            onPress={handleGenerate}
            disabled={generateMutation.isPending || generateEventPlan.isPending}
            style={[styles.generateBtn, (generateMutation.isPending || generateEventPlan.isPending) && styles.generateBtnDisabled]}
          >
            {generateMutation.isPending || generateEventPlan.isPending ? (
              <View style={styles.generateBtnInner}>
                <ActivityIndicator color={colors.primaryForeground} size="small" />
                <Text style={styles.generateBtnText}>{selectedEvent ? 'Planning outfit…' : 'Consulting Stylist…'}</Text>
              </View>
            ) : (
              <View style={styles.generateBtnInner}>
                <Text style={styles.generateBtnText}>
                  {selectedEvent
                    ? (selectedEvent.itemIds ?? []).length > 0 ? 'Try another outfit' : 'Plan outfit'
                    : 'Curate Outfit'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color={colors.primaryForeground} />
              </View>
            )}
          </TouchableOpacity>

          {/* Error state */}
          {generateMutation.isError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>
                {(generateMutation.error as Error)?.message ?? 'Could not generate outfit. Please try again.'}
              </Text>
            </View>
          )}

          {/* Result */}
          {generateMutation.data && !selectedEvent && (
            <View style={styles.resultCard}>
              <Text style={styles.resultHeading}>Your Curated Look</Text>
              <View style={styles.suggestionQuote}>
                <View style={styles.quoteLine} />
                <Text style={styles.suggestionText}>
                  "{generateMutation.data.suggestion}"
                </Text>
              </View>

              {resultItems.length > 0 && (
                <View style={styles.itemGrid}>
                  {resultItems.map((item) => (
                    <OutfitItemCard key={item.id} item={item} />
                  ))}
                </View>
              )}

              <View style={styles.resultActions}>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={createOutfit.isPending}
                  style={styles.saveBtn}
                >
                  <Ionicons name="bookmark-outline" size={18} color={colors.primaryForeground} />
                  <Text style={styles.saveBtnText}>
                    {createOutfit.isPending ? 'Saving…' : 'Save to Outfits'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleGenerate}
                  disabled={generateMutation.isPending}
                  style={styles.retryBtn}
                >
                  <Ionicons name="refresh-outline" size={18} color={colors.mutedForeground} />
                  <Text style={styles.retryBtnText}>Try again</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Save name modal */}
      <Modal
        visible={saveModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save outfit</Text>
            <Text style={styles.modalSubtitle}>Give it a name — or keep the one we suggested.</Text>
            <TextInput
              value={saveName}
              onChangeText={setSaveName}
              placeholder="e.g. Saturday brunch"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              style={styles.modalInput}
              onSubmitEditing={confirmSave}
              returnKeyType="done"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setSaveModalOpen(false)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmSave}
                disabled={!saveName.trim() || createOutfit.isPending}
                style={[styles.modalSave, (!saveName.trim() || createOutfit.isPending) && styles.modalSaveDisabled]}
              >
                <Text style={styles.modalSaveText}>
                  {createOutfit.isPending ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <OutfitGeneratedSheet
        result={eventPlan}
        allItems={items ?? []}
        onDone={() => setEventPlan(null)}
        onAccept={() => {
          if (!selectedEvent || !eventPlan) return;
          acceptEventPlan.mutate(
            { eventId: selectedEvent.id, candidateId: eventPlan.candidateId },
            {
              onSuccess: () => {
                setEventPlan(null);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              },
              onError: (err: any) => {
                Alert.alert('Could not save outfit', err?.response?.data?.message ?? 'Please try again.');
              },
            },
          );
        }}
        onTryAnother={() => {
          if (!selectedEvent || !eventPlan) return;
          generateEventPlan.mutate(
            { eventId: selectedEvent.id, previousCandidateId: eventPlan.candidateId },
            { onSuccess: setEventPlan },
          );
        }}
        isAccepting={acceptEventPlan.isPending}
        isRegenerating={generateEventPlan.isPending}
        hasCurrentOutfit={(selectedEvent?.itemIds ?? []).length > 0}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },

  // Scroll
  scroll: {
    padding: spacing.lg,
    gap: spacing.xl,
  },

  // No events nudge
  noEventsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noEventsIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  noEventsTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  noEventsSub: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 2,
    lineHeight: typography.size.xs * 1.5,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.xl,
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },

  // Sections
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    flex: 1,
  },
  optional: {
    fontWeight: typography.weight.regular,
    color: colors.mutedForeground,
    fontSize: typography.size.sm,
  },
  clearBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearText: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },
  fromEvent: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },

  // Events horizontal scroll
  eventsScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  eventCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.md,
    marginRight: spacing.md,
    minWidth: 160,
    maxWidth: 200,
  },
  eventCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0D`,
  },
  eventTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  eventTitleSelected: {
    color: colors.primary,
  },
  eventDate: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  eventLocation: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  // Option grid (2 columns)
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  optionPill: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionPillActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0D`,
  },
  optionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  optionLabelActive: {
    color: colors.primary,
  },

  // Details input
  detailsInput: {
    backgroundColor: colors.secondary,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.foreground,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textAlign: 'right',
  },

  // Generate button
  generateBtn: {
    backgroundColor: colors.foreground,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  generateBtnDisabled: {
    opacity: 0.65,
  },
  generateBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  generateBtnText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.primaryForeground,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: `${colors.error}12`,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: `${colors.error}30`,
  },
  errorText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.error,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },

  // Result card
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  resultHeading: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  suggestionQuote: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quoteLine: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  suggestionText: {
    flex: 1,
    fontSize: typography.size.md,
    fontStyle: 'italic',
    color: colors.foreground,
    lineHeight: typography.size.md * typography.lineHeight.loose,
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  itemCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  itemImageBox: {
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  itemCategory: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  resultActions: {
    gap: spacing.md,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
  },
  saveBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryBtnText: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },

  // Save modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  modalSubtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },
  modalInput: {
    backgroundColor: colors.secondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.foreground,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  modalCancel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
  },
  modalCancelText: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
  },
  modalSave: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.foreground,
  },
  modalSaveDisabled: {
    opacity: 0.45,
  },
  modalSaveText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});
