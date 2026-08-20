import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Linking,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
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
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { ShortlistDecisionCard } from '../../components/shopping/ShortlistDecisionCard';
import { buildShoppingEditItems, mergeShoppingSnaps } from '../../lib/shoppingGallery';
import { buildShortlistSpotlight } from '../../lib/shortlistSpotlight';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { ResolvedOutfitCollage, type ResolvedOutfitSlot } from '../../components/outfits/ResolvedOutfitCollage';
import { useGlobalOutfitLogger } from '../../contexts/GlobalOutfitLoggerContext';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { useGlobalAddSheet } from '../../contexts/GlobalAddSheetContext';
import { useGlobalScan } from '../../contexts/GlobalScanContext';
import { useFabScroll } from '../../contexts/FabScrollContext';
import { useFocusEffect } from '@react-navigation/native';
import { useStylingWeatherToday } from '../../hooks/useWeather';
import { useActiveStylingLocation } from '../../hooks/useActiveStylingLocation';
import { useProfile } from '../../hooks/useProfile';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useDismissDailyLook, useResolveDailyLook, useSaveDailyLook, type DailyLookCandidate, type DailyLookResolveInput } from '../../hooks/useDailyLook';
import { DailyLookDetailSheet } from '../../components/home/DailyLookDetailSheet';
import { DailyLookCandidateVisual } from '../../components/home/DailyLookCandidateVisual';
import { StylingLocationSheet } from '../../components/home/StylingLocationSheet';
import { HomeBriefBand } from '../../components/home/HomeBriefBand';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { track } from '../../lib/analytics';
import { itemCoverPresentation } from '../../lib/itemImage';
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
import { colors, shadows, spacing, typography, radii, editorial } from '../../theme';
import { PressableScale } from '../../components/primitives/PressableScale';
import { ScreenHeader, EditorialSection } from '../../components/primitives/Editorial';
import { AppText } from '../../components/primitives/AppText';
import type { HomeScreenProps } from '../../navigation/types';
import type { Outfit } from '../../types/outfit';

// ── Constants ────────────────────────────────────────────────────────────────

const SIDE_PAD = spacing.lg;
const COL_GAP  = spacing.md;
const WEEK_TILE_SIZE = 104;

const WEATHER_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  sunny: 'sunny-outline',
  rainy: 'rainy-outline',
  cold:  'snow-outline',
  mild:  'partly-sunny-outline',
};

const OCCASION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  casual:       'cafe-outline',
  smart_casual: 'wine-outline',
  business:     'briefcase-outline',
  work:         'briefcase-outline',
  party:        'musical-notes-outline',
  formal:       'star-outline',
  workout:      'bicycle-outline',
  active:       'bicycle-outline',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const { isPremium } = useEntitlement();
  const { data: items = [], isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useItems();
  const { data: outfits = [], isLoading: outfitsLoading, isError: outfitsError, refetch: refetchOutfits } = useOutfits();
  const { data: events  = [] } = useEvents();
  const { data: logs    = [] } = useOutfitLogs();
  const { data: shoppingSnaps = [] } = useShoppingSnaps();
  const pendingShoppingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const deleteLog = useDeleteOutfitLog();
  const stylingLocation = useActiveStylingLocation();
  const weather = useStylingWeatherToday(stylingLocation.activeLocation);
  const { data: profile } = useProfile();
  const [locationSheetVisible, setLocationSheetVisible] = useState(false);

  const { openLogger } = useGlobalOutfitLogger();
  const { openStylist } = useGlobalAIStylist();
  const { openAddSheet } = useGlobalAddSheet();
  const { openScanItem, openBatchScan } = useGlobalScan();
  const { fabCollapsed } = useFabScroll();
  const insets = useSafeAreaInsets();
  const lastHomeScrollY = useRef(0);
  const fabIsCollapsed = useRef(false);
  const [dailyPickDate, setDailyPickDate] = useState(() => toLocalDateKey(new Date()));
  const [dailyPickHistory, setDailyPickHistory] = useState<DailyPickHistoryEntry[]>([]);
  const [dailyPickHistoryLoaded, setDailyPickHistoryLoaded] = useState(false);
  const [dailyLookSheetVisible, setDailyLookSheetVisible] = useState(false);
  const [savedDailyOutfit, setSavedDailyOutfit] = useState<Outfit | null>(null);
  const [savedDailyLookContext, setSavedDailyLookContext] = useState<SavedDailyLookContext | null>(null);
  const saveDailyLook = useSaveDailyLook();
  const dismissDailyLook = useDismissDailyLook();
  const shortlist = useMemo(
    () => buildShortlistSpotlight(buildShoppingEditItems(mergeShoppingSnaps(shoppingSnaps, pendingShoppingUploads))),
    [pendingShoppingUploads, shoppingSnaps],
  );

  useFocusEffect(useCallback(() => {
    fabIsCollapsed.current = false;
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

  const handleHomeScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const delta = y - lastHomeScrollY.current;
    lastHomeScrollY.current = y;
    if (y <= 10 || delta < -6) {
      if (fabIsCollapsed.current) {
        fabIsCollapsed.current = false;
        fabCollapsed.value = 0;
      }
    } else if (delta > 6) {
      if (!fabIsCollapsed.current) {
        fabIsCollapsed.current = true;
        fabCollapsed.value = 1;
      }
    }
  }, [fabCollapsed]);
  const { width } = useWindowDimensions();
  // Full-bleed: the hero runs edge to edge rather than sitting inset like the
  // rest of the page's cards, at the same portrait ratio outfit photography
  // uses everywhere else in the app.
  const heroWidth = width;
  const heroHeight = Math.round(heroWidth / editorial.outfitAspectRatio);

  // Tapping the row goes straight to the camera: photographing a piece is the
  // overwhelmingly common intent, and the old menu made every capture cost an
  // extra tap to answer a question it already knew. The other import routes stay
  // one press away on the row's ⋯ control (or a long-press).
  const handleQuickAddPhoto = useCallback(() => {
    track('home_wardrobe_action_tapped', { action: 'add_clothes_camera' });
    openScanItem('camera');
  }, [openScanItem]);

  const handleAddToCloset = useCallback(() => {
    track('home_wardrobe_action_tapped', { action: 'add_clothes_menu' });
    openAddSheet({
      onTakePhoto: () => openScanItem('camera'),
      onFromLibrary: () => openScanItem('library'),
      onBatchImport: openBatchScan,
    });
  }, [openAddSheet, openBatchScan, openScanItem]);

  const handleRecordWear = useCallback(() => {
    track('home_wardrobe_action_tapped', { action: 'record_wear' });
    openLogger({ quickStart: true });
  }, [openLogger]);

  // The rail's tiles are inside a horizontally-scrolling carousel, so a
  // swipe-to-delete gesture would fight the carousel's own pan — long-press
  // (already the row's other affordance elsewhere on this screen) plus a
  // confirm keeps deletion intentional without that conflict.
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
  const carouselEvents = useMemo(
    () => (showNextUpCard ? upcomingEvents.filter((event) => event.id !== nextUpEvent!.id) : upcomingEvents),
    [showNextUpCard, upcomingEvents, nextUpEvent],
  );

  const recentOutfits = useMemo(
    () => outfits
      .filter((outfit) => isCompleteWearableOutfit(outfit, items))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
    [items, outfits],
  );

  const profilePhotoUri = profile?.photoUrl ? resolveImageUri(profile.photoUrl) : undefined;
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
  const hasFeaturedAiImage = !!featuredOutfit?.aiGeneratedImageUrl;

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

  const handleDailyLookSave = useCallback(() => {
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
  }, [dailyLookContextRevision, dailyLookLocation, dailyPickHistory, dailyPickDate, events, generatedCandidate, items, outfits, saveDailyLook, user, weather.data]);

  const handleDailyLookDismiss = useCallback(() => {
    if (!generatedCandidate) return;
    dismissDailyLook.mutate(
      { candidateId: generatedCandidate.id },
      { onSuccess: () => setDailyLookSheetVisible(false) },
    );
  }, [dismissDailyLook, generatedCandidate]);

  const handleDailyLookFindPiece = useCallback(() => {
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
        priority: shoppingPriorityFromDailyLookGap(candidateGap),
      },
    });
  }, [candidateGap, generatedCandidate, navigation]);

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
          <SkeletonBlock width={220} height={32} borderRadius={6} />
          <SkeletonBlock width={150} height={16} borderRadius={4} />
        </View>
        <SkeletonBlock width={pillWidth} height={52} borderRadius={100} style={{ marginHorizontal: SIDE_PAD, marginBottom: spacing.xl }} />
        <View style={{ paddingHorizontal: SIDE_PAD, marginBottom: spacing.md }}>
          <SkeletonBlock width={120} height={16} borderRadius={4} />
        </View>
        <GarmentCardSkeleton count={4} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScroll={handleHomeScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.headerRow}>
        <ScreenHeader
          title={getGreeting(user?.displayName)}
          titleVariant="display"
          safeTop={false}
          style={styles.greetingHeader}
          subtitleNode={(
            <TouchableOpacity
              style={styles.weatherLocationButton}
              onPress={() => setLocationSheetVisible(true)}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel={locationAccessibilityLabel}
            >
              {weatherLocationIcon ? (
                <Ionicons name={weatherLocationIcon} size={13} color={colors.primary} />
              ) : null}
              <AppText variant="caption" tone="brand" style={styles.weatherLocationText} numberOfLines={1}>
                {weatherLocationLine}
              </AppText>
              <Ionicons name="chevron-down" size={13} color={colors.primary} />
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
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
          ) : (
            <Ionicons name="person-outline" size={17} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* ── AI Stylist fake input ─────────────────────────────── */}
      <TouchableOpacity
        style={styles.stylistPill}
        onPress={() => openStylist({
          source: 'home_prompt',
          onNavigateToCloset: (outfitId) => navigation.navigate('Closet', {
            screen: 'OutfitDetail',
            params: { outfitId, returnTo: 'Home' },
          }),
          onNavigateToShop: (gap?: StylistMissingEssential) => {
            if (!gap) return;
            navigation.navigate('Shop', { screen: 'ShoppingPriorityEdit', params: {
              priority: shoppingPriorityFromDailyLookGap(gap),
            }});
          },
        })}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open AI Stylist"
      >
        <Ionicons name="sparkles" size={16} color="#B08040" />
        <Text style={styles.stylistPillText} numberOfLines={1}>
          Ask your AI stylist... or type a question
        </Text>
        <Ionicons name="arrow-forward" size={16} color="#C2A68D" />
      </TouchableOpacity>

      {/* ── Permanent wardrobe actions ─────────────────────────── */}
      <View style={styles.wardrobeActions}>
        <PressableScale
          contentStyle={styles.wardrobeAction}
          onPress={handleQuickAddPhoto}
          onLongPress={handleAddToCloset}
          accessibilityRole="button"
          accessibilityLabel="Add new clothes. Opens the camera to photograph a piece"
          accessibilityHint="Long press for other ways to add clothes"
        >
          <View style={styles.wardrobeActionVisual}>
            <Ionicons name="shirt-outline" size={23} color={colors.primary} />
            <View style={styles.wardrobeActionBadge}>
              <Ionicons name="add" size={11} color={colors.primaryForeground} />
            </View>
          </View>
          <View style={styles.wardrobeActionCopy}>
            <Text style={styles.wardrobeActionTitle}>Add new clothes</Text>
            <Text style={styles.wardrobeActionSubtitle}>
              Photograph a piece, or tap ⋯ to import
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleAddToCloset}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            style={styles.wardrobeActionMore}
            accessibilityRole="button"
            accessibilityLabel="More ways to add clothes"
          >
            <Ionicons name="ellipsis-horizontal" size={17} color={colors.primary} />
          </TouchableOpacity>
        </PressableScale>
        <View style={styles.wardrobeActionDivider} />
        <PressableScale
          contentStyle={styles.wardrobeAction}
          onPress={handleRecordWear}
          accessibilityRole="button"
          accessibilityLabel="What did you wear? Snap a photo to match your closet, or choose pieces yourself"
        >
          <View style={[styles.wardrobeActionVisual, styles.wardrobeActionVisualWear]}>
            <Ionicons name="camera-outline" size={22} color={colors.primary} />
            <View style={styles.wardrobeActionBadge}>
              <Ionicons name="checkmark" size={10} color={colors.primaryForeground} />
            </View>
          </View>
          <View style={styles.wardrobeActionCopy}>
            <Text style={styles.wardrobeActionTitle}>What did you wear?</Text>
            <Text style={styles.wardrobeActionSubtitle}>
              Snap a photo to match your closet, or choose pieces yourself
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={17} color={colors.primary} />
        </PressableScale>
      </View>

      {/* ── Featured outfit ────────────────────────────────────── */}
      <EditorialSection
        variant="ruled"
        headingStyle="editorial"
        title={dailyLookPresentation.kind === 'priority' ? 'Today’s Priority' : 'Today’s Look'}
        actionLabel={dailyLookPresentation.kind === 'owned' || dailyLookPresentation.kind === 'ready' ? 'View all' : undefined}
        onAction={dailyLookPresentation.kind === 'owned' || dailyLookPresentation.kind === 'ready' ? () => navigation.navigate('Closet', {
          screen: 'ClosetMain',
          params: { segment: 'outfits' },
        }) : undefined}
      >
        {generatedCandidate ? (
          <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(200)}>
          <View style={styles.featuredOutfit}>
            <PressableScale
              contentStyle={styles.generatedHeroPressable}
              onPress={() => {
                track('daily_look_detail_opened', { candidateId: generatedCandidate.id });
                setDailyLookSheetVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${generatedCandidate.name}. ${generatedCandidate.reason}. Open details`}
            >
              <View style={{ width: heroWidth, height: candidateGap && generatedCandidate.readinessStatus === 'priority' ? Math.round(heroHeight * 0.72) : heroHeight }}>
                {candidateGap ? (
                  <DailyLookCandidateVisual
                    candidate={generatedCandidate}
                    gap={candidateGap}
                    items={items}
                    width={heroWidth}
                    height={generatedCandidate.readinessStatus === 'priority' ? Math.round(heroHeight * 0.72) : heroHeight}
                    borderRadius={0}
                  />
                ) : (
                  <OutfitCollage
                    outfit={generatedPreviewOutfit(generatedCandidate)}
                    size={heroWidth}
                    height={heroHeight}
                    borderRadius={0}
                  />
                )}
              </View>
            </PressableScale>
            <View style={styles.generatedCaption}>
              <View style={styles.generatedCaptionCopy}>
                <Text style={styles.featuredEyebrow} numberOfLines={1}>
                  {generatedCandidate.readinessStatus === 'incomplete'
                    ? 'One piece away'
                    : generatedCandidate.readinessStatus === 'priority'
                      ? 'Highest-impact wardrobe gap'
                      : 'Styled for you today'}
                </Text>
                <Text style={styles.featuredOutfitName} numberOfLines={1}>{generatedCandidate.name}</Text>
                <Text style={styles.generatedReason} numberOfLines={1}>{generatedCandidate.reason}</Text>
              </View>
              <PressableScale
                contentStyle={styles.saveLookControl}
                onPress={candidateGap ? handleDailyLookFindPiece : handleDailyLookSave}
                disabled={saveDailyLook.isPending}
                accessibilityRole="button"
                accessibilityLabel={candidateGap ? `Find ${candidateGap.label}, suggested and not in your closet` : 'Save look'}
                accessibilityHint={candidateGap ? 'Open a shopping edit for this missing piece' : 'Save this curated look to your outfits'}
              >
                <Ionicons name={candidateGap ? 'search-outline' : 'bookmark-outline'} size={17} color={colors.primary} />
                <Text style={styles.saveLookLabel}>{candidateGap ? `Find ${candidateGap.label.replaceAll('_', ' ')}` : 'Save look'}</Text>
              </PressableScale>
            </View>
          </View>
          </Animated.View>
        ) : featuredOutfit ? (
          <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(200)}>
          <PressableScale
            contentStyle={styles.featuredOutfit}
            onPress={() => navigation.navigate('Closet', {
              screen: 'OutfitDetail',
              params: { outfitId: featuredOutfit.id, returnTo: 'Home' },
            })}
            accessibilityRole="button"
            accessibilityLabel={featuredOutfit.name}
          >
            <View style={{ width: heroWidth, height: heroHeight }}>
              <OutfitCollage
                outfit={featuredOutfit}
                size={heroWidth}
                height={heroHeight}
                borderRadius={0}
              />
              {/*
                Scrim only over a real photo — the mosaic path renders a flat
                board and a dark-to-transparent ramp over a solid fill bands
                badly (same rule OutfitHero uses on the detail screen).
              */}
              {hasFeaturedAiImage && (
                <>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['transparent', 'rgba(29,27,24,0.34)']}
                    style={styles.heroScrim}
                  />
                  <View style={styles.heroCaptionOverlay}>
                    <Text style={styles.featuredEyebrowOverlay} numberOfLines={1}>{featuredReason}</Text>
                    <Text style={styles.featuredOutfitNameOverlay} numberOfLines={1}>{featuredOutfit.name}</Text>
                  </View>
                </>
              )}
            </View>
            {!hasFeaturedAiImage && (
              <View style={styles.featuredOutfitInfo}>
                <Text style={styles.featuredEyebrow} numberOfLines={1}>{featuredReason}</Text>
                <Text style={styles.featuredOutfitName} numberOfLines={1}>{featuredOutfit.name}</Text>
              </View>
            )}
          </PressableScale>
          </Animated.View>
        ) : dailyLookPresentation.kind === 'loading' ? (
          <View style={styles.curatingPlaceholder} accessibilityLiveRegion="polite">
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            <Text style={styles.curatingPlaceholderText}>Curating today’s look…</Text>
          </View>
        ) : (
          <View style={styles.emptyOutfits}>
            <View style={[styles.emptyOutfitIcon, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="layers-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyOutfitTitle}>
              {items.length === 0
                ? 'Your closet is ready for its first look'
                : outfits.length > 0
                  ? 'No suitable look for today'
                  : 'No saved outfits yet'}
            </Text>
            <Text style={styles.emptyOutfitSub}>
              {items.length === 0
                ? 'Add a few pieces to unlock personalized outfit suggestions.'
                : outfits.length > 0
                  ? 'Your stylist won’t force a combination that misses today’s needs.'
                  : 'Build an outfit from your closet to see it here'}
            </Text>
            {items.length === 0 && (
              <PressableScale
                contentStyle={styles.emptyOutfitButton}
                onPress={handleAddToCloset}
                accessibilityRole="button"
                accessibilityLabel="Add clothes to unlock outfit suggestions"
              >
                <Ionicons name="add" size={16} color={colors.primaryForeground} />
                <Text style={styles.emptyOutfitButtonText}>Add clothes</Text>
              </PressableScale>
            )}
          </View>
        )}
        {featuredExplanation ? (
          <View style={styles.dailyLookExplanation} accessible accessibilityLabel={`Why this look: ${featuredExplanation}`}>
            <Text style={styles.dailyLookExplanationLabel}>WHY THIS LOOK</Text>
            <Text style={styles.dailyLookExplanationText} numberOfLines={3}>{featuredExplanation}</Text>
          </View>
        ) : null}
      </EditorialSection>

      {/* ── Wardrobe brief ── */}
      <HomeBriefBand
        onPress={() => {
          track('shop_section_opened', { section: 'home_brief' });
          navigation.navigate('Shop', { screen: 'ShoppingBriefDetail' });
        }}
      />

      {/* ── Next up ── */}
      {shortlist.awaitingDecision.length > 0 ? (
        <ShortlistDecisionCard
          items={shortlist.awaitingDecision}
          storeNames={shortlist.decisionStores}
          style={styles.shortlistCard}
          onPress={() => {
            track('shop_section_opened', { section: 'home_shortlist' });
            navigation.navigate('Shop', {
              screen: 'ShoppingGallery',
              params: { catalogFilter: 'active', returnTo: 'Home' },
            });
          }}
        />
      ) : showNextUpCard ? (
        <PressableScale
          contentStyle={styles.nextUpCard}
          onPress={() => navigation.navigate('Calendar', { eventId: nextUpEvent!.id })}
          accessibilityRole="button"
          accessibilityLabel={`${nextUpEvent!.title}, ${formatEventDate(nextUpEvent!.date)}. Open in Calendar`}
        >
          <View style={styles.nextUpIcon}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.nextUpCopy}>
            <Text style={styles.nextUpEyebrow}>Next up</Text>
            <Text style={styles.nextUpTitle} numberOfLines={1}>{nextUpEvent!.title}</Text>
            <Text style={styles.nextUpSubtitle}>
              {nextUpEvent!.outfitId || (nextUpEvent!.itemIds?.length ?? 0) > 0 ? 'Your look is planned' : 'Plan a look for your next occasion'} · {formatEventDate(nextUpEvent!.date)}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={17} color={colors.primary} />
        </PressableScale>
      ) : null}

      {/* ── On the Calendar ───────────────────────────────────────── */}
      <EditorialSection
        variant="ruled"
        headingStyle="editorial"
        title="On the Calendar"
        actionLabel="View all"
        onAction={() => navigation.navigate('Calendar')}
      >
        {upcomingEvents.length === 0 ? (
          <PressableScale
            contentStyle={styles.emptyCard}
            onPress={() => navigation.navigate('Calendar')}
            accessibilityRole="button"
            accessibilityLabel="No upcoming events. Tap to add one"
          >
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={18} color={colors.mutedForeground} />
            </View>
            <View style={styles.emptyText}>
              <Text style={styles.emptyTitle}>No upcoming events</Text>
              <Text style={styles.emptySubtitle}>Add events to plan outfits ahead</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.border} />
          </PressableScale>
        ) : carouselEvents.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
          >
            {carouselEvents.map((event) => {
              const iconName = OCCASION_ICONS[event.occasion] ?? 'calendar-outline';
              const isToday = formatEventDate(event.date) === 'Today';
              return (
                <PressableScale
                  key={event.id}
                  contentStyle={[styles.eventCard, isToday && styles.eventCardToday]}
                  onPress={() => navigation.navigate('Calendar', { eventId: event.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${event.title}, ${formatEventDate(event.date)}`}
                >
                  <View style={[
                    styles.eventIcon,
                    { backgroundColor: isToday ? `${colors.primary}28` : `${colors.primary}18` },
                  ]}>
                    <Ionicons name={iconName} size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.eventTitle} numberOfLines={2}>{event.title.trim()}</Text>
                  <Text style={[styles.eventDate, isToday && styles.eventDateToday]}>
                    {formatEventDate(event.date)}
                  </Text>
                  <Text style={styles.eventOccasion}>
                    {event.occasion.replace('_', ' ')}
                  </Text>
                </PressableScale>
              );
            })}
            <View style={{ width: SIDE_PAD }} />
          </ScrollView>
        ) : null}
      </EditorialSection>

      {/* ── Your Week in Wear ─────────────────────────────────────── */}
      {logs.length > 0 && (
        <EditorialSection variant="ruled" headingStyle="editorial" title="Your Week in Wear">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
          >
            {logs.slice(0, 7).map((log) => {
              const logItems = (log.itemIds ?? [])
                .map((id) => items.find((it) => it.id === id))
                .filter((it): it is NonNullable<typeof it> => !!it);
              const slots: ResolvedOutfitSlot[] = logItems.map((item) => {
                const cover = itemCoverPresentation(item);
                return { key: String(item.id), uri: cover.uri, contentFit: cover.contentFit };
              });
              return (
                <PressableScale
                  key={log.id}
                  contentStyle={styles.weekTile}
                  onLongPress={() => confirmDeleteLog(log)}
                  disabled={deleteLog.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatLogDate(log.date)}, ${logItems.length} item${logItems.length !== 1 ? 's' : ''}`}
                  accessibilityHint="Long press to delete this entry"
                >
                  <ResolvedOutfitCollage
                    slots={slots}
                    size={WEEK_TILE_SIZE}
                    height={WEEK_TILE_SIZE}
                    borderRadius={radii.md}
                  />
                  <Text style={styles.weekTileDate} numberOfLines={1}>{formatLogDate(log.date)}</Text>
                </PressableScale>
              );
            })}
            <View style={{ width: SIDE_PAD }} />
          </ScrollView>
        </EditorialSection>
      )}

    </ScrollView>
      <DailyLookDetailSheet
        visible={dailyLookSheetVisible && !!generatedCandidate}
        candidate={generatedCandidate}
        items={items}
        saving={saveDailyLook.isPending}
        dismissing={dismissDailyLook.isPending}
        onClose={() => setDailyLookSheetVisible(false)}
        onSave={handleDailyLookSave}
        onDismiss={handleDailyLookDismiss}
        onFindPiece={handleDailyLookFindPiece}
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
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: SIDE_PAD,
    paddingBottom: spacing.xxxl * 2,
  },
  shortlistCard: { marginBottom: spacing.xl },
  nextUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  nextUpIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: `${colors.primary}15`,
  },
  nextUpCopy: { flex: 1, gap: 2 },
  nextUpEyebrow: { ...typography.text.eyebrow, color: colors.primary },
  nextUpTitle: { ...typography.text.cardTitle, color: colors.foreground },
  nextUpSubtitle: { ...typography.text.caption, color: colors.mutedForeground },

  // Greeting
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  greetingHeader: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  avatarBtn: {
    width: 36,
    height: 36,
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

  // AI Stylist fake-input pill
  stylistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  stylistPillText: {
    ...typography.text.body,
    flex: 1,
    color: colors.mutedForeground,
  },
  // Flat and quiet, deliberately: the fashion imagery below is what should
  // carry visual weight on this page, not the utility actions above it.
  wardrobeActions: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  wardrobeAction: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  wardrobeActionVisual: {
    width: 50,
    height: 50,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  wardrobeActionVisualWear: {
    backgroundColor: colors.accent,
  },
  wardrobeActionBadge: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    width: 17,
    height: 17,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardrobeActionCopy: {
    flex: 1,
    gap: 2,
  },
  wardrobeActionMore: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: `${colors.primary}0F`,
  },
  wardrobeActionTitle: {
    ...typography.text.cardTitle,
    color: colors.foreground,
  },
  wardrobeActionSubtitle: {
    ...typography.text.caption,
    color: colors.mutedForeground,
  },
  wardrobeActionDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg + 50 + spacing.md,
    backgroundColor: colors.border,
  },

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

  // Empty card (events / generic)
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { flex: 1, gap: 2 },
  emptyTitle: {
    ...typography.text.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  emptySubtitle: {
    ...typography.text.caption,
    color: colors.mutedForeground,
    opacity: 0.7,
  },

  // Events carousel
  carousel: { marginHorizontal: -SIDE_PAD },
  carouselContent: { paddingHorizontal: SIDE_PAD, gap: COL_GAP },
  eventCard: {
    width: 148,
    height: 152,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
    ...shadows.sm,
  },
  eventCardToday: {
    borderColor: `${colors.primary}40`,
    backgroundColor: `${colors.primary}05`,
  },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  eventTitle: {
    ...typography.text.cardTitle,
    color: colors.foreground,
  },
  eventDate: {
    ...typography.text.caption,
    color: colors.mutedForeground,
  },
  eventDateToday: {
    ...typography.text.caption,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  eventOccasion: {
    ...typography.text.caption,
    color: colors.primary,
    textTransform: 'capitalize',
    marginTop: 2,
  },

  // Today's Look hero — full-bleed against the screen's own SIDE_PAD inset,
  // at the app's portrait outfit ratio. No card chrome: it's meant to read
  // as a photograph, not a container.
  featuredOutfit: {
    marginHorizontal: -SIDE_PAD,
  },
  generatedHeroPressable: {
    width: '100%',
  },
  generatedCaption: {
    paddingHorizontal: SIDE_PAD,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  generatedCaptionCopy: {
    flex: 1,
    gap: 2,
  },
  generatedReason: {
    ...typography.text.caption,
    color: colors.mutedForeground,
  },
  saveLookControl: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  saveLookLabel: {
    ...typography.text.label,
    color: colors.primary,
  },
  curatingPlaceholder: {
    minHeight: 120,
    marginHorizontal: -SIDE_PAD,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
  },
  curatingPlaceholderText: {
    ...typography.text.bodySmall,
    color: colors.mutedForeground,
  },
  // Scrim + overlaid caption path — AI-generated flat lays only. See the
  // comment above where hasFeaturedAiImage is checked in the JSX.
  heroScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
  },
  heroCaptionOverlay: {
    position: 'absolute',
    left: SIDE_PAD,
    right: SIDE_PAD,
    bottom: spacing.lg,
    gap: 2,
  },
  featuredEyebrowOverlay: {
    ...typography.text.eyebrow,
    color: colors.white,
  },
  featuredOutfitNameOverlay: {
    ...typography.text.editorialTitle,
    color: colors.white,
  },
  // Caption-below-image path — the mosaic board, whose flat fill a scrim
  // would band against.
  featuredOutfitInfo: {
    gap: 2,
    paddingHorizontal: SIDE_PAD,
    paddingTop: spacing.md,
  },
  featuredEyebrow: {
    ...typography.text.eyebrow,
    color: colors.primary,
  },
  featuredOutfitName: {
    ...typography.text.editorialTitle,
    color: colors.foreground,
  },
  dailyLookExplanation: {
    gap: spacing.xs,
    marginHorizontal: SIDE_PAD,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dailyLookExplanationLabel: {
    ...typography.text.eyebrow,
    color: colors.mutedForeground,
  },
  dailyLookExplanationText: {
    ...typography.text.bodySmall,
    color: colors.mutedForeground,
  },

  // Empty outfits
  emptyOutfits: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyOutfitIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOutfitTitle: {
    ...typography.text.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    textAlign: 'center',
  },
  emptyOutfitSub: {
    ...typography.text.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 220,
  },
  emptyOutfitButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  emptyOutfitButtonText: { ...typography.text.label, color: colors.primaryForeground },

  // Your Week in Wear — a diary rail, not a receipt list. Long-press a tile
  // to delete (see confirmDeleteLog); a swipe gesture would fight this
  // ScrollView's own horizontal pan.
  weekTile: {
    width: WEEK_TILE_SIZE,
    gap: spacing.xs,
  },
  weekTileDate: {
    ...typography.text.caption,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
});
