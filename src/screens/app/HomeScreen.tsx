import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useItems } from '../../hooks/useItems';
import { useOutfits } from '../../hooks/useOutfits';
import { useEvents } from '../../hooks/useEvents';
import { OutfitCollage } from '../../components/outfits/OutfitCollage';
import { colors, spacing, typography, radii } from '../../theme';
import type { HomeScreenProps } from '../../navigation/types';

// ── Constants ────────────────────────────────────────────────────────────────

const SIDE_PAD = spacing.lg;
const COL_GAP  = spacing.md;

const PLACEHOLDERS = [
  'What should I wear tonight?',
  'Style an outfit with my gray blazer…',
  'Something casual for a Sunday brunch?',
  'Smart-casual look for the office?',
  'Help me dress for a dinner party…',
  'Cozy weekend outfit ideas?',
];

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

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const { data: items   = [] } = useItems();
  const { data: outfits = [] } = useOutfits();
  const { data: events  = [] } = useEvents();

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = (width - SIDE_PAD * 2 - COL_GAP) / 2;

  // Stylist prompt
  const [query, setQuery] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(id);
  }, []);

  const handleStylistSubmit = () => {
    const q = query.trim();
    setQuery('');
    navigation.navigate('Stylist', { query: q });
  };

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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Greeting ──────────────────────────────────────────────── */}
      <View style={styles.greetingSection}>
        <Text style={styles.greeting}>{getGreeting(user?.displayName)}</Text>
        {(items.length > 0 || outfits.length > 0) ? (
          <Text style={styles.stats}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
            {favoriteCount > 0 ? ` · ${favoriteCount} favourited` : ''}
            {outfits.length > 0 ? ` · ${outfits.length} ${outfits.length === 1 ? 'outfit' : 'outfits'}` : ''}
          </Text>
        ) : (
          <Text style={styles.greetingSubtitle}>Your style, at a glance.</Text>
        )}
      </View>

      {/* ── AI Stylist prompt ──────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.promptCard}
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
      >
        <View style={styles.promptInner}>
          <View style={[styles.promptIconWrap, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </View>
          <TextInput
            ref={inputRef}
            style={styles.promptInput}
            value={query}
            onChangeText={setQuery}
            placeholder={PLACEHOLDERS[placeholderIdx]}
            placeholderTextColor={colors.mutedForeground}
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
          onPress={() => navigation.navigate('Wardrobe')}
          activeOpacity={0.8}
        >
          <View style={styles.nudgeIcon}>
            <Ionicons name="shirt-outline" size={18} color="#92620a" />
          </View>
          <View style={styles.nudgeText}>
            <Text style={styles.nudgeTitle}>Your wardrobe is empty</Text>
            <Text style={styles.nudgeSub}>Add items to unlock outfit suggestions</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#c8922a" />
        </TouchableOpacity>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('Wardrobe')}
          activeOpacity={0.8}
        >
          <View style={[styles.quickIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="shirt-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.quickLabel}>Wardrobe</Text>
          <Text style={styles.quickSub}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('Outfits')}
          activeOpacity={0.8}
        >
          <View style={[styles.quickIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="layers-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.quickLabel}>Outfits</Text>
          <Text style={styles.quickSub}>
            {outfits.length === 0 ? 'None yet' : `${outfits.length} saved`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('Calendar')}
          activeOpacity={0.8}
        >
          <View style={[styles.quickIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.quickLabel}>Calendar</Text>
          <Text style={styles.quickSub}>
            {upcomingEvents.length === 0 ? 'No events' : `${upcomingEvents.length} upcoming`}
          </Text>
        </TouchableOpacity>
      </View>

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
                  <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
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

      {/* ── Recent Outfits ────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Outfits</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Outfits')}>
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
                onPress={() => navigation.navigate('Outfits')}
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
  stats: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },

  // Stylist prompt
  promptCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg + 2,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  promptInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
  },
  promptInput: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.foreground,
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
    color: colors.mutedForeground,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    opacity: 0.7,
  },

  // Empty wardrobe nudge
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#fffbeb',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  nudgeIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nudgeText: { flex: 1, gap: 2 },
  nudgeTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: '#92620a',
  },
  nudgeSub: {
    fontSize: typography.size.xs,
    color: '#b87b22',
  },

  // Quick actions — 3 equal cards
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  quickCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 3,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  quickSub: {
    fontSize: 10,
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
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
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
    paddingTop: spacing.sm,
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
});
