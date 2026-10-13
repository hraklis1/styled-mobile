import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii, stroke } from '../../theme';
import { PressableScale } from '../primitives/PressableScale';
import { EventLookCollage } from '../calendar/EventLookCollage';
import { buildUpcomingDays, type UpcomingDay } from '../calendar/calendarAgenda';
import { occasionDisplayLabel, heroPrompt, WEATHER_ICONS } from '../calendar/calendar-presentation';
import { formatTime, toDateStr } from '../calendar/calendarUtils';
import { useEventWeatherForecast } from '../../hooks/useWeather';
import { useTempUnit } from '../../hooks/useTempUnit';
import { formatTempRange } from '../../lib/temperature';
import type { StylingLocationContext } from '../../lib/stylingLocation';
import type { Event } from '../../types/event';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';

const DAY_LIMIT = 5;
const CARD_W = 168;
const LEAD_W = 252;
const TILE_H = 132;
// The gap equals the page gutter, so a card scrolled past sits fully
// off-screen instead of peeking its clipped text into the margin.
const GAP = spacing.page;
const VISIBLE_EVENTS = 2;

function dayKicker(date: string, todayStr: string): string {
  const tomorrow = new Date(`${todayStr}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === todayStr) return 'Today';
  if (date === toDateStr(tomorrow)) return 'Tomorrow';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

function eventWhen(event: Event): string {
  return event.calendarMetadata?.allDay ? 'All day' : formatTime(new Date(event.date));
}

/** Weather and a line of direction, for the soonest day only. */
function LeadWeather({ day, fallback }: { day: UpcomingDay; fallback: StylingLocationContext | null }) {
  const anchor = day.events.find((event) => event.location) ?? day.events[0];
  const forecast = useEventWeatherForecast(anchor.location, fallback, day.date);
  const unit = useTempUnit();
  if (!forecast.data) return null;
  return (
    <View style={s.weather}>
      <View style={s.weatherRow}>
        <Ionicons name={WEATHER_ICONS[forecast.data.condition]} size={13} color={colors.mutedForeground} />
        <Text style={s.weatherTemp}>{formatTempRange(forecast.data, unit)}</Text>
      </View>
      <Text style={s.weatherPrompt} numberOfLines={2}>{heroPrompt(anchor.occasion, forecast.data, unit)}</Text>
    </View>
  );
}

function DayCard({
  day,
  width,
  lead,
  todayStr,
  allItems,
  outfitsById,
  weatherFallback,
  onOpenDay,
  onOpenEvent,
  onPlanEvent,
}: {
  day: UpcomingDay;
  width: number;
  lead: boolean;
  todayStr: string;
  allItems: Item[];
  outfitsById: Map<number, Outfit>;
  weatherFallback: StylingLocationContext | null;
  onOpenDay: (date: string) => void;
  onOpenEvent: (eventId: number) => void;
  onPlanEvent: (event: Event) => void;
}) {
  const kicker = dayKicker(day.date, todayStr);
  const shown = day.events.slice(0, VISIBLE_EVENTS);
  const more = day.events.length - shown.length;
  const look = day.lookEvent;
  // The empty slot starts styling the first event still waiting for a look.
  const unplanned = day.events.find((event) => !(event.itemIds ?? []).length) ?? day.events[0];
  const single = shown.length === 1;

  return (
    <View style={{ width }}>
      <PressableScale
        contentStyle={[s.tile, { height: TILE_H }, !look && s.tileEmpty]}
        scaleTo={0.98}
        motion="crisp"
        haptic={false}
        onPress={() => (look ? onOpenEvent(look.id) : onPlanEvent(unplanned))}
        accessibilityRole="button"
        accessibilityLabel={look ? `Look planned for ${look.title}` : `Plan a look for ${unplanned.title}`}
      >
        {look ? (
          <EventLookCollage
            itemIds={look.itemIds!}
            allItems={allItems}
            outfit={look.outfitId == null ? null : outfitsById.get(look.outfitId) ?? null}
            size={width}
            height={TILE_H}
            borderRadius={radii.lg}
          />
        ) : (
          <>
            <Ionicons name="sparkles-outline" size={18} color={colors.accentInk} />
            <Text style={s.tileEmptyText}>Plan a look</Text>
          </>
        )}
      </PressableScale>

      <PressableScale
        contentStyle={s.copy}
        scaleTo={0.99}
        motion="crisp"
        haptic={false}
        onPress={() => onOpenDay(day.date)}
        accessibilityRole="button"
        accessibilityLabel={`${kicker}: ${day.events.map((event) => `${event.title}, ${eventWhen(event)}`).join('; ')}. Open in Calendar`}
      >
        <Text style={s.kicker}>{kicker}</Text>
        {shown.map((event) => (
          <View key={event.id} style={s.event}>
            <Text style={s.title} numberOfLines={single ? 2 : 1}>{event.title.trim()}</Text>
            <Text style={s.meta} numberOfLines={1}>
              {eventWhen(event)} · {occasionDisplayLabel(event.occasion)}
            </Text>
          </View>
        ))}
        {more > 0 ? <Text style={s.more}>+{more} more</Text> : null}
        {lead ? <LeadWeather day={day} fallback={weatherFallback} /> : null}
      </PressableScale>
    </View>
  );
}

/**
 * Home's preview of the calendar: one card per upcoming day, each led by its
 * look (or the slot waiting for one), using the same signals as Calendar.
 */
export function HomeCalendarRail({
  events,
  allItems,
  outfits,
  weatherFallback,
  onOpenDay,
  onOpenEvent,
  onPlanEvent,
}: {
  events: Event[];
  allItems: Item[];
  outfits: Outfit[];
  weatherFallback: StylingLocationContext | null;
  onOpenDay: (date: string) => void;
  onOpenEvent: (eventId: number) => void;
  /** Starts styling straight from an empty look slot. */
  onPlanEvent: (event: Event) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const todayStr = toDateStr(new Date());
  const days = useMemo(() => buildUpcomingDays(events, todayStr, DAY_LIMIT), [events, todayStr]);
  const outfitsById = useMemo(() => new Map(outfits.map((outfit) => [outfit.id, outfit])), [outfits]);

  const tomorrow = new Date(`${todayStr}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const leadIsSoon = !!days[0] && (days[0].date === todayStr || days[0].date === toDateStr(tomorrow));
  const fullWidth = screenWidth - spacing.page * 2;
  const widths = days.map((_, index) => {
    if (days.length === 1) return fullWidth;
    return index === 0 && leadIsSoon ? LEAD_W : CARD_W;
  });
  const snapOffsets = widths.reduce<number[]>((offsets, _, index) => {
    offsets.push(index === 0 ? 0 : offsets[index - 1] + widths[index - 1] + GAP);
    return offsets;
  }, []);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.rail}
      contentContainerStyle={s.railContent}
      snapToOffsets={snapOffsets}
      decelerationRate="fast"
      scrollEnabled={days.length > 1}
    >
      {days.map((day, index) => (
        <DayCard
          key={day.date}
          day={day}
          width={widths[index]}
          lead={index === 0 && leadIsSoon}
          todayStr={todayStr}
          allItems={allItems}
          outfitsById={outfitsById}
          weatherFallback={weatherFallback}
          onOpenDay={onOpenDay}
          onOpenEvent={onOpenEvent}
          onPlanEvent={onPlanEvent}
        />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  rail: { marginHorizontal: -spacing.page },
  railContent: { paddingHorizontal: spacing.page, gap: GAP, alignItems: 'flex-start' },
  tile: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.imageMat,
  },
  tileEmpty: {
    backgroundColor: 'transparent',
    borderWidth: stroke.fine,
    borderStyle: 'dashed',
    borderColor: colors.stitch,
  },
  tileEmptyText: { ...typography.text.caption, color: colors.accentInk, fontWeight: typography.weight.medium },
  copy: { paddingTop: spacing.md, gap: spacing.sm },
  kicker: { ...typography.text.eyebrow, color: colors.accentInk },
  event: { gap: 2 },
  title: { ...typography.text.editorialCard, color: colors.foreground },
  meta: { ...typography.text.caption, color: colors.mutedForeground },
  more: { ...typography.text.caption, color: colors.foreground, fontWeight: typography.weight.medium },
  weather: {
    gap: 2,
    paddingTop: spacing.sm,
    borderTopWidth: stroke.hairline,
    borderTopColor: colors.hairline,
  },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weatherTemp: { ...typography.text.caption, color: colors.foreground, fontWeight: typography.weight.medium },
  weatherPrompt: { ...typography.text.caption, color: colors.mutedForeground },
});
