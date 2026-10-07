import { HomeActionRow, type HomeActionKey, type HomeActionRowHandle } from '../../components/home/HomeActionRow';
import { buildClosetInsights } from '../../lib/closetInsights';
import { ClosetInsightsCard } from '../../components/insights/ClosetInsightsCard';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  View,
  Text,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Linking,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useItems } from '../../hooks/useItems';
import { SkeletonBlock } from '../../components/primitives/SkeletonLoader';
import { GarmentCardSkeleton } from '../../components/primitives/GarmentCardSkeleton';
import { ErrorState } from '../../components/primitives/ErrorState';
import { useOutfits } from '../../hooks/useOutfits';
import { useEvents } from '../../hooks/useEvents';
import { useOutfitLogs, useDeleteOutfitLog, type OutfitLog } from '../../hooks/useOutfitLogs';
import { WearWeekStrip } from '../../components/home/WearWeekStrip';
import { presentCalendarEvent } from '../../components/calendar/calendar-presentation';
import { formatCountdown } from '../../components/calendar/calendarUtils';
import { OCCASIONS } from '../../lib/occasions';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { ShortlistDecisionCard } from '../../components/shopping/ShortlistDecisionCard';
import { buildShoppingEditItems, mergeShoppingSnaps } from '../../lib/shoppingGallery';
import { buildShortlistSpotlight } from '../../lib/shortlistSpotlight';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { useGlobalOutfitLogger } from '../../contexts/GlobalOutfitLoggerContext';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { useGlobalAddSheet } from '../../contexts/GlobalAddSheetContext';
import { useGlobalScan } from '../../contexts/GlobalScanContext';
import { useFabScroll } from '../../contexts/FabScrollContext';
import { useFocusEffect } from '@react-navigation/native';
import { useStylingWeatherToday } from '../../hooks/useWeather';
import { useActiveStylingLocation } from '../../hooks/useActiveStylingLocation';
import { useProfile } from '../../hooks/useProfile';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useDismissDailyLook, useResolveDailyLook, useSaveDailyLook, type DailyLookCandidate, type DailyLookResolveInput } from '../../hooks/useDailyLook';
import { DailyLookDetailSheet } from '../../components/home/DailyLookDetailSheet';
import { EditorialOutfitBoard } from '../../components/outfits/EditorialOutfitBoard';
import { resolveBoardPieces } from '../../components/outfits/editorialBoardLayout';
import { candidateTitle, sentenceCase, capitalizeFirst, gapLabel } from '../../components/home/dailyLookCopy';
import {
  LookMat,
  LookMatAction,
  LookMatEmpty,
  LookMatPreparing,
  lookPlateSize,
} from '../../components/home/TodaysLookPlate';
import { StylingLocationSheet } from '../../components/home/StylingLocationSheet';
import { HomeWardrobeEdit } from '../../components/home/HomeBriefBand';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { track } from '../../lib/analytics';
import { hasSeenAiActionCoach, markAiActionCoachSeen } from '../../lib/aiActionCoach';
import { hasSeenShortcutCoach } from '../../lib/shortcutCoach';
import { AiActionCoachmark } from '../../components/primitives/AiActionCoachmark';
import { formatTemp, resolveTempUnit } from '../../lib/temperature';
import type { StylistMissingEssential } from '../../features/stylist/types';
import {
  rankDailyStylistPicks,
  buildDailyLookExplanation,
  getDailyLookGenerationDecision,
  isCompleteWearableOutfit,
  selectDailyStylistPick,
  toLocalDateKey,
  type DailyPickHistoryEntry,
} from '../../lib/dailyStylistPick';
import {
  buildDailyLookContextRevision,
  buildDailyLookResolveInput,
  reconcileSavedDailyLookContext,
  resolveDailyLookPresentation,
  shoppingPriorityFromDailyLookGap,
  type SavedDailyLookContext,
} from '../../lib/dailyLookPresentation';
import {
  loadDailyPickHistory,
  recordDailyPick,
  saveDailyPickHistory,
} from '../../lib/dailyPickHistory';
import { colors, spacing, typography, radii } from '../../theme';
import { PressableScale } from '../../components/primitives/PressableScale';
import { ActionMenuSheet } from '../../components/primitives/ActionMenuSheet';
import { ScreenHeader, EditorialSection } from '../../components/primitives/Editorial';
import { AppText } from '../../components/primitives/AppText';
import type { HomeScreenProps } from '../../navigation/types';
import type { Outfit } from '../../types/outfit';

// ── Constants ────────────────────────────────────────────────────────────────

const SIDE_PAD = spacing.page;
const COL_GAP  = spacing.md;
/** Width of one event column in the calendar rail (before its rule inset). */
const EVENT_COL_W = 148;

const WEATHER_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  sunny: 'sunny-outline',
  rainy: 'rainy-outline',
  cold:  'snow-outline',
  mild:  'partly-sunny-outline',
};

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** The masthead dateline over the greeting, e.g. "Monday 28 September". */
function formatDateline(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  return `${weekday} ${date.getDate()} ${month}`;
}

function getGreeting(name?: string | null): string {
  const h = new Date().getHours();
  const period = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  if (!name) return `${period}.`;
  const first = name.split(' ')[0];
  const capitalized = first.charAt(0).toUpperCase() + first.slice(1);
  return `${period}, ${capitalized}.`;
}

function compactLocationLabel(label?: string): string | undefined {
  return label?.split(',')[0]?.trim() || undefined;
}

function formatEventDate(isoDate: string): string {
  const d   = new Date(isoDate);
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const day      = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime())    return 'Today';
  if (day.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function generatedPreviewOutfit(candidate: DailyLookCandidate): Outfit {
  return {
    id: -candidate.id,
    userId: candidate.userId,
    name: candidate.name,
    description: candidate.stylistNotes,
    event: null,
    itemIds: candidate.itemIds,
    tags: [],
    notes: candidate.stylistNotes,
    isDraft: false,
    isFavorite: false,
    aiGeneratedImageUrl: candidate.aiGeneratedImageUrl,
    wearCount: 0,
    lastWornAt: null,
    createdAt: candidate.createdAt,
  };
}

// ── Screen ───────────────────────────────────────────────────────────────────

function formatLogDate(dateStr: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  // Add T12:00:00 so the date isn't shifted by timezone offset
  const d = new Date(dateStr + 'T12:00:00');
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function occasionLabel(occasion: string): string {
  return OCCASIONS.find((entry) => entry.id === occasion)?.label ?? occasion.replaceAll('_', ' ');
}

function monogram(name?: string | null): string | undefined {
  const initial = name?.trim().charAt(0);
  return initial ? initial.toUpperCase() : undefined;
}

/**
 * A newspaper dateline: weekday and month as a tracked masthead over a serif
 * numeral. Today swaps the weekday for a walnut "Today" and a small dot, the
 * one warm signal in the rail.
 */
function Dateline({ date, month, day, compact = false }: { date: string; month: string; day: string; compact?: boolean }) {
  const isToday = formatEventDate(date) === 'Today';
  const weekday = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
  return (
    <View style={[styles.dateline, compact && styles.datelineCompact]}>
      <View style={styles.datelineMastRow}>
        {isToday ? <View style={styles.todayDot} /> : null}
        <Text style={[styles.datelineMast, isToday && styles.datelineMastToday]} numberOfLines={1}>
          {isToday ? 'Today' : compact ? month : `${weekday} · ${month}`}
        </Text>
      </View>
      <Text style={[styles.datelineDay, compact && styles.datelineDayCompact]}>{day}</Text>
    </View>
  );
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const { isPremium } = useEntitlement();
  const { data: items = [], isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useItems();
  const { data: outfits = [], isLoading: outfitsLoading, isError: outfitsError, refetch: refetchOutfits } = useOutfits();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: logs = [], isLoading: logsLoading } = useOutfitLogs();
  const { data: shoppingSnaps = [] } = useShoppingSnaps();
  const pendingShoppingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const deleteLog = useDeleteOutfitLog();
  const stylingLocation = useActiveStylingLocation();
  const weather = useStylingWeatherToday(stylingLocation.activeLocation);
  const { data: profile } = useProfile();
  const [locationSheetVisible, setLocationSheetVisible] = useState(false);
  const [wearLogMenuEntry, setWearLogMenuEntry] = useState<OutfitLog | null>(null);

  const { openLogger } = useGlobalOutfitLogger();
  const { openStylist } = useGlobalAIStylist();
  const { openAddSheet } = useGlobalAddSheet();
  const { openScanItem, openFromPhotos } = useGlobalScan();
  const { fabCollapsed } = useFabScroll();
  const insets = useSafeAreaInsets();
  const lastHomeScrollY = useRef(0);
  const [dailyPickDate, setDailyPickDate] = useState(() => toLocalDateKey(new Date()));
  const [dailyPickHistory, setDailyPickHistory] = useState<DailyPickHistoryEntry[]>([]);
  const [dailyPickHistoryLoaded, setDailyPickHistoryLoaded] = useState(false);
  const [dailyLookSheetVisible, setDailyLookSheetVisible] = useState(false);
  const resumeDailyLook = useRef(false);
  const [dailyLookSheetMode, setDailyLookSheetMode] = useState<'look' | 'suggestion'>('look');
  const [dailyLookSheetSession, setDailyLookSheetSession] = useState(0);
  const pendingDailyItem = useRef<number | null>(null);
  const [savedDailyOutfit, setSavedDailyOutfit] = useState<Outfit | null>(null);
  const [savedDailyLookContext, setSavedDailyLookContext] = useState<SavedDailyLookContext | null>(null);
  const saveDailyLook = useSaveDailyLook();
  const dismissDailyLook = useDismissDailyLook();
  const homeCurrency = useCurrencyCode();
  const closetInsights = useMemo(() => buildClosetInsights(items, logs), [items, logs]);
  const openClosetInsights = useCallback(() => {
    track('home_insights_open', { active_share: Math.round(closetInsights.activeShare * 100) });
    navigation.navigate('ClosetInsights');
  }, [closetInsights.activeShare, navigation]);
  const shortlist = useMemo(
    () => buildShortlistSpotlight(buildShoppingEditItems(mergeShoppingSnaps(shoppingSnaps, pendingShoppingUploads), { homeCurrency })),
    [homeCurrency, pendingShoppingUploads, shoppingSnaps],
  );

  useFocusEffect(useCallback(() => {
    if (resumeDailyLook.current) { resumeDailyLook.current = false; setDailyLookSheetVisible(true); }
    fabCollapsed.value = 0;
    setDailyPickDate(toLocalDateKey(new Date()));
  }, [fabCollapsed]));

  useEffect(() => {
    setSavedDailyOutfit(null);
    setSavedDailyLookContext(null);
    setDailyLookSheetVisible(false);
  }, [dailyPickDate, user?.id]);

  useEffect(() => {
    let active = true;
    setDailyPickHistoryLoaded(false);
    if (!user?.id) {
      setDailyPickHistory([]);
      setDailyPickHistoryLoaded(true);
      return () => { active = false; };
    }
    loadDailyPickHistory(user.id)
      .then((history) => {
        if (active) setDailyPickHistory(history);
      })
      .finally(() => {
        if (active) setDailyPickHistoryLoaded(true);
      });
    return () => { active = false; };
  }, [user?.id]);

  // Scroll runs on the UI thread: it drives the FAB collapse and the status
  // bar chrome every frame. The JS-side offset (read by the coachmark gate)
  // only needs to be right once the page settles, so it syncs on drag and
  // momentum end rather than per frame.
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const syncHomeScrollY = useCallback((y: number) => { lastHomeScrollY.current = y; }, []);
  const handleHomeScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const delta = y - lastScrollY.value;
      lastScrollY.value = y;
      scrollY.value = y;
      if (y <= 10 || delta < -6) {
        if (fabCollapsed.value !== 0) fabCollapsed.value = 0;
      } else if (delta > 6) {
        if (fabCollapsed.value !== 1) fabCollapsed.value = 1;
      }
    },
    onEndDrag: (event) => { runOnJS(syncHomeScrollY)(event.contentOffset.y); },
    onMomentumEnd: (event) => { runOnJS(syncHomeScrollY)(event.contentOffset.y); },
  });

  // Status-bar chrome: clear at rest, frosted as content slides beneath the
  // Dynamic Island, with a hairline once the page is properly under way.
  const chromeBlurProps = useAnimatedProps(() => ({
    intensity: interpolate(scrollY.value, [0, 24], [0, 40], Extrapolation.CLAMP),
  }));
  const chromeTintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP),
  }));
  const chromeRuleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [32, 64], [0, 1], Extrapolation.CLAMP),
  }));
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => { if (active) setReduceTransparency(enabled); })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const { width, fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  // Today's Look runs full-bleed, edge to edge, at the same portrait ratio
  // outfit photography uses everywhere else in the app.
  const plate = lookPlateSize(width);

  // ── First-run action tour ────────────────────────────────────────────────
  // The three Home actions are icon discs, so what each does is taught once,
  // step by step, pointed at each disc in turn. It waits for the tab bar's
  // shortcut coach (which opens over Home on first run) to be settled, so the
  // two never stack; checking on focus means it lands on the next visit.
  const actionRowRef = useRef<HomeActionRowHandle>(null);
  const [tour, setTour] = useState<{ step: number; rect: { x: number; y: number; width: number; height: number } } | null>(null);
  const homeSheetOpenRef = useRef(false);
  useEffect(() => {
    homeSheetOpenRef.current = dailyLookSheetVisible || locationSheetVisible || wearLogMenuEntry !== null;
  }, [dailyLookSheetVisible, locationSheetVisible, wearLogMenuEntry]);

  const showTourStep = useCallback(async (step: number) => {
    const rect = await actionRowRef.current?.measure(HOME_TOUR_STEPS[step].key);
    if (!rect) { setTour(null); return; }
    track('home_action_tour_step', { step: step + 1 });
    setTour({ step, rect });
  }, []);

  useFocusEffect(useCallback(() => {
    const userId = user?.id;
    if (!userId) return undefined;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    Promise.all([hasSeenAiActionCoach('home_action_tour', userId), hasSeenShortcutCoach(userId)])
      .then(([seenTour, seenShortcut]) => {
        if (!active || seenTour || !seenShortcut) return;
        timer = setTimeout(() => {
          if (!active || lastHomeScrollY.current > 10 || homeSheetOpenRef.current) return;
          void showTourStep(0);
        }, 700);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [user?.id, showTourStep]));

  const endTour = useCallback((reason: 'done' | 'skip' | 'scrim' | 'button_tap') => {
    if (!tour) return;
    const userId = user?.id;
    setTour(null);
    track('home_action_tour_dismissed', { reason, step: tour.step + 1 });
    if (userId) void markAiActionCoachSeen('home_action_tour', userId);
  }, [tour, user?.id]);

  const advanceTour = useCallback(() => {
    if (!tour) return;
    if (tour.step + 1 >= HOME_TOUR_STEPS.length) endTour('done');
    else void showTourStep(tour.step + 1);
  }, [tour, endTour, showTourStep]);


  const handleAddToCloset = useCallback(() => {
    endTour('button_tap');
    track('home_wardrobe_action_tapped', { action: 'add_clothes_menu' });
    openAddSheet({
      onTakePhoto: () => openScanItem('camera'),
      onFromPhotos: () => openFromPhotos(),
    });
  }, [endTour, openAddSheet, openFromPhotos, openScanItem]);

  const handleRecordWear = useCallback(() => {
    track('home_wardrobe_action_tapped', { action: 'record_wear', source: 'week_in_wear' });
    openLogger({ quickStart: true });
  }, [openLogger]);

  const handleLogTodaysWear = useCallback(() => {
    endTour('button_tap');
    track('home_wardrobe_action_tapped', { action: 'record_wear', source: 'todays_wear' });
    openLogger({ quickStart: true });
  }, [endTour, openLogger]);

  const handleLogPastDay = useCallback((date: string) => {
    track('home_wardrobe_action_tapped', { action: 'record_wear', source: 'week_strip_past_day' });
    openLogger({ quickStart: true, date });
  }, [openLogger]);

  // Tapping a logged day in the week strip opens its options sheet, which is
  // where deletion lives; long-press remains a shortcut.
  const confirmDeleteLog = useCallback((log: OutfitLog) => {
    Alert.alert(
      'Delete this entry?',
      `Remove ${formatLogDate(log.date)} from your week in wear.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteLog.mutate(log.id) },
      ],
    );
  }, [deleteLog]);

  // Derived data
  const upcomingEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return events
      .filter((e) => { const d = new Date(e.date); d.setHours(0, 0, 0, 0); return d >= today; })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [events]);

  const nextUpEvent = useMemo(
    () => upcomingEvents.find((event) => !event.outfitId && (event.itemIds?.length ?? 0) === 0) ?? upcomingEvents[0],
    [upcomingEvents],
  );
  // The standalone "Next up" card only ever shows when the shortlist is
  // empty (see render below) — when it does, it's always drawn from this
  // same list, so the carousel underneath must not repeat it.
  const showNextUpCard = shortlist.awaitingDecision.length === 0 && !!nextUpEvent;
  const nextUpPresentation = nextUpEvent ? presentCalendarEvent(nextUpEvent) : null;
  const carouselEvents = useMemo(
    () => (showNextUpCard ? upcomingEvents.filter((event) => event.id !== nextUpEvent!.id) : upcomingEvents),
    [showNextUpCard, upcomingEvents, nextUpEvent],
  );

  // Snap each column's rule to the page gutter. The first column has no rule
  // inset; every later one carries COL_GAP of left padding before its rule.
  const carouselSnapOffsets = useMemo(
    () => carouselEvents.map((_, index) => (
      index === 0 ? 0 : EVENT_COL_W + COL_GAP + (index - 1) * (EVENT_COL_W + COL_GAP * 2)
    )),
    [carouselEvents],
  );

  const recentOutfits = useMemo(
    () => outfits
      .filter((outfit) => isCompleteWearableOutfit(outfit, items))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
    [items, outfits],
  );

  const profilePhotoUri = profile?.photoUrl ? resolveImageUri(profile.photoUrl) : undefined;
  const avatarMonogram = monogram(user?.displayName);
  const tempUnit = resolveTempUnit(profile?.tempUnit, profile?.location);
  const activeLocationLabel = stylingLocation.activeLocation.label?.trim() || undefined;
  const compactActiveLocation = compactLocationLabel(activeLocationLabel);
  const locationSource = stylingLocation.activeLocation.source;
  const isHomeFallback = locationSource === 'home';
  const isDestination = locationSource === 'destination';
  const locationBadge = isDestination ? 'Trip' : isHomeFallback ? 'Home' : undefined;
  const weatherLocationIcon: keyof typeof Ionicons.glyphMap | undefined = weather.data
    ? (WEATHER_ICON[weather.data.current.condition] ?? 'thermometer-outline')
    : compactActiveLocation
      ? 'location-outline'
      : undefined;
  const weatherLocationLine = weather.data
    ? [formatTemp(weather.data.current, tempUnit), compactActiveLocation, locationBadge].filter(Boolean).join(' · ')
    : compactActiveLocation
      ? [compactActiveLocation, locationBadge].filter(Boolean).join(' · ')
      : 'Set weather location';
  const locationAccessibilityLabel = activeLocationLabel
    ? `Weather location: ${activeLocationLabel}. ${
      isDestination ? 'Styling for a destination.' : isHomeFallback ? 'Using Home city.' : 'Using current location.'
    } Tap to change.`
    : 'No weather location set. Tap to set weather location.';
  const rankedDailyPicks = useMemo(
    () => dailyPickHistoryLoaded
      ? rankDailyStylistPicks({
        outfits,
        items,
        events,
        weather: weather.data,
        logs,
        date: dailyPickDate,
        history: dailyPickHistory,
        tempUnit,
      })
      : [],
    [dailyPickDate, dailyPickHistory, dailyPickHistoryLoaded, events, items, logs, outfits, weather.data, tempUnit],
  );
  const dailyPick = rankedDailyPicks[0] ?? null;
  const dailyLookDecision = useMemo(
    () => dailyPickHistoryLoaded
      ? getDailyLookGenerationDecision({ outfits, items, events, weather: weather.data, date: dailyPickDate, history: dailyPickHistory })
      : { shouldGenerate: false, shouldResolve: false },
    [dailyPickDate, dailyPickHistory, dailyPickHistoryLoaded, events, items, outfits, weather.data],
  );
  const dailyLookLocation = useMemo(() => {
    const active = stylingLocation.activeLocation;
    return {
      source: active.source,
      label: active.label,
      lat: active.coords?.lat,
      lon: active.coords?.lon,
    };
  }, [stylingLocation.activeLocation]);
  const dailyLookContextRevision = useMemo(
    () => buildDailyLookContextRevision({
      items,
      outfits,
      events,
      weather: weather.data,
      location: dailyLookLocation,
    }),
    [dailyLookLocation, events, items, outfits, weather.data],
  );
  const dailyLookInput = useMemo<DailyLookResolveInput | null>(() => {
    return buildDailyLookResolveInput({
      decision: dailyLookDecision,
      localDate: dailyPickDate,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      location: dailyLookLocation,
      weather: weather.data,
      history: dailyPickHistory,
      rankedOutfitIds: rankedDailyPicks.map((entry) => entry.outfit.id),
      currentOutfitId: dailyPick?.outfit.id ?? null,
      items,
      outfits,
      events,
    });
  }, [dailyLookDecision, dailyLookLocation, dailyPick?.outfit.id, dailyPickDate, dailyPickHistory, events, items, outfits, rankedDailyPicks, weather.data]);
  const dailyLookQuery = useResolveDailyLook(
    dailyLookInput,
    isPremium && dailyPickHistoryLoaded && !weather.isLoading && !stylingLocation.isLoading,
  );
  useEffect(() => {
    if (!savedDailyOutfit || !savedDailyLookContext) return;
    const reconciliation = reconcileSavedDailyLookContext(savedDailyLookContext, dailyLookContextRevision);
    if (reconciliation === 'observe_target') {
      setSavedDailyLookContext((current) => current ? { ...current, targetObserved: true } : null);
      return;
    }
    if (reconciliation === 'clear') {
      setSavedDailyOutfit(null);
      setSavedDailyLookContext(null);
      setDailyLookSheetVisible(false);
    }
  }, [dailyLookContextRevision, savedDailyLookContext, savedDailyOutfit]);
  const dailyLookPresentation = resolveDailyLookPresentation({
    premium: isPremium,
    shouldResolve: dailyLookDecision.shouldResolve,
    fetching: dailyLookQuery.isFetching,
    response: dailyLookQuery.data,
    rankedOutfit: dailyPick?.outfit,
    rankedReason: dailyPick?.reason,
    fallbackOutfits: rankedDailyPicks.map((entry) => ({ outfit: entry.outfit, reason: entry.reason })),
    savedOutfit: savedDailyOutfit,
    savedReason: dailyLookQuery.data?.candidate?.reason,
  });
  // Do not show a definitive empty state while the inputs that determine the
  // recommendation are still hydrating. Apart from avoiding contradictory
  // copy, matching the hero's height keeps the page from jumping when the look
  // resolves a moment later.
  const dailyLookIsPreparing = itemsLoading
    || outfitsLoading
    || eventsLoading
    || logsLoading
    || !dailyPickHistoryLoaded
    || stylingLocation.isLoading
    || weather.isLoading
    || dailyLookPresentation.kind === 'loading';
  const generatedCandidate = dailyLookPresentation.kind === 'ready'
    || dailyLookPresentation.kind === 'incomplete'
    || dailyLookPresentation.kind === 'priority'
    ? dailyLookPresentation.candidate
    : null;
  const featuredOutfit = dailyLookPresentation.kind === 'owned' ? dailyLookPresentation.outfit : undefined;
  const featuredReason = dailyLookPresentation.kind === 'owned' ? dailyLookPresentation.reason : 'Today’s Look';
  const featuredRankedPick = featuredOutfit
    ? rankedDailyPicks.find((entry) => entry.outfit.id === featuredOutfit.id)
    : generatedCandidate?.readinessStatus === 'ready'
      ? selectDailyStylistPick({
        outfits: [generatedPreviewOutfit(generatedCandidate)],
        items,
        events,
        weather: weather.data,
        logs,
        date: dailyPickDate,
        history: dailyPickHistory,
        tempUnit,
      })
    : null;
  const featuredEvent = dailyLookDecision.eventId
    ? events.find((event) => event.id === dailyLookDecision.eventId)
    : undefined;
  const featuredExplanation = featuredRankedPick
    ? buildDailyLookExplanation({
      pick: featuredRankedPick,
      weather: weather.data,
      event: featuredEvent,
      tempUnit,
    })
    : null;
  const candidateGap = dailyLookPresentation.kind === 'incomplete' || dailyLookPresentation.kind === 'priority'
    ? dailyLookPresentation.gap
    : undefined;
  const candidateHasFlatLay = generatedCandidate?.readinessStatus === 'ready' && !!generatedCandidate.aiGeneratedImageUrl;
  // The board's suggestion tile shows a real, in-stock product when the edit
  // has one. Same query (and cache entry) the daily-look sheet reads.
  const gapEdit = useShoppingPriorityEdit(
    shoppingPriorityFromDailyLookGap(candidateGap ?? IDLE_GAP),
    { origin: 'daily_look', enabled: !!candidateGap && !candidateHasFlatLay },
  );
  const suggestionOffer = (() => {
    if (gapEdit.data?.status === 'no_buy') return undefined;
    for (const target of gapEdit.data?.targets ?? []) {
      const offer = target.offers?.find((candidate) => candidate.inStock !== false && candidate.imageUrl);
      if (offer?.imageUrl) return { imageUrl: offer.imageUrl, formattedPrice: offer.formattedPrice, brand: offer.brand ?? offer.merchant };
    }
    return undefined;
  })();
  const hasHomeCollage = !dailyLookIsPreparing && (generatedCandidate
    ? !candidateHasFlatLay
    : !!featuredOutfit && !featuredOutfit.aiGeneratedImageUrl);
  useEffect(() => {
    resumeDailyLook.current = false;
    pendingDailyItem.current = null;
    setDailyLookSheetVisible(false);
    setDailyLookSheetMode('look');
  }, [generatedCandidate?.id, dailyPickDate, user?.id]);




  useEffect(() => {
    if (dailyLookDecision.shouldGenerate && dailyLookDecision.trigger) {
      track('daily_look_generation_eligible', { trigger: dailyLookDecision.trigger });
    }
  }, [dailyLookDecision]);

  useEffect(() => {
    if (!generatedCandidate) return;
    track('daily_look_generated', {
      candidateId: generatedCandidate.id,
      trigger: generatedCandidate.trigger,
      resolutionKind: generatedCandidate.readinessStatus,
      gapCount: generatedCandidate.missingEssentials.length,
      fallbackUsed: false,
    });
    if (generatedCandidate.readinessStatus !== 'ready') {
      track('daily_look_partial_impression', {
        candidateId: generatedCandidate.id,
        resolutionKind: generatedCandidate.readinessStatus,
        gapCount: generatedCandidate.missingEssentials.length,
      });
    }
  }, [generatedCandidate?.id, generatedCandidate?.readinessStatus]);

  useEffect(() => {
    if (dailyLookPresentation.kind !== 'owned' || dailyLookPresentation.source !== 'fallback') return;
    track('daily_look_resolved', { resolutionKind: 'fallback', fallbackUsed: true, outfitId: dailyLookPresentation.outfit.id });
  }, [dailyLookPresentation.kind, dailyLookPresentation.kind === 'owned' ? dailyLookPresentation.outfit.id : null]);

  useEffect(() => {
    if (!dailyLookInput || !dailyLookQuery.data || dailyLookPresentation.kind !== 'empty') return;
    track('daily_look_resolved', {
      resolutionKind: 'empty',
      trigger: dailyLookInput.trigger,
      fallbackUsed: false,
      outcome: dailyLookQuery.data.outcome,
    });
  }, [dailyLookInput?.clientContextRevision, dailyLookPresentation.kind, dailyLookQuery.data?.outcome]);

  useEffect(() => {
    if (!dailyLookQuery.isError) return;
    track('daily_look_generation_failed');
  }, [dailyLookQuery.isError]);

  useEffect(() => {
    if (!dailyPickHistoryLoaded || !user?.id || dailyLookPresentation.kind !== 'owned' || savedDailyOutfit || dailyLookQuery.isFetching) return;
    const presentedOutfit = dailyLookPresentation.outfit;
    const current = dailyPickHistory.find((entry) => entry.date === dailyPickDate);
    if (current?.outfitId === presentedOutfit.id) return;
    const next = recordDailyPick(dailyPickHistory, { date: dailyPickDate, outfitId: presentedOutfit.id });
    setDailyPickHistory(next);
    saveDailyPickHistory(user.id, next).catch(() => {});
  }, [dailyLookQuery.isFetching, dailyLookPresentation, dailyPickDate, dailyPickHistory, dailyPickHistoryLoaded, savedDailyOutfit, user?.id]);

  const handleDailyLookSave = () => {
    if (!generatedCandidate || generatedCandidate.readinessStatus !== 'ready') return;
    track('daily_look_save_tapped', { candidateId: generatedCandidate.id });
    saveDailyLook.mutate(
      { candidateId: generatedCandidate.id },
      {
        onSuccess: ({ outfit }) => {
          const outfitsAfterSave = outfits.some((entry) => entry.id === outfit.id)
            ? outfits.map((entry) => entry.id === outfit.id ? outfit : entry)
            : [outfit, ...outfits];
          const targetRevision = buildDailyLookContextRevision({
            items,
            outfits: outfitsAfterSave,
            events,
            weather: weather.data,
            location: dailyLookLocation,
          });
          setSavedDailyOutfit(outfit);
          setSavedDailyLookContext({
            sourceRevision: dailyLookContextRevision,
            targetRevision,
            targetObserved: false,
          });
          setDailyLookSheetVisible(false);
          if (user?.id) {
            const next = recordDailyPick(dailyPickHistory, { date: dailyPickDate, outfitId: outfit.id });
            setDailyPickHistory(next);
            saveDailyPickHistory(user.id, next).catch(() => {});
          }
        },
        onError: (error) => {
          if ((error as { response?: { status?: number } }).response?.status === 409) {
            setDailyLookSheetVisible(false);
            Alert.alert('This look is no longer available', 'Today’s Look has been updated to match your wardrobe.');
            return;
          }
          Alert.alert('Couldn’t save this look', 'The look is still here. Please try again.');
        },
      },
    );
  };

  const handleDailyLookDismiss = () => {
    if (!generatedCandidate) return;
    dismissDailyLook.mutate(
      { candidateId: generatedCandidate.id },
      { onSuccess: () => setDailyLookSheetVisible(false) },
    );
  };

  const closeDailyLookSheet = () => {
    resumeDailyLook.current = false;
    pendingDailyItem.current = null;
    setDailyLookSheetVisible(false);
  };

  const openDailyLookSheet = (mode: 'look' | 'suggestion' = 'look') => {
    resumeDailyLook.current = false;
    pendingDailyItem.current = null;
    setDailyLookSheetMode(mode);
    setDailyLookSheetSession(session => session + 1);
    if (generatedCandidate) track('daily_look_detail_opened', { candidateId: generatedCandidate.id, mode });
    setDailyLookSheetVisible(true);
  };

  const openDailyLookItem = (id: number) => {
    resumeDailyLook.current = false;
    pendingDailyItem.current = null;
    navigation.navigate('Closet', { screen: 'ItemDetail', params: { itemId: id, returnTo: 'Home' } });
  };

  const handleDailyLookFindPiece = () => {
    if (!generatedCandidate || !candidateGap) return;
    track('daily_look_missing_piece_tapped', {
      candidateId: generatedCandidate.id,
      resolutionKind: generatedCandidate.readinessStatus,
      category: candidateGap.category,
      source: 'home_daily_look',
    });
    setDailyLookSheetVisible(false);
    navigation.navigate('Shop', {
      screen: 'ShoppingPriorityEdit',
      params: {
        source: 'home_daily_look',
        origin: 'daily_look',
        priority: shoppingPriorityFromDailyLookGap(candidateGap),
      },
    });
  };

  if ((itemsError || outfitsError) && items.length === 0 && outfits.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ErrorState
          message="Couldn't load your feed"
          onRetry={() => { refetchItems(); refetchOutfits(); }}
        />
      </View>
    );
  }

  if ((itemsLoading || outfitsLoading) && items.length === 0 && outfits.length === 0) {
    const pillWidth = width - SIDE_PAD * 2;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing.lg }}>
        <View style={{ paddingHorizontal: SIDE_PAD, gap: spacing.sm, marginBottom: spacing.xl }}>
          <SkeletonBlock width={140} height={12} borderRadius={2} />
          <SkeletonBlock width={220} height={32} borderRadius={6} />
          <SkeletonBlock width={150} height={16} borderRadius={4} />
        </View>
        <SkeletonBlock width={pillWidth} height={52} borderRadius={100} style={{ marginHorizontal: SIDE_PAD, marginBottom: spacing.md }} />
        <View style={[styles.skeletonGhostPill, { width: pillWidth }]} />
        <View style={{ paddingHorizontal: SIDE_PAD, marginBottom: spacing.md }}>
          <SkeletonBlock width={120} height={16} borderRadius={4} />
        </View>
        <GarmentCardSkeleton count={4} />
      </View>
    );
  }

  return (
    <View style={styles.screenRoot}>
    <Animated.ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScroll={handleHomeScroll}
      scrollEventThrottle={16}
    >
      <View style={[styles.headerRow, largeText && styles.headerRowLarge]}>
        <ScreenHeader
          title={getGreeting(user?.displayName)}
          eyebrow={formatDateline(new Date())}
          titleVariant="display"
          safeTop={false}
          style={[styles.greetingHeader, largeText && styles.greetingHeaderLarge]}
          subtitleNode={(
            <TouchableOpacity
              style={styles.weatherLocationButton}
              onPress={() => setLocationSheetVisible(true)}
              activeOpacity={0.65}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={locationAccessibilityLabel}
            >
              {weatherLocationIcon ? (
                <Ionicons name={weatherLocationIcon} size={13} color={colors.inkSubtle} />
              ) : null}
              {/* One chevron marks the whole line as the thing that changes. */}
              <AppText variant="meta" tone="secondary" style={styles.weatherLocationText} numberOfLines={1}>
                {weatherLocationLine}
              </AppText>
              <Ionicons name="chevron-down" size={12} color={colors.inkSubtle} />
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity
          style={[styles.avatarBtn, largeText && styles.avatarLarge]}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Open profile and settings"
        >
          {profilePhotoUri ? (
            <Image
              source={{ uri: profilePhotoUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
            />
          ) : avatarMonogram ? (
            <Text style={styles.avatarMonogram} maxFontSizeMultiplier={1.2}>{avatarMonogram}</Text>
          ) : (
            <Ionicons name="person-outline" size={17} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <HomeActionRow
        ref={actionRowRef}
        style={styles.actionRow}
        onAddToCloset={handleAddToCloset}
        onSaveFind={() => {
          endTour('button_tap');
          track('shop_action_selected', { action: 'evaluate_item', source: 'home' });
          // initial:false keeps ShopMain beneath the camera so closing it never strands the Shop tab on the camera.
          navigation.navigate('Shop', { screen: 'ShoppingCamera', initial: false });
        }}
        onLogWear={handleLogTodaysWear}
        onAskStylist={() => {
          endTour('button_tap');
          openStylist({
            source: 'home_prompt',
            onNavigateToCloset: (outfitId) => navigation.navigate('Closet', {
              screen: 'OutfitDetail',
              params: { outfitId, returnTo: 'Home' },
            }),
            onNavigateToShop: (gap?: StylistMissingEssential) => {
              if (!gap?.label) return;
              navigation.navigate('Shop', { screen: 'ShoppingPriorityEdit', params: {
                origin: 'daily_look',
                priority: shoppingPriorityFromDailyLookGap(gap),
              }});
            },
          });
        }}
      />
      {/* ── Featured outfit ────────────────────────────────────── */}
      <EditorialSection
        variant="ruled"
        headingStyle="chapter"
        dividerPlacement="above-heading"
        title={dailyLookPresentation.kind === 'priority' ? 'Today’s Priority' : 'Today’s Look'}
        trailing={hasHomeCollage ? (
          <PressableScale onPress={() => generatedCandidate ? openDailyLookSheet('look') : featuredOutfit && navigation.navigate('Closet', {
            screen: 'OutfitDetail', params: { outfitId: featuredOutfit.id, returnTo: 'Home' },
          })} haptic={false} motion="crisp" scaleTo={0.985}
            contentStyle={{ minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md }}
            accessibilityRole="button" accessibilityLabel="Look details">
            <Text style={{ ...typography.text.meta, color: colors.inkSubtle }}>Details</Text>
          </PressableScale>
        ) : undefined}
        actionLabel={!hasHomeCollage && (dailyLookPresentation.kind === 'owned' || dailyLookPresentation.kind === 'ready') ? 'All outfits' : undefined}
        onAction={!hasHomeCollage && (dailyLookPresentation.kind === 'owned' || dailyLookPresentation.kind === 'ready') ? () => navigation.navigate('Closet', {
          screen: 'ClosetMain',
          params: { segment: 'outfits' },
        }) : undefined}
      >
        {dailyLookIsPreparing ? (
          <LookMatPreparing width={plate.width} height={plate.height} />
        ) : generatedCandidate ? (
          <LookMat
            key={`candidate-${generatedCandidate.id}`}
            largeText={largeText}
            interactivePlate={!candidateHasFlatLay}
            collageCaption={!candidateHasFlatLay}
            editorialCollage={!candidateHasFlatLay}
            plate={generatedCandidate.readinessStatus === 'ready' && generatedCandidate.aiGeneratedImageUrl ? (
              <OutfitCollage outfit={generatedPreviewOutfit(generatedCandidate)} size={plate.width} height={plate.height} borderRadius={0} />
            ) : (
              <View style={{ paddingHorizontal: spacing.page, backgroundColor: colors.background }}>
                <EditorialOutfitBoard pieces={resolveBoardPieces(candidateGap ? generatedCandidate.foundationItemIds : generatedCandidate.itemIds, items)} width={plate.width - spacing.page * 2}
                  onPressItem={openDailyLookItem}
                  suggestion={candidateGap ? { label: sentenceCase(candidateGap.label), category: candidateGap.category, offer: suggestionOffer } : undefined}
                  onPressSuggestion={handleDailyLookFindPiece} />
              </View>
            )}
            eyebrow={generatedCandidate.readinessStatus === 'incomplete'
              ? 'Suggested addition'
              : generatedCandidate.readinessStatus === 'priority'
                ? 'Suggested addition'
                : undefined}
            title={candidateTitle(generatedCandidate, candidateGap)}
            note={capitalizeFirst(featuredExplanation ?? generatedCandidate.reason)}
            onOpen={() => openDailyLookSheet('look')}
            accessibilityLabel={`${generatedCandidate.name}. ${generatedCandidate.reason}. Open details`}
            captionAccessibilityLabel={candidateHasFlatLay ? `Open ${candidateTitle(generatedCandidate, candidateGap)}` : `Look details: ${candidateTitle(generatedCandidate, candidateGap)}`}
            action={candidateGap && !candidateHasFlatLay ? undefined : candidateGap ? (
              <LookMatAction
                icon="bag-outline"
                variant={candidateHasFlatLay ? 'outlined' : 'text'}
                label={candidateHasFlatLay ? 'Find it' : candidateGap.category === 'outerwear' ? 'Find a layer' : 'Find this piece'}
                multiline={!candidateHasFlatLay}
                onPress={handleDailyLookFindPiece}
                disabled={saveDailyLook.isPending}
                accessibilityLabel={`Find ${gapLabel(candidateGap.label)}, suggested and not in your closet`}
                accessibilityHint="Open a shopping edit for this missing piece"
              />
            ) : (
              <LookMatAction
                icon="bookmark-outline"
                onPress={handleDailyLookSave}
                disabled={saveDailyLook.isPending}
                accessibilityLabel="Save look"
                accessibilityHint="Save this curated look to your outfits"
              />
            )}
          />
        ) : featuredOutfit ? (
          <LookMat
            key={`outfit-${featuredOutfit.id}`}
            largeText={largeText}
            interactivePlate={!featuredOutfit.aiGeneratedImageUrl}
            collageCaption={!featuredOutfit.aiGeneratedImageUrl}
            editorialCollage={!featuredOutfit.aiGeneratedImageUrl}
            plate={(
              featuredOutfit.aiGeneratedImageUrl ? <OutfitCollage outfit={featuredOutfit} size={plate.width} height={plate.height} borderRadius={0} /> :
              <View style={{ paddingHorizontal: spacing.page, backgroundColor: colors.background }}>
                <EditorialOutfitBoard pieces={resolveBoardPieces(featuredOutfit.itemIds, items)} width={plate.width - spacing.page * 2} onPressItem={openDailyLookItem} />
              </View>
            )}
            title={featuredOutfit.name}
            note={featuredExplanation ?? featuredReason}
            onOpen={() => navigation.navigate('Closet', {
              screen: 'OutfitDetail',
              params: { outfitId: featuredOutfit.id, returnTo: 'Home' },
            })}
            accessibilityLabel={`${featuredOutfit.name}. ${featuredExplanation ?? featuredReason}`}
          />
        ) : (
          <LookMatEmpty
            width={plate.width}
            height={Math.round(plate.height * 0.6)}
            title={items.length === 0
              ? 'Your closet is ready for its first look'
              : outfits.length > 0
                ? 'No suitable look for today'
                : 'No saved outfits yet'}
            subtitle={items.length === 0
              ? 'Add a few pieces to unlock personalized outfit suggestions.'
              : outfits.length > 0
                ? 'Your stylist won’t force a combination that misses today’s needs.'
                : 'Build an outfit from your closet to see it here'}
            cta={items.length === 0 ? {
              label: 'Add clothes',
              accessibilityLabel: 'Add clothes to unlock outfit suggestions',
              onPress: handleAddToCloset,
            } : undefined}
          />
        )}
      </EditorialSection>

      {/* ── On the Calendar ───────────────────────────────────────── */}
      <EditorialSection
        variant="ruled"
        headingStyle="chapter"
        dividerPlacement="above-heading"
        title="On the Calendar"
        actionLabel="View all"
        onAction={() => navigation.navigate('Calendar')}
      >
        {upcomingEvents.length === 0 ? (
          <PressableScale
            contentStyle={styles.calendarEmpty}
            scaleTo={0.99}
            motion="crisp"
            haptic={false}
            onPress={() => navigation.navigate('Calendar')}
            accessibilityRole="button"
            accessibilityLabel="No upcoming events. Tap to add one"
          >
            <Text style={styles.calendarEmptyTitle}>Nothing on the calendar yet</Text>
            <View style={styles.inlineLink}>
              <Text style={styles.inlineLinkText}>Add an occasion</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.action} />
            </View>
          </PressableScale>
        ) : (
          <View style={styles.calendarStack}>
            {showNextUpCard ? (
              <PressableScale
                contentStyle={styles.nextUpCard}
                scaleTo={0.99}
                motion="crisp"
                haptic={false}
                onPress={() => navigation.navigate('Calendar', { eventId: nextUpEvent!.id })}
                accessibilityRole="button"
                accessibilityLabel={`${nextUpEvent!.title}, ${formatEventDate(nextUpEvent!.date)}. Open in Calendar`}
              >
                <View style={styles.nextUpDate}>
                  <Dateline
                    date={nextUpEvent!.date}
                    month={nextUpPresentation!.monthLabel}
                    day={nextUpPresentation!.dayLabel}
                    compact
                  />
                </View>
                <View style={styles.nextUpCopy}>
                  <Text style={styles.nextUpTitle} numberOfLines={1}>{nextUpEvent!.title}</Text>
                  <Text style={styles.nextUpSubtitle}>
                    {nextUpEvent!.outfitId || (nextUpEvent!.itemIds?.length ?? 0) > 0 ? 'Your look is planned' : 'Plan a look for your next occasion'} · {formatEventDate(nextUpEvent!.date)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />
              </PressableScale>
            ) : null}
            {carouselEvents.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.carousel}
                contentContainerStyle={styles.carouselContent}
                snapToOffsets={carouselSnapOffsets}
                decelerationRate="fast"
              >
                {carouselEvents.map((event, index) => {
                  const presentation = presentCalendarEvent(event);
                  const dateLabel = formatEventDate(event.date);
                  const when = formatCountdown(new Date(event.date)) ?? dateLabel;
                  const planned = !!event.outfitId || presentation.hasOutfit;
                  return (
                    <PressableScale
                      key={event.id}
                      style={index > 0 && styles.eventColumnRule}
                      contentStyle={styles.eventCard}
                      scaleTo={0.98}
                      motion="crisp"
                      haptic={false}
                      onPress={() => navigation.navigate('Calendar', { eventId: event.id })}
                      accessibilityRole="button"
                      accessibilityLabel={`${event.title}, ${dateLabel}, ${occasionLabel(event.occasion)}. ${planned ? 'Look planned' : 'No look planned yet'}`}
                    >
                      <Dateline date={event.date} month={presentation.monthLabel} day={presentation.dayLabel} />
                      <Text style={[styles.eventTitle, !largeText && styles.eventTitleTwoLine]} numberOfLines={2}>{event.title.trim()}</Text>
                      <Text style={styles.eventMeta} numberOfLines={largeText ? 2 : 1}>
                        {occasionLabel(event.occasion)} · <Text style={styles.eventWhen}>{when}</Text>
                      </Text>
                      {planned ? (
                        <View style={styles.plannedChip}>
                          <Ionicons name="checkmark" size={11} color={colors.inkSubtle} />
                          <Text style={styles.plannedChipText}>Planned</Text>
                        </View>
                      ) : (
                        <View style={styles.inlineLink}>
                          <Text style={styles.inlineLinkText}>Plan the look</Text>
                          <Ionicons name="arrow-forward" size={12} color={colors.action} />
                        </View>
                      )}
                    </PressableScale>
                  );
                })}
                <View style={{ width: SIDE_PAD }} />
              </ScrollView>
            ) : null}
          </View>
        )}
      </EditorialSection>

      {/* ── Wardrobe intelligence ─────────────────────────────────── */}
      <HomeWardrobeEdit
        onBriefPress={() => {
          track('shop_section_opened', { section: 'home_brief' });
          navigation.navigate('Shop', { screen: 'ShopMain', params: { view: 'for-you' } });
        }}
        shortlist={shortlist.awaitingDecision.length > 0 ? ({ header, cardStyle }) => (
          <ShortlistDecisionCard
            variant="row"
            header={header}
            contentStyle={cardStyle}
            items={shortlist.awaitingDecision}
            storeNames={shortlist.decisionStores}
            onPress={() => {
              track('shop_section_opened', { section: 'home_shortlist' });
              navigation.navigate('Shop', {
                screen: 'ShoppingGallery',
                params: { catalogFilter: 'active', returnTo: 'Home' },
              });
            }}
          />
        ) : undefined}
      />

      {/* ── Your Week in Wear ─────────────────────────────────────── */}
      {/*
        Keep the diary visible even when empty. The upper Today's wear row is
        the quick entry point; these tiles provide history and past-day logging.
      */}
      <EditorialSection
        variant="ruled"
        headingStyle="chapter"
        dividerPlacement="above-heading"
        title="Your Week in Wear"
      >
        <WearWeekStrip
          logs={logs}
          items={items}
          onLogToday={handleRecordWear}
          onLogDay={handleLogPastDay}
          onOpenEntry={setWearLogMenuEntry}
          disabled={deleteLog.isPending}
        />
      </EditorialSection>

      {/* ── Closet Insights ───────────────────────────────────────── */}
      {!itemsLoading && items.length > 0 ? (
        <EditorialSection
          variant="ruled"
          headingStyle="chapter"
          dividerPlacement="above-heading"
          title="Closet Insights"
          actionLabel={closetInsights.ready ? 'See all' : undefined}
          onAction={closetInsights.ready ? openClosetInsights : undefined}
        >
          <ClosetInsightsCard insights={closetInsights} currencyCode={homeCurrency} onPress={openClosetInsights} />
        </EditorialSection>
      ) : null}

    </Animated.ScrollView>
      {/* Status-bar chrome: content glides under a frosted band, not a hard crop. */}
      <View pointerEvents="none" style={[styles.chrome, { height: insets.top }]}>
        {reduceTransparency ? (
          <Animated.View style={[StyleSheet.absoluteFill, styles.chromeSolid, chromeTintStyle]} />
        ) : (
          <AnimatedBlurView
            animatedProps={chromeBlurProps}
            tint="systemThinMaterialLight"
            style={StyleSheet.absoluteFill}
            {...(Platform.OS === 'android' && { blurMethod: 'dimezisBlurViewSdk31Plus' as const })}
          />
        )}
        <Animated.View style={[styles.chromeRule, chromeRuleStyle]} />
      </View>
      <DailyLookDetailSheet
        visible={dailyLookSheetVisible && !!generatedCandidate}
        candidate={generatedCandidate}
        mode={dailyLookSheetMode}
        sessionKey={dailyLookSheetSession}
        items={items}
        saving={saveDailyLook.isPending}
        dismissing={dismissDailyLook.isPending}
        onClose={closeDailyLookSheet}
        onSave={handleDailyLookSave}
        onDismiss={handleDailyLookDismiss}
        onFindPiece={handleDailyLookFindPiece}
        onOpenItem={(id) => { pendingDailyItem.current = id; setDailyLookSheetVisible(false); }}
        onSheetDismissed={() => {
          const id = pendingDailyItem.current;
          if (id == null) return;
          pendingDailyItem.current = null;
          resumeDailyLook.current = true;
          navigation.navigate('Closet', { screen: 'ItemDetail', params: { itemId: id, returnTo: 'Home' } });
        }}
      />
      <ActionMenuSheet
        visible={wearLogMenuEntry !== null}
        title="Wear entry"
        subtitle={wearLogMenuEntry ? formatLogDate(wearLogMenuEntry.date) : undefined}
        options={wearLogMenuEntry ? [{
          label: 'Delete entry',
          subtitle: 'Remove it from your week in wear',
          icon: 'trash-outline',
          destructive: true,
          onPress: () => confirmDeleteLog(wearLogMenuEntry),
        }] : []}
        onClose={() => setWearLogMenuEntry(null)}
      />
      {locationSheetVisible && (
        <StylingLocationSheet
          visible
          activeLocation={stylingLocation.activeLocation}
          homeLocation={stylingLocation.homeLocation}
          override={stylingLocation.override}
          onSelectOverride={stylingLocation.setLocationOverride}
          permissionStatus={stylingLocation.permissionStatus}
          permissionCanAskAgain={stylingLocation.permissionCanAskAgain}
          onRequestCurrent={stylingLocation.requestCurrentLocation}
          onRefreshCurrent={stylingLocation.refreshCurrentLocation}
          onOpenSettings={Linking.openSettings}
          onClose={() => setLocationSheetVisible(false)}
        />
      )}
      <AiActionCoachmark
        visible={!!tour}
        title={tour ? HOME_TOUR_STEPS[tour.step].title : ''}
        body={tour ? HOME_TOUR_STEPS[tour.step].body : ''}
        step={tour?.step}
        stepCount={HOME_TOUR_STEPS.length}
        primaryLabel={tour && tour.step + 1 >= HOME_TOUR_STEPS.length ? 'Done' : 'Next'}
        onPrimary={advanceTour}
        onSkip={() => endTour('skip')}
        onDismiss={() => endTour('scrim')}
        spotlight={tour?.rect}
        style={tour ? tourCalloutPosition(tour.rect, width) : undefined}
        caretLeft={tour ? tourCaretLeft(tour.rect, width) : undefined}
        scrimAccessibilityLabel="Dismiss tour"
      />
    </View>
  );
}

/** Keeps the gap-edit hook's call shape stable while there is no gap (query disabled). */
const IDLE_GAP: StylistMissingEssential = { label: '', category: 'top', reason: '', context: '', priority: 0 };

const HOME_TOUR_STEPS: { key: HomeActionKey; title: string; body: string }[] = [
  { key: 'stylist', title: 'Your stylist', body: 'Ask for an outfit, a second opinion, or what to pack for a trip.' },
  { key: 'closet', title: 'Add to your closet', body: 'Snap or import pieces — we cut them out and tag them for you. Every look is styled from what you add.' },
  { key: 'wear', title: 'Log today’s outfit', body: 'Record what you wore. It sharpens tomorrow’s suggestions and fills your week in wear.' },
  { key: 'shop', title: 'Save a find', body: 'Spot something in a store? Snap it straight from here — we’ll save it to Shop and check how it works with your closet.' },
];
const TOUR_CALLOUT_WIDTH = 260;
const TOUR_EDGE = 16;

/** Callout sits below the disc, centred on it but kept inside the screen. */
function tourCalloutPosition(rect: { x: number; y: number; width: number; height: number }, screenWidth: number) {
  const centre = rect.x + rect.width / 2;
  const left = Math.min(Math.max(TOUR_EDGE, centre - TOUR_CALLOUT_WIDTH / 2), screenWidth - TOUR_EDGE - TOUR_CALLOUT_WIDTH);
  // Clears the disc's one-word caption so the label stays readable.
  return { top: rect.y + rect.height + 44, left, width: TOUR_CALLOUT_WIDTH };
}
function tourCaretLeft(rect: { x: number; y: number; width: number; height: number }, screenWidth: number) {
  return rect.x + rect.width / 2 - tourCalloutPosition(rect, screenWidth).left - 5;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: colors.background },
  root: { flex: 1, backgroundColor: colors.background },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  chromeSolid: { backgroundColor: colors.chromeTint },
  chromeRule: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
  skeletonGhostPill: {
    height: 52,
    marginHorizontal: SIDE_PAD,
    marginBottom: spacing.xl,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.ghostStroke,
  },
  content: {
    paddingHorizontal: SIDE_PAD,
    paddingBottom: spacing.xxxl * 2,
  },
  // An itinerary line between two hairlines, not a floating card.
  nextUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  nextUpDate: {
    minWidth: 44,
  },
  nextUpCopy: { flex: 1, gap: 2 },
  nextUpTitle: { ...typography.text.editorialCard, color: colors.foreground },
  nextUpSubtitle: { ...typography.text.meta, color: colors.mutedForeground },
  calendarStack: { gap: spacing.md },

  // Greeting
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerRowLarge: { flexDirection: 'column-reverse', alignItems: 'stretch' },
  greetingHeaderLarge: { flex: 0 },
  avatarLarge: { alignSelf: 'flex-end' },
  greetingHeader: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  avatarMonogram: {
    fontFamily: typography.family.editorialRegular,
    fontSize: 20,
    lineHeight: 24,
    color: colors.foreground,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: `${colors.primary}10`,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  weatherLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 3,
    paddingVertical: 2,
  },
  weatherLocationText: {
    flexShrink: 1,
  },

  // The two launchers read as a pair, then hand off to the first section.
  actionRow: { marginTop: spacing.md, marginBottom: spacing.sm },


  // Empty wardrobe nudge
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  nudgeIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nudgeText: { flex: 1, gap: 2 },
  nudgeTitle: {
    ...typography.text.label,
    color: colors.primary,
  },
  nudgeSub: {
    ...typography.text.caption,
    color: colors.mutedForeground,
  },

  // No events: a ruled line of copy with a way forward, not a grey box.
  calendarEmpty: {
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  calendarEmptyTitle: {
    ...typography.text.editorialItalic,
    color: colors.inkSubtle,
  },
  inlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingTop: 2,
  },
  inlineLinkText: {
    ...typography.text.caption,
    fontWeight: typography.weight.semibold,
    color: colors.action,
  },

  // Events carousel
  carousel: { marginHorizontal: -SIDE_PAD },
  carouselContent: { paddingHorizontal: SIDE_PAD, gap: COL_GAP },
  eventCard: {
    width: EVENT_COL_W, paddingBottom: spacing.xs, gap: spacing.xs,
  },
  // A magazine column rule between events — typography, not a container.
  eventColumnRule: {
    paddingLeft: COL_GAP,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  // A dateline, not an icon: the serif numeral is what makes the rail
  // scannable at a glance, the masthead above it says which day.
  dateline: { gap: 0, marginBottom: 2 },
  datelineCompact: { alignItems: 'flex-start' },
  datelineMastRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  datelineMast: {
    ...typography.text.masthead,
    letterSpacing: 1.6,
    color: colors.mutedForeground,
  },
  datelineMastToday: { color: colors.accentInk },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentInk,
  },
  datelineDay: {
    fontFamily: typography.family.editorialRegular,
    fontSize: 30,
    lineHeight: 36,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  datelineDayCompact: {
    fontSize: 26,
    lineHeight: 30,
  },
  eventTitle: {
    ...typography.text.editorialCard,
    color: colors.foreground,
  },
  // Titles always take their two lines, so the occasion and status rows sit
  // on shared baselines across columns whether or not a title wraps.
  eventTitleTwoLine: {
    minHeight: typography.text.editorialCard.lineHeight * 2,
  },
  eventMeta: {
    ...typography.text.caption,
    color: colors.mutedForeground,
  },
  eventWhen: {
    color: colors.accentInk,
  },
  plannedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.ghostStroke,
  },
  plannedChipText: {
    ...typography.text.caption,
    color: colors.inkSubtle,
  },

});
