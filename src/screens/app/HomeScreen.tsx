import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useItems } from '../../hooks/useItems';
import { useOutfits } from '../../hooks/useOutfits';
import { useEvents } from '../../hooks/useEvents';
import { useOutfitLogs, useDeleteOutfitLog } from '../../hooks/useOutfitLogs';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { useGlobalOutfitLogger } from '../../contexts/GlobalOutfitLoggerContext';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { useWeatherToday } from '../../hooks/useWeather';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, shadows, spacing, typography, radii } from '../../theme';
import type { HomeScreenProps } from '../../navigation/types';

// ── Constants ────────────────────────────────────────────────────────────────

const SIDE_PAD = spacing.lg;
const COL_GAP  = spacing.md;

const STATIC_PLACEHOLDERS = [
  'What should I wear tonight?',
  'Style an outfit with my gray blazer…',
  'Something casual for a Sunday brunch?',
  'Smart-casual look for the office?',
  'Help me dress for a dinner party…',
  'Cozy weekend outfit ideas?',
];

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
  return name ? `${period}, ${name.split(' ')[0]}.` : `${period}.`;
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
  const { data: items   = [] } = useItems();
  const { data: outfits = [] } = useOutfits();
  const { data: events  = [] } = useEvents();
  const { data: logs    = [] } = useOutfitLogs();
  const deleteLog = useDeleteOutfitLog();
  const weather = useWeatherToday();

  const { openLogger } = useGlobalOutfitLogger();
  const { openStylist } = useGlobalAIStylist();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;

  // Stylist prompt
  const [query, setQuery] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // Derived data (must come before contextualPlaceholders which depends on upcomingEvents)
  const upcomingEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return events
      .filter((e) => { const d = new Date(e.date); d.setHours(0, 0, 0, 0); return d >= today; })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [events]);

  const contextualPlaceholders = useMemo(() => {
    const prompts: string[] = [];

    // Event-based prompts
    const [nextEvent, secondEvent] = upcomingEvents;
    if (nextEvent) {
      const when = formatEventDate(nextEvent.date) === 'Today' ? 'tonight'
        : formatEventDate(nextEvent.date) === 'Tomorrow' ? 'tomorrow' : '';
      prompts.push(`Style a look for ${nextEvent.title}${when ? ` ${when}` : ''}`);
    }
    if (secondEvent) {
      prompts.push(`What to wear for ${secondEvent.title}?`);
    }

    // Weather-based prompts
    if (weather.data) {
      const { condition, temperatureF } = weather.data.current;
      if (condition === 'rainy') {
        prompts.push("What's a good outfit for a rainy day?");
      } else if (condition === 'cold') {
        prompts.push(`Cozy layered look for ${temperatureF}°F weather`);
      } else if (condition === 'sunny') {
        prompts.push(`Light outfit for a sunny ${temperatureF}°F day`);
      } else {
        prompts.push(`Style tip for today's ${weather.data.current.summary.toLowerCase()} weather?`);
      }
    }

    return [...prompts, ...STATIC_PLACEHOLDERS];
  }, [upcomingEvents, weather.data]);

  useEffect(() => {
    const len = contextualPlaceholders.length;
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % len), 4000);
    return () => clearInterval(id);
  }, [contextualPlaceholders.length]);

  const handleStylistSubmit = () => {
    const q = query.trim();
    setQuery('');
    openStylist(q || undefined);
  };

  // Derived data
  const recentOutfits = useMemo(
    () => [...outfits]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
    [outfits],
  );

  const favoriteCount = items.filter((i) => i.isFavorite).length;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
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
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
            accessibilityLabel="Open settings"
          >
            <Ionicons name="settings-outline" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── AI Stylist prompt ──────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.promptCard}
        activeOpacity={0.9}
        onPress={handleStylistSubmit}
      >
        <View style={styles.promptInner}>
          <View style={styles.promptIconWrap}>
            <Ionicons name="sparkles" size={18} color="#FAF8F5" />
          </View>
          <TextInput
            ref={inputRef}
            style={styles.promptInput}
            value={query}
            onChangeText={setQuery}
            placeholder={contextualPlaceholders[placeholderIdx % contextualPlaceholders.length]}
            placeholderTextColor="rgba(250,248,245,0.45)"
            returnKeyType="send"
            onSubmitEditing={handleStylistSubmit}
            multiline={false}
          />
          {query.trim().length > 0 && (
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleStylistSubmit}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up" size={16} color={colors.primaryForeground} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.promptHint}>Ask your AI stylist anything</Text>
      </TouchableOpacity>

      {/* ── Empty wardrobe nudge ───────────────────────────────────── */}
      {items.length === 0 && (
        <TouchableOpacity
          style={styles.nudgeCard}
          onPress={() => navigation.navigate('Closet')}
          activeOpacity={0.8}
        >
          <View style={styles.nudgeIcon}>
            <Ionicons name="shirt-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.nudgeText}>
            <Text style={styles.nudgeTitle}>Your wardrobe is empty</Text>
            <Text style={styles.nudgeSub}>Add items to unlock outfit suggestions</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* ── Log Today's Look ─────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.logNudgeCard}
        onPress={openLogger}
        activeOpacity={0.8}
      >
        <View style={[styles.nudgeIcon, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="journal-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.nudgeText}>
          <Text style={styles.nudgeTitle}>Log today's look</Text>
          <Text style={styles.nudgeSub}>Track what you wear to keep your style history</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </TouchableOpacity>

      {/* ── Upcoming Events ───────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Calendar')}>
            <Text style={styles.sectionLink}>View all</Text>
          </TouchableOpacity>
        </View>

        {upcomingEvents.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => navigation.navigate('Calendar')}
            activeOpacity={0.8}
          >
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={18} color={colors.mutedForeground} />
            </View>
            <View style={styles.emptyText}>
              <Text style={styles.emptyTitle}>No upcoming events</Text>
              <Text style={styles.emptySubtitle}>Add events to plan outfits ahead</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.border} />
          </TouchableOpacity>
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
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, isToday && styles.eventCardToday]}
                  onPress={() => navigation.navigate('Calendar')}
                  activeOpacity={0.8}
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
                </TouchableOpacity>
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
            <TouchableOpacity onPress={openLogger}>
              <Text style={styles.sectionLink}>+ Log look</Text>
            </TouchableOpacity>
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
                              resizeMode="cover"
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
                  <TouchableOpacity
                    onPress={() => deleteLog.mutate(log.id)}
                    disabled={deleteLog.isPending}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.logDeleteBtn}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Recent Outfits ────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stylist Picks for Today</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Closet')}>
            <Text style={styles.sectionLink}>View all</Text>
          </TouchableOpacity>
        </View>

        {recentOutfits.length === 0 ? (
          <View style={styles.emptyOutfits}>
            <View style={[styles.emptyOutfitIcon, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="layers-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyOutfitTitle}>No saved outfits yet</Text>
            <Text style={styles.emptyOutfitSub}>
              Build an outfit from your wardrobe to see it here
            </Text>
          </View>
        ) : (
          <View style={styles.outfitGrid}>
            {recentOutfits.map((outfit) => (
              <TouchableOpacity
                key={outfit.id}
                style={[styles.outfitCard, { width: cardWidth }]}
                onPress={() => navigation.navigate('Closet')}
                activeOpacity={0.85}
              >
                <View style={styles.collageWrapper}>
                  <OutfitCollage outfit={outfit} size={cardWidth} />
                </View>
                <View style={styles.outfitInfo}>
                  <Text style={styles.outfitName} numberOfLines={1}>{outfit.name}</Text>
                  {outfit.event ? (
                    <Text style={styles.outfitEvent} numberOfLines={1}>{outfit.event}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
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
    marginBottom: spacing.lg,
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
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },
  headerMeta: {
    gap: 6,
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
    backgroundColor: colors.muted,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
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

  // Stylist prompt — hero card
  promptCard: {
    backgroundColor: '#2C2420',
    borderRadius: radii.lg + 2,
    borderWidth: 0,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    shadowColor: '#2C2420',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  promptInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  promptIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  promptInput: {
    flex: 1,
    fontSize: typography.size.md,
    color: '#FAF8F5',
    paddingVertical: 0,
  },
  sendButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  promptHint: {
    fontSize: typography.size.xs,
    color: 'rgba(250,248,245,0.65)',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
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
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
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
  outfitCard: {},
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
  outfitEvent: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
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

  // Log today's look nudge card
  logNudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },

  // Outfit log history
  logList: {
    gap: spacing.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 56,
    ...shadows.xs,
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
