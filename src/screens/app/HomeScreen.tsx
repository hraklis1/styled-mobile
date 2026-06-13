import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useItems } from '../../hooks/useItems';
import { SkeletonBlock } from '../../components/primitives/SkeletonLoader';
import { GarmentCardSkeleton } from '../../components/primitives/GarmentCardSkeleton';
import { ErrorState } from '../../components/primitives/ErrorState';
import { useOutfits } from '../../hooks/useOutfits';
import { useEvents } from '../../hooks/useEvents';
import { useOutfitLogs, useDeleteOutfitLog } from '../../hooks/useOutfitLogs';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { useGlobalOutfitLogger } from '../../contexts/GlobalOutfitLoggerContext';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { useGlobalAddSheet } from '../../contexts/GlobalAddSheetContext';
import { useGlobalScan } from '../../contexts/GlobalScanContext';
import { useFabScroll } from '../../contexts/FabScrollContext';
import { useFocusEffect } from '@react-navigation/native';
import { useWeatherToday } from '../../hooks/useWeather';
import { resolveImageUri } from '../../lib/resolveImageUri';
import {
  selectDailyStylistPick,
  toLocalDateKey,
  type DailyPickHistoryEntry,
} from '../../lib/dailyStylistPick';
import {
  loadDailyPickHistory,
  recordDailyPick,
  saveDailyPickHistory,
} from '../../lib/dailyPickHistory';
import { colors, shadows, spacing, typography, radii } from '../../theme';
import { PressableScale } from '../../components/primitives/PressableScale';
import type { HomeScreenProps } from '../../navigation/types';

// ── Constants ────────────────────────────────────────────────────────────────

const SIDE_PAD = spacing.lg;
const COL_GAP  = spacing.md;

const WEATHER_EMOJI: Record<string, string> = {
  sunny: '☀️',
  rainy: '🌧️',
  cold:  '❄️',
  mild:  '⛅',
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

function stripTempFromSummary(summary: string): string {
  return summary.replace(/\s+at\s+\d+°[CF]\.?/gi, '').replace(/\.$/, '');
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
  const { data: items = [], isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useItems();
  const { data: outfits = [], isLoading: outfitsLoading, isError: outfitsError, refetch: refetchOutfits } = useOutfits();
  const { data: events  = [] } = useEvents();
  const { data: logs    = [] } = useOutfitLogs();
  const deleteLog = useDeleteOutfitLog();
  const weather = useWeatherToday();

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

  useFocusEffect(useCallback(() => {
    fabIsCollapsed.current = false;
    fabCollapsed.value = 0;
    setDailyPickDate(toLocalDateKey(new Date()));
  }, [fabCollapsed]));

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
  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;
  const heroWidth = width - SIDE_PAD * 2;
  const heroHeight = Math.round(heroWidth * 0.78);

  const handleAddToCloset = useCallback(() => {
    openAddSheet({
      onTakePhoto: () => openScanItem('camera'),
      onFromLibrary: () => openScanItem('library'),
      onBatchImport: openBatchScan,
    });
  }, [openAddSheet, openBatchScan, openScanItem]);

  // Derived data
  const upcomingEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return events
      .filter((e) => { const d = new Date(e.date); d.setHours(0, 0, 0, 0); return d >= today; })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [events]);

  const recentOutfits = useMemo(
    () => [...outfits]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
    [outfits],
  );

  const favoriteCount = items.filter((i) => i.isFavorite).length;
  const dailyPick = useMemo(
    () => dailyPickHistoryLoaded
      ? selectDailyStylistPick({
        outfits,
        items,
        events,
        weather: weather.data,
        logs,
        date: dailyPickDate,
        history: dailyPickHistory,
      })
      : null,
    [dailyPickDate, dailyPickHistory, dailyPickHistoryLoaded, events, items, logs, outfits, weather.data],
  );
  const featuredOutfit = dailyPick?.outfit ?? recentOutfits[0];
  const featuredReason = dailyPick?.reason ?? 'Today’s edit';
  const remainingOutfits = recentOutfits.filter((outfit) => outfit.id !== featuredOutfit?.id).slice(0, 5);

  useEffect(() => {
    if (!dailyPickHistoryLoaded || !user?.id || !dailyPick?.outfit) return;
    const current = dailyPickHistory.find((entry) => entry.date === dailyPickDate);
    if (current?.outfitId === dailyPick.outfit.id) return;
    const next = recordDailyPick(dailyPickHistory, { date: dailyPickDate, outfitId: dailyPick.outfit.id });
    setDailyPickHistory(next);
    saveDailyPickHistory(user.id, next).catch(() => {});
  }, [dailyPick, dailyPickDate, dailyPickHistory, dailyPickHistoryLoaded, user?.id]);

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
      {/* ── Greeting ──────────────────────────────────────────────── */}
      <View style={styles.greetingSection}>
        <View style={styles.greetingRow}>
          <View style={styles.greetingText}>
            <Text style={styles.greeting}>{getGreeting(user?.displayName)}</Text>
            {(items.length > 0 || outfits.length > 0 || weather.data) ? (
              <View style={styles.headerMeta}>
                {weather.data && (
                  <Text style={styles.weatherLine}>
                    {WEATHER_EMOJI[weather.data.current.condition] ?? '🌡️'}{' '}
                    {weather.data.current.temperatureC}°C,{' '}
                    {stripTempFromSummary(weather.data.current.summary)} · ↑{weather.data.forecast.tempMaxC}° ↓{weather.data.forecast.tempMinC}°
                    {weather.data.current.locationLabel ? ` · 📍 ${weather.data.current.locationLabel}` : ''}
                  </Text>
                )}
                <View style={styles.chipsRow}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  {favoriteCount > 0 && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{favoriteCount} favourited</Text>
                    </View>
                  )}
                  {outfits.length > 0 && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>
                        {outfits.length} {outfits.length === 1 ? 'outfit' : 'outfits'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <Text style={styles.greetingSubtitle}>Your style, at a glance.</Text>
            )}
          </View>
          <PressableScale
            contentStyle={styles.settingsBtn}
            onPress={() => navigation.navigate('Shop')}
            accessibilityRole="button"
            accessibilityLabel="Open shop wishlist"
          >
            <Ionicons name="bag-handle-outline" size={20} color={colors.mutedForeground} />
          </PressableScale>
        </View>
      </View>

      {/* ── AI Stylist fake input ─────────────────────────────── */}
      <TouchableOpacity
        style={styles.stylistPill}
        onPress={() => openStylist({ source: 'home_prompt' })}
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

      {/* ── Featured outfit ────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stylist Picks for Today</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Closet', {
              screen: 'ClosetMain',
              params: { segment: 'outfits' },
            })}
            accessibilityRole="button"
            accessibilityLabel="View all outfits"
          >
            <Text style={styles.sectionLink}>View all</Text>
          </TouchableOpacity>
        </View>

        {featuredOutfit ? (
          <>
            <PressableScale
              contentStyle={styles.featuredOutfit}
              onPress={() => navigation.navigate('Closet', {
                screen: 'OutfitDetail',
                params: { outfitId: featuredOutfit.id },
              })}
              accessibilityRole="button"
              accessibilityLabel={featuredOutfit.name}
            >
              <OutfitCollage
                outfit={featuredOutfit}
                size={heroWidth}
                height={heroHeight}
                borderRadius={radii.lg}
              />
              <View style={styles.featuredOutfitInfo}>
                <View style={styles.featuredOutfitCopy}>
                  <Text style={styles.featuredEyebrow} numberOfLines={1}>{featuredReason}</Text>
                  <Text style={styles.featuredOutfitName} numberOfLines={1}>{featuredOutfit.name}</Text>
                </View>
                <View style={styles.featuredArrow}>
                  <Ionicons name="arrow-forward" size={16} color={colors.primaryForeground} />
                </View>
              </View>
            </PressableScale>

          </>
        ) : (
          <View style={styles.emptyOutfits}>
            <View style={[styles.emptyOutfitIcon, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="layers-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyOutfitTitle}>No saved outfits yet</Text>
            <Text style={styles.emptyOutfitSub}>
              Build an outfit from your wardrobe to see it here
            </Text>
          </View>
        )}
      </View>

      {/* ── Quick creation actions ─────────────────────────────── */}
      <View style={styles.quickActions}>
        <PressableScale
          style={styles.quickActionPressable}
          contentStyle={styles.quickAction}
          onPress={handleAddToCloset}
          accessibilityRole="button"
          accessibilityLabel="Add to closet"
        >
          <View style={styles.quickActionIcon}>
            <Ionicons name="add" size={18} color={colors.primary} />
          </View>
          <Text style={styles.quickActionText}>Add to closet</Text>
        </PressableScale>
        <PressableScale
          style={styles.quickActionPressable}
          contentStyle={styles.quickAction}
          onPress={openLogger}
          accessibilityRole="button"
          accessibilityLabel="Log today's look"
        >
          <View style={styles.quickActionIcon}>
            <Ionicons name="journal-outline" size={17} color={colors.primary} />
          </View>
          <Text style={styles.quickActionText}>Log today’s look</Text>
        </PressableScale>
      </View>

      {remainingOutfits.length > 0 && (
        <View style={[styles.outfitGrid, styles.secondaryOutfitGrid]}>
          {remainingOutfits.map((outfit) => (
            <PressableScale
              key={outfit.id}
              contentStyle={[styles.outfitCard, { width: cardWidth }]}
              onPress={() => navigation.navigate('Closet', {
                screen: 'OutfitDetail',
                params: { outfitId: outfit.id },
              })}
              accessibilityRole="button"
              accessibilityLabel={outfit.name}
            >
              <View style={styles.collageWrapper}>
                <OutfitCollage outfit={outfit} size={cardWidth} />
              </View>
              <View style={styles.outfitInfo}>
                <Text style={styles.outfitName} numberOfLines={1}>{outfit.name}</Text>
              </View>
            </PressableScale>
          ))}
        </View>
      )}

      {/* ── Empty wardrobe nudge ───────────────────────────────────── */}
      {items.length === 0 && (
        <PressableScale
          contentStyle={styles.nudgeCard}
          onPress={handleAddToCloset}
          accessibilityRole="button"
          accessibilityLabel="Your wardrobe is empty. Tap to add items"
        >
          <View style={styles.nudgeIcon}>
            <Ionicons name="shirt-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.nudgeText}>
            <Text style={styles.nudgeTitle}>Your wardrobe is empty</Text>
            <Text style={styles.nudgeSub}>Add items to unlock outfit suggestions</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </PressableScale>
      )}

      {/* ── Upcoming Events ───────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Calendar')} accessibilityRole="button" accessibilityLabel="View all events">
            <Text style={styles.sectionLink}>View all</Text>
          </TouchableOpacity>
        </View>

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
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
          >
            {upcomingEvents.map((event) => {
              const iconName = OCCASION_ICONS[event.occasion] ?? 'calendar-outline';
              const isToday = formatEventDate(event.date) === 'Today';
              return (
                <PressableScale
                  key={event.id}
                  contentStyle={[styles.eventCard, isToday && styles.eventCardToday]}
                  onPress={() => navigation.navigate('Calendar')}
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
        )}
      </View>

      {/* ── Outfit Log History ───────────────────────────────────── */}
      {logs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Outfit Log</Text>
          </View>

          <View style={styles.logList}>
            {logs.slice(0, 5).map((log) => {
              const logItems = (log.itemIds ?? [])
                .map((id) => items.find((it) => it.id === id))
                .filter((it): it is NonNullable<typeof it> => !!it);
              return (
                <View key={log.id} style={styles.logRow}>
                  {/* Stacked thumbnails */}
                  <View style={styles.logThumbs}>
                    {logItems.slice(0, 4).map((item, idx) => {
                      const imgUri = resolveImageUri(item.imageUrl);
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.logThumb,
                            { marginLeft: idx > 0 ? -10 : 0, zIndex: 4 - idx },
                          ]}
                        >
                          {imgUri ? (
                            <Image
                              source={{ uri: imgUri }}
                              style={StyleSheet.absoluteFill}
                              contentFit="cover"
                              transition={150}
                            />
                          ) : (
                            <Ionicons name="shirt-outline" size={12} color={colors.mutedForeground} />
                          )}
                        </View>
                      );
                    })}
                    {logItems.length > 4 && (
                      <View style={[styles.logThumb, styles.logThumbMore, { marginLeft: -10 }]}>
                        <Text style={styles.logThumbMoreText}>+{logItems.length - 4}</Text>
                      </View>
                    )}
                  </View>

                  {/* Date + count */}
                  <View style={styles.logInfo}>
                    <Text style={styles.logDate}>{formatLogDate(log.date)}</Text>
                    <Text style={styles.logCount}>
                      {log.itemIds?.length ?? 0} item{(log.itemIds?.length ?? 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>

                  {/* Delete */}
                  <PressableScale
                    onPress={() => deleteLog.mutate(log.id)}
                    disabled={deleteLog.isPending}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    contentStyle={styles.logDeleteBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete outfit log for ${formatLogDate(log.date)}`}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
                  </PressableScale>
                </View>
              );
            })}
          </View>
        </View>
      )}

    </ScrollView>
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

  // Greeting
  greetingSection: {
    marginBottom: spacing.md,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  greetingText: {
    flex: 1,
    gap: 4,
  },
  greeting: {
    fontSize: typography.size.xl + 4,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },
  headerMeta: {
    gap: spacing.xs,
  },
  weatherLine: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    paddingRight: spacing.sm,
  },
  chipText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },
  settingsBtn: {
    padding: spacing.sm,
    marginTop: 2,
  },

  // AI Stylist fake-input pill
  stylistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#EBE7E0',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginBottom: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 5,
  },
  stylistPillText: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.mutedForeground,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  quickActionPressable: {
    flex: 1,
  },
  quickAction: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
  },
  quickActionIcon: {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  quickActionText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  nudgeSub: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },

  // Sections
  section: { marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  sectionLink: {
    fontSize: typography.size.xs,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  emptySubtitle: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    opacity: 0.7,
  },

  // Events carousel
  carousel: { marginHorizontal: -SIDE_PAD },
  carouselContent: { paddingHorizontal: SIDE_PAD, gap: COL_GAP },
  eventCard: {
    width: 148,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    lineHeight: typography.size.sm * 1.35,
  },
  eventDate: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  eventDateToday: {
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  eventOccasion: {
    fontSize: 10,
    color: colors.primary,
    textTransform: 'capitalize',
    marginTop: 2,
  },

  // Outfits grid
  outfitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COL_GAP,
  },
  secondaryOutfitGrid: {
    marginBottom: spacing.xl,
  },
  featuredOutfit: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  featuredOutfitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  featuredOutfitCopy: {
    flex: 1,
    gap: 2,
  },
  featuredEyebrow: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  featuredOutfitName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  featuredArrow: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitCard: {
    borderRadius: radii.md,
    // Shadow on outer card so overflow:hidden on inner wrapper doesn't clip it
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  collageWrapper: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  outfitInfo: {
    paddingTop: spacing.md,
    paddingHorizontal: 2,
    gap: 2,
  },
  outfitName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    textAlign: 'center',
  },
  emptyOutfitSub: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 220,
    lineHeight: typography.size.xs * 1.5,
  },

  // Outfit log history
  logList: {
    gap: spacing.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 56,
  },
  logThumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  logThumb: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logThumbMore: {
    backgroundColor: colors.secondary,
  },
  logThumbMoreText: {
    fontSize: 9,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
  },
  logInfo: {
    flex: 1,
    gap: 2,
  },
  logDate: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  logCount: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  logDeleteBtn: {
    padding: spacing.xs,
    flexShrink: 0,
  },

});
