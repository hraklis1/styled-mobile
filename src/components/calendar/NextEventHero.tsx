import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEventWeatherForecast } from '../../hooks/useWeather';
import type { StylingLocationContext } from '../../lib/stylingLocation';
import { useTempUnit } from '../../hooks/useTempUnit';
import { formatTempRange } from '../../lib/temperature';
import { EventLookCollage } from './EventLookCollage';
import {
  formatTime,
} from './calendarUtils';
import { colors, spacing, typography, radii, editorial } from '../../theme';
import type { Item } from '../../types/item';
import type { Event } from '../../types/event';
import type { Outfit } from '../../types/outfit';
import { eventDayKey } from './calendarAgenda';
import { getEventPlanActionLabel } from './calendarPlanning';
import { presentCalendarEvent, occasionDisplayLabel } from './calendar-presentation';
import { PressableScale } from '../primitives/PressableScale';

export function NextEventHero({
  event,
  allItems,
  weatherFallback,
  onPress,
  onPlanOutfit,
  onOpenOutfit,
  isPlanning,
  outfit,
  highlighted = false,
}: {
  event: Event;
  allItems: Item[];
  outfit: Outfit | null;
  weatherFallback: StylingLocationContext | null;
  onPress: () => void;
  onPlanOutfit: () => void;
  onOpenOutfit: () => void;
  isPlanning: boolean;
  highlighted?: boolean;
}) {
  const { width: heroWidth } = useWindowDimensions();
  const heroHeight = Math.round(heroWidth / editorial.lifestyleAspectRatio * 0.75);

  const forecast = useEventWeatherForecast(
    event.location,
    weatherFallback,
    eventDayKey(event),
  );
  const tempUnit = useTempUnit();

  const d = event.calendarMetadata?.allDay
    ? new Date(`${eventDayKey(event)}T12:00:00`)
    : new Date(event.date);
  const eyebrowLine = 'Up next';
  const presentation = presentCalendarEvent(event);
  const hasOutfit = presentation.hasOutfit;
  const pieceCount = event.itemIds?.length ?? 0;
  // Only scrim a real photo — a flat mosaic has no
  // depth for a dark-to-transparent ramp to sit against and it bands. Same
  // rule Home's "Today's Look" hero uses.
  const scrimmed = hasOutfit && !!outfit?.aiGeneratedImageUrl;

  const contextParts = [
    occasionDisplayLabel(event.occasion),
    forecast.data ? formatTempRange(forecast.data, tempUnit) : null,
  ].filter((part): part is string => !!part);

  const openOutfitLabel = `${event.outfitId == null ? 'View details' : 'View outfit'} for ${event.title}, ${presentation.readinessLabel}, ${pieceCount} ${pieceCount === 1 ? 'piece' : 'pieces'}`;
  const openDetailLabel = `Next event: ${event.title}, ${presentation.readinessLabel}`;

  return (
    <View style={s.card}>
      {/* Planned imagery opens the outfit; its caption opens event details. */}
      {hasOutfit && (
        <PressableScale
          contentStyle={s.imageBand}
          onPress={onOpenOutfit}
          accessibilityRole="button"
          accessibilityLabel={openOutfitLabel}
        >
          <View style={{ width: heroWidth, height: heroHeight }}>
            <EventLookCollage
              itemIds={event.itemIds ?? []}
              allItems={allItems}
              outfit={outfit}
              size={heroWidth}
              height={heroHeight}
              borderRadius={0}
            />
            {scrimmed && (
              <>
                <LinearGradient
                  pointerEvents="none"
                  colors={['transparent', 'rgba(29,27,24,0.64)']}
                  style={s.heroScrim}
                />
                <View style={s.heroCaptionOverlay}>
                  <Text style={s.upNextOverlay} numberOfLines={1}>{eyebrowLine}</Text>
                  <Text style={s.titleOverlay} numberOfLines={2}>{event.title}</Text>
                </View>
              </>
            )}
          </View>
        </PressableScale>
      )}

      <PressableScale
        contentStyle={[s.captionBlock, highlighted && s.captionHighlight]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={openDetailLabel}
      >
        {!scrimmed && (
          <>
            <Text style={s.upNext} numberOfLines={1}>{eyebrowLine}</Text>
            <Text style={s.title} numberOfLines={2}>{event.title}</Text>
          </>
        )}
        <Text style={s.meta}>
          {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {event.calendarMetadata?.allDay ? 'All day' : formatTime(d)}
        </Text>
        {event.location ? <Text style={s.location} numberOfLines={2}>{event.location}</Text> : null}
        {contextParts.length > 0 && (
          <Text style={s.context} numberOfLines={2}>{contextParts.join(' · ')}</Text>
        )}
      </PressableScale>

      {!hasOutfit && (
        <View style={s.planRow}>
          <Text style={s.planHint}>A look from your wardrobe, ready for this occasion.</Text>
          <PressableScale
            contentStyle={[s.planBtn, isPlanning && s.planBtnDisabled]}
            onPress={onPlanOutfit}
            disabled={isPlanning}
            accessibilityRole="button"
            accessibilityLabel={isPlanning
              ? `Styling an outfit for ${event.title}`
              : `${getEventPlanActionLabel(false)} for ${event.title}`}
            accessibilityState={{ disabled: isPlanning, busy: isPlanning }}
          >
            {isPlanning ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="sparkles-outline" size={14} color={colors.white} />
            )}
            <Text style={s.planBtnText}>{isPlanning ? 'Styling…' : 'Plan my look'}</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { marginBottom: spacing.xl },

  // Full-bleed against the screen's own side padding, at the app's landscape
  // lifestyle ratio. No card chrome: it's meant to read as a photograph, not
  // a container — the same treatment Home gives "Today's Look".
  imageBand: { marginHorizontal: -spacing.page },

  heroScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  heroCaptionOverlay: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    gap: 2,
  },
  upNextOverlay: {
    ...typography.text.eyebrowLarge,
    color: colors.white,
  },
  titleOverlay: {
    ...typography.text.editorialCompact,
    color: colors.white,
  },

  captionBlock: {
    paddingTop: spacing.md,
    gap: 3,
  },
  captionHighlight: {
    marginHorizontal: -spacing.page,
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surfaceSelected,
  },
  upNext: {
    ...typography.text.eyebrowLarge,
    color: colors.primary,
  },
  title: {
    ...typography.text.editorialCompact,
    color: colors.foreground,
  },
  meta: {
    ...typography.text.meta, color: colors.foreground,
  },
  location: { ...typography.text.caption, color: colors.mutedForeground },
  context: {
    ...typography.text.caption,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },

  planRow: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  planHint: {
    ...typography.text.caption,
    color: colors.mutedForeground,
  },
  planBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.primary, borderRadius: radii.action, minHeight: 52, paddingHorizontal: spacing.page, paddingVertical: 14,
  },
  planBtnDisabled: { opacity: 0.72 },
  planBtnText: {
    ...typography.text.label, color: colors.primaryForeground,
  },
});
