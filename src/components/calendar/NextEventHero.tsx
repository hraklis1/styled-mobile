import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEventWeatherForecast } from '../../hooks/useWeather';
import type { StylingLocationContext } from '../../lib/stylingLocation';
import { useTempUnit } from '../../hooks/useTempUnit';
import { formatTempRange } from '../../lib/temperature';
import { EventLookCollage } from './EventLookCollage';
import { formatTime, toDateStr } from './calendarUtils';
import { colors, spacing, typography, radii } from '../../theme';
import type { Item } from '../../types/item';
import type { Event } from '../../types/event';
import type { Outfit } from '../../types/outfit';
import { eventDayKey } from './calendarAgenda';
import { getEventPlanActionLabel } from './calendarPlanning';
import { presentCalendarEvent, occasionDisplayLabel, heroCountdown, heroWeatherNote, WEATHER_ICONS } from './calendar-presentation';
import { PressableScale } from '../primitives/PressableScale';

const CARD_PADDING = spacing.lg;

function HeroButton({
  label,
  icon,
  onPress,
  variant,
  disabled,
  busy,
  accessibilityLabel,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant: 'primary' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel: string;
}) {
  const primary = variant === 'primary';
  return (
    <PressableScale
      style={s.buttonOuter}
      contentStyle={[s.button, primary ? s.buttonPrimary : s.buttonGhost, disabled && s.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={primary ? colors.primaryForeground : colors.foreground} />
      ) : (
        <Ionicons name={icon} size={15} color={primary ? colors.primaryForeground : colors.foreground} />
      )}
      <Text style={[s.buttonText, primary && s.buttonTextPrimary]}>{label}</Text>
    </PressableScale>
  );
}

export function NextEventHero({
  event,
  allItems,
  weatherFallback,
  onPress,
  onPlanOutfit,
  onOpenOutfit,
  onWear,
  worn = false,
  isWearing = false,
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
  /** Logs the planned look as worn. Offered only on the event's own day. */
  onWear?: () => void;
  worn?: boolean;
  isWearing?: boolean;
  isPlanning: boolean;
  highlighted?: boolean;
}) {
  const { width } = useWindowDimensions();
  const collageWidth = width - spacing.page * 2 - CARD_PADDING * 2;
  const collageHeight = Math.round(collageWidth * 0.75);

  const day = eventDayKey(event);
  const forecast = useEventWeatherForecast(event.location, weatherFallback, day);
  const tempUnit = useTempUnit();

  const allDay = !!event.calendarMetadata?.allDay;
  const presentation = presentCalendarEvent(event);
  const hasOutfit = presentation.hasOutfit;
  const pieceCount = event.itemIds?.length ?? 0;
  const isToday = day === toDateStr(new Date());
  const countdown = heroCountdown(event);

  // One meta line instead of chips: the overline already says when.
  const meta = [
    allDay ? null : formatTime(new Date(event.date)),
    occasionDisplayLabel(event.occasion),
    forecast.data ? formatTempRange(forecast.data, tempUnit) : null,
  ].filter(Boolean).join(' · ');
  // Only weather worth acting on earns a sentence.
  const weatherNote = heroWeatherNote(forecast.data, tempUnit);

  return (
    <View style={s.card}>
      {hasOutfit && (
        <PressableScale
          contentStyle={[s.collage, { height: collageHeight }]}
          onPress={onOpenOutfit}
          scaleTo={0.985}
          accessibilityRole="button"
          accessibilityLabel={`${event.outfitId == null ? 'View details' : 'View outfit'} for ${event.title}, ${pieceCount} ${pieceCount === 1 ? 'piece' : 'pieces'}`}
        >
          <EventLookCollage
            itemIds={event.itemIds ?? []}
            allItems={allItems}
            outfit={outfit}
            size={collageWidth}
            height={collageHeight}
            borderRadius={radii.lg}
          />
        </PressableScale>
      )}

      <PressableScale
        contentStyle={s.caption}
        onPress={onPress}
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityLabel={`Up next, ${countdown}: ${event.title}, ${presentation.readinessLabel}`}
      >
        <Text style={s.overline} numberOfLines={1}>{countdown}</Text>
        <Text style={s.title} numberOfLines={2}>{event.title}</Text>
        <View style={s.metaRow}>
          {forecast.data ? <Ionicons name={WEATHER_ICONS[forecast.data.condition]} size={13} color={colors.mutedForeground} /> : null}
          <Text style={s.meta} numberOfLines={1}>{meta}</Text>
        </View>
        {event.location ? <Text style={s.location} numberOfLines={1}>{event.location}</Text> : null}
        {weatherNote ? <Text style={s.prompt}>{weatherNote}</Text> : null}
      </PressableScale>

      <View style={s.actions}>
        {!hasOutfit ? (
          <PressableScale
            style={s.planOuter}
            contentStyle={s.plan}
            onPress={onPlanOutfit}
            disabled={isPlanning}
            accessibilityRole="button"
            accessibilityLabel={isPlanning ? `Styling an outfit for ${event.title}` : `${getEventPlanActionLabel(false)} for ${event.title}`}
            accessibilityState={{ disabled: isPlanning, busy: isPlanning }}
          >
            {isPlanning ? <ActivityIndicator size="small" color={colors.foreground} /> : <Ionicons name="sparkles-outline" size={15} color={colors.foreground} />}
            <Text style={s.planText}>{isPlanning ? 'Styling…' : 'Plan look'}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.foreground} />
          </PressableScale>
        ) : isToday && onWear ? (
          <>
            <HeroButton
              variant="primary"
              icon={worn ? 'checkmark' : 'shirt-outline'}
              label={worn ? 'Worn today' : 'Wear this'}
              onPress={onWear}
              disabled={worn || isWearing}
              busy={isWearing}
              accessibilityLabel={worn ? `${event.title} look logged as worn` : `Wear this look for ${event.title}`}
            />
            <HeroButton
              variant="ghost"
              icon="swap-horizontal"
              label="Swap"
              onPress={onPlanOutfit}
              accessibilityLabel={`Swap the look for ${event.title}`}
            />
          </>
        ) : (
          <>
            <HeroButton
              variant="primary"
              icon="arrow-forward"
              label="View outfit"
              onPress={onOpenOutfit}
              accessibilityLabel={`View outfit for ${event.title}`}
            />
            <HeroButton
              variant="ghost"
              icon="sparkles-outline"
              label="Refine"
              onPress={onPlanOutfit}
              accessibilityLabel={`${getEventPlanActionLabel(true)} for ${event.title}`}
            />
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    padding: CARD_PADDING,
    gap: spacing.md,
    borderRadius: 20,
    borderCurve: 'continuous',
    // Tan is the trip colour; an event card stays neutral.
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  collage: { overflow: 'hidden', borderRadius: radii.lg, borderCurve: 'continuous' },
  caption: { gap: spacing.xs },
  overline: { ...typography.text.eyebrowLarge, color: colors.accentInk },
  title: { ...typography.text.editorialTitle, color: colors.foreground },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { ...typography.text.caption, color: colors.mutedForeground, fontWeight: typography.weight.medium, flexShrink: 1 },
  planOuter: { marginLeft: 'auto' },
  plan: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  planText: { ...typography.text.label, color: colors.foreground },
  location: { ...typography.text.caption, color: colors.mutedForeground, marginTop: 2 },
  prompt: { ...typography.text.bodySmall, color: colors.inkSubtle, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  buttonOuter: { flex: 1 },
  button: {
    minHeight: 48,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.action,
    borderCurve: 'continuous',
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonGhost: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.ghostStroke, backgroundColor: 'rgba(255,255,255,0.4)' },
  buttonDisabled: { opacity: 0.72 },
  buttonText: { ...typography.text.label, color: colors.foreground },
  buttonTextPrimary: { color: colors.primaryForeground },
});
