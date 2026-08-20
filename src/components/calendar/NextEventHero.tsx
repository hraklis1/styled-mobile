import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEventWeatherForecast } from '../../hooks/useWeather';
import type { StylingLocationContext } from '../../lib/stylingLocation';
import { useTempUnit } from '../../hooks/useTempUnit';
import { formatTempRange } from '../../lib/temperature';
import { EventLookCollage } from './EventLookCollage';
import {
  OCCASIONS,
  formatDayLabel,
  formatCountdown,
  formatTime,
} from './calendarUtils';
import { colors, spacing, typography, radii, editorial } from '../../theme';
import type { Item } from '../../types/item';
import type { Event } from '../../types/event';
import type { Outfit } from '../../types/outfit';
import { getEventPlanActionLabel } from './calendarPlanning';
import { presentCalendarEvent } from './calendar-presentation';
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
}: {
  event: Event;
  allItems: Item[];
  outfit: Outfit | null;
  weatherFallback: StylingLocationContext | null;
  onPress: () => void;
  onPlanOutfit: () => void;
  onOpenOutfit: () => void;
  isPlanning: boolean;
}) {
  const { width: heroWidth } = useWindowDimensions();
  const heroHeight = Math.round(heroWidth / editorial.lifestyleAspectRatio);

  const forecast = useEventWeatherForecast(
    event.location,
    weatherFallback,
    event.date.slice(0, 10),
  );
  const tempUnit = useTempUnit();

  const d = new Date(event.date);
  const dayLabel = formatDayLabel(d);
  const countdown = formatCountdown(d) ?? (dayLabel === 'Today' || dayLabel === 'Tomorrow' ? dayLabel : null);
  const eyebrowLine = countdown ? `Up next · ${countdown}` : 'Up next';
  const occasionMeta = OCCASIONS.find((o) => o.id === event.occasion);
  const presentation = presentCalendarEvent(event);
  const hasOutfit = presentation.hasOutfit;
  const pieceCount = event.itemIds?.length ?? 0;
  // Only scrim a real photo — a flat mosaic (or the empty placeholder) has no
  // depth for a dark-to-transparent ramp to sit against and it bands. Same
  // rule Home's "Today's Look" hero uses.
  const scrimmed = !!outfit?.aiGeneratedImageUrl;

  const contextParts = [
    occasionMeta?.label,
    forecast.data ? formatTempRange(forecast.data, tempUnit) : null,
    event.location,
  ].filter((part): part is string => !!part);

  const openOutfitLabel = `${event.outfitId == null ? 'View details' : 'View outfit'} for ${event.title}, ${presentation.readinessLabel}, ${pieceCount} ${pieceCount === 1 ? 'piece' : 'pieces'}`;
  const openDetailLabel = `Next event: ${event.title}, ${presentation.readinessLabel}`;

  return (
    <View style={s.card}>
      {/*
        Two independent tap targets, unlike Home's single-pressable hero:
        the image opens the outfit (or the event, if none is planned yet)
        while the caption below always opens the event's own detail sheet.
      */}
      <PressableScale
        contentStyle={s.imageBand}
        onPress={hasOutfit ? onOpenOutfit : onPress}
        accessibilityRole="button"
        accessibilityLabel={hasOutfit ? openOutfitLabel : openDetailLabel}
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
                colors={['transparent', 'rgba(29,27,24,0.34)']}
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

      <PressableScale
        contentStyle={s.captionBlock}
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
          {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTime(d)}
        </Text>
        {contextParts.length > 0 && (
          <Text style={s.context} numberOfLines={1}>{contextParts.join(' · ')}</Text>
        )}
      </PressableScale>

      {!hasOutfit && (
        <View style={s.planRow}>
          <Text style={s.planHint} numberOfLines={2}>Styled will build a look from your wardrobe</Text>
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
            <Text style={s.planBtnText}>{isPlanning ? 'Styling…' : 'Ask Styled'}</Text>
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
  imageBand: { marginHorizontal: -spacing.lg },

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
  upNext: {
    ...typography.text.eyebrowLarge,
    color: colors.primary,
  },
  title: {
    ...typography.text.editorialCompact,
    color: colors.foreground,
  },
  meta: {
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },
  context: {
    ...typography.text.caption,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
    textTransform: 'capitalize',
  },

  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  planHint: {
    flex: 1,
    ...typography.text.caption,
    color: colors.mutedForeground,
  },
  planBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  planBtnDisabled: { opacity: 0.72 },
  planBtnText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.white },
});
