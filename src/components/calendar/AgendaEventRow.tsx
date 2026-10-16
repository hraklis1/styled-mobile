import { View, Text, StyleSheet, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii, stroke } from '../../theme';
import { PressableScale } from '../primitives/PressableScale';
import { EventLookCollage } from './EventLookCollage';
import { formatTime } from './calendarUtils';
import { occasionDisplayLabel, presentCalendarEvent } from './calendar-presentation';
import type { Event } from '../../types/event';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';
import { lentPiecesIn, lentPiecesLine } from '../../lib/lending';

const SLOT = 60;
// An unplanned slot is a quiet outline, smaller than a look, centred in the
// same column so planned and unplanned rows still align.
const EMPTY_SLOT = 44;

/**
 * The look slot every agenda row ends in. A planned event shows its collage;
 * an unplanned one shows a stitched empty slot, so the gap reads as an
 * invitation rather than a status line.
 */
function LookSlot({
  event,
  allItems,
  outfit,
  size,
  past,
  wornItemIds,
  onOpenOutfit,
  onOpenDetail,
  onPlan,
}: {
  event: Event;
  allItems: Item[];
  outfit: Outfit | null;
  size: number;
  past: boolean;
  wornItemIds: number[] | null;
  onOpenOutfit: () => void;
  onOpenDetail: () => void;
  onPlan: () => void;
}) {
  const planned = presentCalendarEvent(event).hasOutfit;
  // A past day shows what was actually worn, else what was planned. It never
  // invites planning, so an unplanned, unworn past event has no slot.
  const shownIds = past ? wornItemIds ?? (planned ? event.itemIds! : null) : planned ? event.itemIds! : null;
  if (past && !shownIds) return <View style={{ width: size }} />;
  const worn = !!wornItemIds;
  const pieces = shownIds?.length ?? 0;
  const box = shownIds ? size : EMPTY_SLOT;
  return (
    <View style={[s.slotColumn, { width: size }]}>
      <PressableScale
        onPress={shownIds ? (planned ? onOpenOutfit : onOpenDetail) : onPlan}
        scaleTo={0.94}
        contentStyle={[s.slot, { width: box, height: box }, !shownIds && s.slotEmpty]}
        accessibilityRole="button"
        accessibilityLabel={shownIds
          ? `${worn ? 'Worn look' : 'View outfit'} for ${event.title}, ${pieces} pieces`
          : `Plan a look for ${event.title}`}
      >
        {shownIds ? (
          <EventLookCollage
            itemIds={shownIds}
            allItems={allItems}
            // An outfit photo only stands for the planned pieces.
            outfit={shownIds === event.itemIds ? outfit : null}
            size={size}
            borderRadius={10}
          />
        ) : (
          <Ionicons name="add" size={16} color={colors.stitch} />
        )}
      </PressableScale>
      {worn ? (
        <View style={s.wornTag} pointerEvents="none">
          <Text style={s.wornTagText}>Worn</Text>
        </View>
      ) : null}
    </View>
  );
}

type RowProps = {
  event: Event;
  allItems: Item[];
  outfit: Outfit | null;
  onPress: () => void;
  onOpenOutfit: () => void;
  onPlan: () => void;
  /** Days before today read as a journal: muted, and showing what was worn. */
  past?: boolean;
  /** Pieces logged as worn on the event's day, when there are any. */
  wornItemIds?: number[] | null;
  /** Rows inside a day card draw no rule of their own; the card divides them. */
  divider?: boolean;
};

function rowLabel(event: Event, when: string, past: boolean, worn: boolean): string {
  const planned = presentCalendarEvent(event).hasOutfit;
  const state = worn ? 'look worn' : planned ? 'outfit planned' : past ? null : 'needs outfit';
  return [when, event.title, occasionDisplayLabel(event.occasion), event.location, state]
    .filter(Boolean).join(', ');
}

export function AgendaEventRow({ event, allItems, outfit, onPress, onOpenOutfit, onPlan, past = false, wornItemIds = null, divider = true }: RowProps) {
  // An all-day event only gets a full row once it has a look.
  const [clock, meridiem] = event.calendarMetadata?.allDay
    ? ['All', 'day']
    : formatTime(new Date(event.date)).split(/\s/u);
  const meta = [occasionDisplayLabel(event.occasion), event.location].filter(Boolean).join(' · ');
  // A planned piece someone else has right now: say so before the day comes.
  const lentLine = past ? null : lentPiecesLine(lentPiecesIn(event.itemIds, allItems));
  return (
    <View style={[s.row, !divider && s.rowBare]}>
      <PressableScale
        style={s.main}
        contentStyle={s.mainContent}
        onPress={onPress}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={[rowLabel(event, `${clock} ${meridiem ?? ''}`.trim(), past, !!wornItemIds), lentLine].filter(Boolean).join(', ')}
        accessibilityHint="Opens event details"
      >
        <View style={s.timeCol}>
          <Text style={[s.clock, past && s.muted]} maxFontSizeMultiplier={1.4}>{clock}</Text>
          {meridiem ? <Text style={s.meridiem} maxFontSizeMultiplier={1.4}>{meridiem}</Text> : null}
        </View>
        <View style={s.body}>
          <Text style={[s.title, past && s.muted]} numberOfLines={2}>{event.title}</Text>
          <Text style={s.meta} numberOfLines={1}>{meta}</Text>
          {lentLine ? (
            <View style={s.lentLine}>
              <Ionicons name="people-outline" size={12} color={colors.accentInk} />
              <Text style={s.lentText} numberOfLines={1}>{lentLine}</Text>
            </View>
          ) : null}
        </View>
      </PressableScale>
      <LookSlot event={event} allItems={allItems} outfit={outfit} size={SLOT} past={past} wornItemIds={wornItemIds} onOpenOutfit={onOpenOutfit} onOpenDetail={onPress} onPlan={onPlan} />
    </View>
  );
}

/**
 * A day's all-day entries — shifts, trips, reminders — as one quiet line under
 * the heading. They don't need a look, so there's no slot; several entries
 * expand in place, one per line.
 */
export function AllDayLine({ events, past = false, expanded, onToggle, onPressEvent }: {
  events: Event[];
  past?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPressEvent: (event: Event) => void;
}) {
  const detail = (event: Event) => [event.title, event.location].filter(Boolean).join(' · ');
  if (events.length > 1 && expanded) {
    return (
      <View style={s.allDay}>
        {events.map((event, index) => (
          <PressableScale
            key={event.id}
            contentStyle={s.allDayContent}
            onPress={() => onPressEvent(event)}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`All day, ${detail(event)}`}
            accessibilityHint="Opens event details"
          >
            <Text style={[s.allDayKicker, index > 0 && s.hidden]}>All day</Text>
            <Text style={[s.allDayTitle, past && s.muted]} numberOfLines={1}>{detail(event)}</Text>
          </PressableScale>
        ))}
      </View>
    );
  }
  const single = events.length === 1;
  return (
    <PressableScale
      style={s.allDay}
      contentStyle={s.allDayContent}
      onPress={single ? () => onPressEvent(events[0]) : onToggle}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`All day, ${events.map(detail).join(', ')}`}
      accessibilityHint={single ? 'Opens event details' : 'Shows each all-day event'}
      accessibilityState={single ? undefined : { expanded: false }}
    >
      <Text style={s.allDayKicker}>All day</Text>
      <Text style={[s.allDayTitle, past && s.muted]} numberOfLines={1}>
        {single ? detail(events[0]) : events.map((event) => event.title).join(', ')}
      </Text>
      {single ? null : <Text style={s.allDayCount}>{events.length}</Text>}
    </PressableScale>
  );
}

const tabular = { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] };

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: colors.hairline,
  },
  rowBare: { borderBottomWidth: 0 },
  main: { flex: 1, minWidth: 0 },
  mainContent: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 44 },
  timeCol: { width: 52, paddingTop: 2 },
  clock: { ...typography.text.label, ...tabular, color: colors.foreground },
  meridiem: { ...typography.text.caption, ...tabular, color: colors.mutedForeground },
  body: { flex: 1, minWidth: 0, gap: 3 },
  title: { ...typography.text.body, fontWeight: typography.weight.semibold, color: colors.foreground },
  meta: { ...typography.text.caption, color: colors.mutedForeground },
  lentLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lentText: { ...typography.text.caption, color: colors.accentInk, flexShrink: 1 },
  slotColumn: { alignItems: 'center', justifyContent: 'center' },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    overflow: 'hidden',
    borderCurve: 'continuous',
    backgroundColor: colors.imageMat,
  },
  slotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: stroke.fine,
    borderStyle: 'dashed',
    borderColor: colors.stitch,
  },
  muted: { color: colors.mutedForeground },
  wornTag: {
    position: 'absolute', left: 4, bottom: 4,
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  wornTagText: { fontSize: 9, lineHeight: 12, fontWeight: typography.weight.semibold, color: colors.foreground, letterSpacing: 0.3 },
  hidden: { opacity: 0 },
  allDay: { paddingVertical: spacing.xs },
  allDayContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  allDayKicker: { ...typography.text.caption, width: 52, fontWeight: typography.weight.semibold, color: colors.accentInk },
  allDayTitle: { ...typography.text.bodySmall, flex: 1, color: colors.inkSubtle },
  allDayCount: { ...typography.text.caption, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
});
