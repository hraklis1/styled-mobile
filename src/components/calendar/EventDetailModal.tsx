import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useEventWeatherForecast } from '../../hooks/useWeather';
import type { StylingLocationContext } from '../../lib/stylingLocation';
import { useTempUnit } from '../../hooks/useTempUnit';
import { formatTempRange } from '../../lib/temperature';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventLookCollage } from './EventLookCollage';
import type { Board } from '../../types/board';
import { EventBoardPickerModal } from './EventBoardPickerModal';
import { OCCASION_ICONS, formatTime, formatCountdown, toDateStr } from './calendarUtils';
import { colors, spacing, typography, radii, stroke } from '../../theme';
import type { Item } from '../../types/item';
import type { Event } from '../../types/event';
import type { Outfit } from '../../types/outfit';
import { eventDayKey, agendaDayHeading } from './calendarAgenda';
import { getEventItemsActionLabel, getEventPlanActionLabel } from './calendarPlanning';
import { presentCalendarEvent, presentEventNotes, WEATHER_ICONS, occasionDisplayLabel } from './calendar-presentation';
import { PressableScale } from '../primitives/PressableScale';
import { ActionMenuSheet } from '../primitives/ActionMenuSheet';

export function EventDetailModal({
  event,
  visible,
  onClose,
  onEdit,
  onDelete,
  onAssign,
  onChooseOutfit,
  onOpenOutfit,
  allItems,
  onOpenStylist,
  weatherFallback,
  outfit,
  onSelectBoard,
  board,
  onOpenBoard,
  onWear,
  worn = false,
  isWearing = false,
  tripAction,
}: {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (ev: Event) => void;
  onDelete: (ev: Event) => void;
  onAssign: (ev: Event) => void;
  onChooseOutfit: (ev: Event) => void;
  onOpenOutfit: (ev: Event) => void;
  allItems: Item[];
  outfit: Outfit | null;
  onOpenStylist: (event: Event) => void;
  weatherFallback: StylingLocationContext | null;
  /** Attach/detach the board. Omitted hides the menu entry entirely. */
  onSelectBoard?: (boardId: number | null) => Promise<void>;
  /** The linked board, resolved by the parent, for the summary row. */
  board?: Board | null;
  onOpenBoard?: (boardId: number) => void;
  /** Logs the planned look as worn. Offered only on the event's own day. */
  onWear?: (event: Event) => void;
  worn?: boolean;
  isWearing?: boolean;
  /**
   * Set for trip-like events: plan the event as a trip, or open the plan
   * already linked to it. Shown above the look, since a stay needs a capsule
   * rather than one outfit.
   */
  tripAction?: { planned: boolean; title: string; detail: string; onPress: (event: Event) => void };
}) {
  const eventDateStr = event ? eventDayKey(event) : null;
  const forecast = useEventWeatherForecast(
    event?.location,
    weatherFallback,
    eventDateStr,
  );
  const tempUnit = useTempUnit();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const handoffRef = useRef(false);
  const [handoffPending, setHandoffPending] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [boardPickerVisible, setBoardPickerVisible] = useState(false);
  const [eventMenuVisible, setEventMenuVisible] = useState(false);
  const [weatherNoteVisible, setWeatherNoteVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    handoffRef.current = false;
    setHandoffPending(false);
    setEventMenuVisible(false);
    setBoardPickerVisible(false);
    setManualExpanded(false);
    setNotesExpanded(false);
    setWeatherNoteVisible(false);
  }, [event?.id, visible]);

  if (!event) return null;
  const d = new Date(event.date);
  const countdown = formatCountdown(d);
  const iconName = (OCCASION_ICONS[event.occasion] ?? 'calendar-outline') as keyof typeof Ionicons.glyphMap;
  const presentation = presentCalendarEvent(event);
  const notesPresentation = presentEventNotes([...new Set([event.calendarMetadata?.sourceNotes, event.notes].filter(Boolean))].join('\n\n'));
  const hasOutfit = presentation.hasOutfit;
  const pieceCount = event.itemIds?.length ?? 0;
  const lookWidth = Math.min(width - spacing.lg * 2, 560);
  const lookHeight = Math.round(Math.min(lookWidth * 0.8, 380));
  const isToday = eventDayKey(event) === toDateStr(new Date());
  const canWear = hasOutfit && isToday && !!onWear;
  const sourceUrl = event.calendarMetadata?.url && /^https:\/\//i.test(event.calendarMetadata.url) ? event.calendarMetadata.url : null;
  const weatherIsFallback = !!forecast.data && forecast.data.locationSource !== 'destination';
  const chips: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; accent?: boolean; onPress?: () => void; info?: boolean }[] = [
    { key: 'when', icon: 'calendar-outline', label: `${agendaDayHeading(eventDayKey(event))} · ${event.calendarMetadata?.allDay ? 'All day' : formatTime(d)}` },
    ...(countdown ? [{ key: 'countdown', icon: 'hourglass-outline' as const, label: countdown, accent: true }] : []),
    { key: 'occasion', icon: iconName, label: [occasionDisplayLabel(event.occasion), event.environment].filter(Boolean).join(' · ') },
    ...(event.location ? [{ key: 'location', icon: 'location-outline' as const, label: event.location }] : []),
    ...(forecast.data
      ? [{
        key: 'weather',
        icon: WEATHER_ICONS[forecast.data.condition],
        label: formatTempRange(forecast.data, tempUnit),
        info: weatherIsFallback,
        onPress: weatherIsFallback ? () => setWeatherNoteVisible((value) => !value) : undefined,
      }]
      : forecast.isFetching ? [{ key: 'weather', icon: 'cloud-outline' as const, label: 'Checking forecast…' }] : []),
  ];

  // Delayed so the action sheet finishes dismissing first — iOS drops a modal
  // presented while another is still on its way out.
  const chooseBoard = onSelectBoard
    ? () => setBoardPickerVisible(true)
    : undefined;

  const handoff = (action: (event: Event) => void) => {
    if (handoffRef.current) return;
    handoffRef.current = true;
    setHandoffPending(true);
    action(event);
  };

  const openEventMenu = () => {
    setEventMenuVisible(true);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.circleBtn} accessibilityRole="button" accessibilityLabel="Close event details">
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openEventMenu} style={s.circleBtn} accessibilityRole="button" accessibilityLabel="More event actions">
            <Ionicons name="ellipsis-horizontal" size={19} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
          <View style={s.titleBlock}>
            <Text selectable style={s.title}>{event.title}</Text>
            <View style={[s.statusPill, !hasOutfit && s.statusPillNeeds]}>
              <Ionicons
                name={worn ? 'checkmark-done' : hasOutfit ? 'checkmark' : 'sparkles-outline'}
                size={12}
                color={hasOutfit ? colors.foreground : colors.accentInk}
              />
              <Text style={[s.statusText, !hasOutfit && s.statusTextNeeds]}>
                {worn ? 'Worn today' : hasOutfit ? 'Look planned' : 'Needs a look'}
              </Text>
            </View>
          </View>

          {tripAction ? (
            <PressableScale
              contentStyle={[s.tripAction, !tripAction.planned && s.tripActionPlan]}
              onPress={() => handoff(tripAction.onPress)}
              disabled={handoffPending}
              scaleTo={0.985}
              accessibilityRole="button"
              accessibilityLabel={`${tripAction.title}, ${tripAction.detail}`}
            >
              <Ionicons name={tripAction.planned ? 'briefcase-outline' : 'airplane-outline'} size={18} color={tripAction.planned ? colors.accentInk : colors.white} />
              <View style={s.tripActionText}>
                <Text style={[s.tripActionTitle, !tripAction.planned && s.tripActionTitlePlan]}>{tripAction.title}</Text>
                <Text style={[s.tripActionDetail, !tripAction.planned && s.tripActionDetailPlan]}>{tripAction.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={tripAction.planned ? colors.accentInk : colors.white} />
            </PressableScale>
          ) : null}

          {hasOutfit ? (
            <View style={s.lookBlock}>
              <PressableScale
                contentStyle={[s.lookCanvas, { height: lookHeight }]}
                onPress={() => onOpenOutfit(event)}
                disabled={event.outfitId == null}
                scaleTo={0.985}
                accessibilityRole={event.outfitId == null ? undefined : 'button'}
                accessibilityLabel={event.outfitId == null
                  ? `Custom look for ${event.title}, ${pieceCount} ${pieceCount === 1 ? 'piece' : 'pieces'}`
                  : `View outfit for ${event.title}, ${pieceCount} ${pieceCount === 1 ? 'piece' : 'pieces'}`}
              >
                <EventLookCollage
                  itemIds={event.itemIds ?? []}
                  allItems={allItems}
                  size={lookWidth}
                  height={lookHeight}
                  borderRadius={radii.xl}
                  outfit={outfit}
                />
              </PressableScale>
              <View style={s.lookFooter}>
                <Text style={s.lookMeta}>
                  {event.outfitId == null ? 'Custom look' : 'Your look'} · {pieceCount} {pieceCount === 1 ? 'piece' : 'pieces'}
                </Text>
                {event.outfitId != null ? (
                  <TouchableOpacity style={s.lookLink} onPress={() => onOpenOutfit(event)} accessibilityRole="button" accessibilityLabel="View outfit">
                    <Text style={s.lookLinkText}>View outfit</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.foreground} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : (
            <PressableScale
              contentStyle={s.emptyCanvas}
              onPress={() => handoff(onOpenStylist)}
              disabled={handoffPending}
              scaleTo={0.985}
              accessibilityRole="button"
              accessibilityLabel={`Style a look for ${event.title}`}
              accessibilityHint="Styled considers your closet, the occasion, and the forecast"
            >
              <View style={s.emptySlots}>
                {(['Top', 'Bottom', 'Shoes'] as const).map((slot) => (
                  <View key={slot} style={s.emptySlot}>
                    <Text style={s.emptySlotText}>{slot}</Text>
                  </View>
                ))}
              </View>
              <View style={s.emptyCanvasCaption}>
                <Ionicons name="sparkles-outline" size={14} color={colors.accentInk} />
                <Text style={s.emptyCanvasText}>Tap to style this look from your closet</Text>
              </View>
            </PressableScale>
          )}

          <View>
            <View style={s.chips}>
              {chips.map((chip) => {
                const content = (
                  <>
                    <Ionicons name={chip.icon} size={13} color={chip.accent ? colors.accentInk : colors.mutedForeground} />
                    <Text style={[s.chipText, chip.accent && s.chipTextAccent]} numberOfLines={1}>{chip.label}</Text>
                    {chip.info ? <Ionicons name="information-circle-outline" size={13} color={colors.mutedForeground} /> : null}
                  </>
                );
                return chip.onPress ? (
                  <TouchableOpacity
                    key={chip.key}
                    style={s.chip}
                    onPress={chip.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={`${chip.label}, about this forecast`}
                    accessibilityState={{ expanded: weatherNoteVisible }}
                  >
                    {content}
                  </TouchableOpacity>
                ) : (
                  <View key={chip.key} style={s.chip}>{content}</View>
                );
              })}
            </View>
            {weatherNoteVisible && forecast.data ? (
              <Text style={s.weatherNote}>
                Weather near {forecast.data.locationLabel}. The event location couldn’t be placed, so this uses your area.
              </Text>
            ) : null}
          </View>

          {board && (
            <TouchableOpacity
              style={s.boardRow}
              onPress={() => onOpenBoard?.(board.id)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Planned from ${board.name}`}
              accessibilityHint="Opens this board"
            >
              <Ionicons name="albums-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.boardEyebrow}>PLANNED FROM</Text>
                <Text style={s.boardName} numberOfLines={1}>{board.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          {notesPresentation.summary || notesPresentation.links.length > 0 ? (
            <View style={s.notesCard}>
              <TouchableOpacity
                style={s.notesHeader}
                onPress={() => setNotesExpanded((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel="Event details"
                accessibilityState={{ expanded: notesExpanded }}
              >
                <Text style={s.notesLabel}>Event details</Text>
                {!notesExpanded && notesPresentation.summary ? (
                  <Text style={s.notesPreview} numberOfLines={1}>{notesPresentation.summary.replace(/\s+/g, ' ')}</Text>
                ) : <View style={{ flex: 1 }} />}
                <Ionicons name={notesExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              {notesExpanded && notesPresentation.summary ? (
                <Text selectable style={s.notesText}>{notesPresentation.summary}</Text>
              ) : null}
              {notesExpanded && notesPresentation.links.length > 0 ? (
                <View style={s.sourceLinks}>
                  {notesPresentation.links.map((link) => (
                    <TouchableOpacity
                      key={link.url}
                      style={s.sourceLink}
                      onPress={() => Linking.openURL(link.url).catch(() => {})}
                      accessibilityRole="link"
                      accessibilityLabel={link.label}
                    >
                      <Ionicons name="open-outline" size={14} color={colors.primary} />
                      <Text style={s.sourceLinkText}>{link.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {event.calendarMetadata ? (
            <TouchableOpacity
              style={s.sourceFooter}
              disabled={!sourceUrl}
              onPress={() => { if (sourceUrl) void Linking.openURL(sourceUrl).catch(() => {}); }}
              accessibilityRole={sourceUrl ? 'link' : 'text'}
              accessibilityLabel={`Synced from ${event.calendarMetadata.calendarName}${sourceUrl ? ', open calendar' : ''}`}
              accessibilityHint="Calendar details are edited in the source calendar"
            >
              <Ionicons name="sync-outline" size={13} color={colors.mutedForeground} />
              <Text style={s.sourceFooterText} numberOfLines={1}>
                Synced from {event.calendarMetadata.calendarName}
              </Text>
              {sourceUrl ? (
                <>
                  <Text style={s.sourceFooterLink}>Open</Text>
                  <Ionicons name="arrow-up-outline" size={12} color={colors.foreground} style={s.openGlyph} />
                </>
              ) : null}
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <ActionMenuSheet
          compact
          deferSelectionUntilDismissed
          visible={eventMenuVisible}
          title="Event options"
          subtitle={event.title}
          options={[
            ...(hasOutfit ? [{ label: 'Choose a different look', icon: 'albums-outline' as const, onPress: () => setManualExpanded(true) }] : []),
            { label: event.calendarMetadata ? 'Edit styling details' : 'Edit event', icon: 'pencil-outline', onPress: () => onEdit(event) },
            ...(event.calendarMetadata?.url && /^https:\/\//i.test(event.calendarMetadata.url) ? [{ label: 'Open calendar', icon: 'open-outline' as const, onPress: () => { void Linking.openURL(event.calendarMetadata!.url!); } }] : []),
            { label: event.calendarMetadata ? 'Remove from Styled' : 'Delete event', icon: 'trash-outline', destructive: true, onPress: () => onDelete(event) },
          ]}
          onClose={() => setEventMenuVisible(false)}
        />

        <View style={[s.actions, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={s.actionRow}>
            {canWear ? (
              <PressableScale
                style={s.actionOuter}
                contentStyle={[s.stylistBtn, (worn || isWearing) && s.btnDisabled]}
                disabled={worn || isWearing}
                accessibilityState={{ disabled: worn || isWearing, busy: isWearing }}
                onPress={() => onWear!(event)}
                accessibilityRole="button"
                accessibilityLabel={worn ? `${event.title} look logged as worn` : `Wear this look for ${event.title}`}
              >
                <Ionicons name={worn ? 'checkmark' : 'shirt-outline'} size={17} color={colors.white} />
                <Text style={s.stylistBtnText}>{worn ? 'Worn today' : isWearing ? 'Logging…' : 'Wear this'}</Text>
              </PressableScale>
            ) : null}
            <PressableScale
              style={s.actionOuter}
              contentStyle={canWear ? s.ghostBtn : s.stylistBtn}
              disabled={handoffPending}
              accessibilityState={{ disabled: handoffPending, busy: handoffPending }}
              onPress={() => handoff(onOpenStylist)}
              accessibilityRole="button"
              accessibilityLabel={`${getEventPlanActionLabel(hasOutfit)} for ${event.title}`}
            >
              <Ionicons name="sparkles-outline" size={17} color={canWear ? colors.foreground : colors.white} />
              <Text style={canWear ? s.ghostBtnText : s.stylistBtnText}>
                {canWear ? 'Refine' : getEventPlanActionLabel(hasOutfit)}
              </Text>
            </PressableScale>
          </View>

          {!hasOutfit ? (
            <TouchableOpacity
              style={s.manualLink}
              onPress={() => setManualExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel={`Choose a look for ${event.title}`}
            >
              <Text style={s.manualLinkText}>or choose from your closet</Text>
            </TouchableOpacity>
          ) : null}
          <ActionMenuSheet
            compact
            deferSelectionUntilDismissed
            visible={manualExpanded}
            title="Choose a look"
            options={[
              { label: 'Saved outfits', icon: 'albums-outline', onPress: () => handoff(onChooseOutfit) },
              { label: getEventItemsActionLabel(hasOutfit), icon: 'shirt-outline', onPress: () => handoff(onAssign) },
              ...(chooseBoard ? [{ label: 'Plan from a board', icon: 'albums-outline' as const, onPress: chooseBoard }] : []),
            ]}
            onClose={() => setManualExpanded(false)}
          />
        </View>
      </View>

      {/* Nested inside this Modal on purpose. React Native presents a Modal
          from the root view controller, which is already busy presenting this
          one, so a sibling picker in CalendarScreen silently never appears.
          Same reason ItemPickerSheet lives inside StylistChatView. */}
      {onSelectBoard && (
        <EventBoardPickerModal
          visible={boardPickerVisible}
          selectedBoardId={event.boardId ?? null}
          onClose={() => setBoardPickerVisible(false)}
          onSelect={onSelectBoard}
        />
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  circleBtn: {
    width: 44, height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  titleBlock: { gap: spacing.sm },
  tripAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.accent, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(111,89,72,0.18)' },
  tripActionPlan: { backgroundColor: colors.primary, borderColor: colors.primary },
  tripActionText: { flex: 1, gap: 2 },
  tripActionTitle: { ...typography.text.label, color: colors.accentInk },
  tripActionTitlePlan: { color: colors.white },
  tripActionDetail: { ...typography.text.meta, color: colors.accentInk },
  tripActionDetailPlan: { color: colors.white, opacity: 0.8 },
  title: { ...typography.text.editorialSheet, color: colors.foreground },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    minHeight: 28,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSelected,
  },
  statusPillNeeds: { backgroundColor: 'transparent', borderWidth: stroke.fine, borderColor: colors.stitch },
  statusText: { ...typography.text.caption, fontWeight: typography.weight.semibold, color: colors.foreground },
  statusTextNeeds: { color: colors.accentInk },

  lookBlock: { gap: spacing.sm },
  lookCanvas: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.imageMat,
  },
  lookFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  lookMeta: { ...typography.text.bodySmall, color: colors.mutedForeground },
  lookLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  lookLinkText: { ...typography.text.label, color: colors.foreground, textDecorationLine: 'underline' },

  emptyCanvas: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    borderWidth: stroke.fine,
    borderStyle: 'dashed',
    borderColor: colors.stitch,
  },
  emptySlots: { flexDirection: 'row', gap: spacing.sm, height: 150 },
  emptySlot: {
    flex: 1,
    alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  emptySlotText: { ...typography.text.caption, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  emptyCanvasCaption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  emptyCanvasText: { ...typography.text.bodySmall, color: colors.accentInk, fontWeight: typography.weight.medium },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    maxWidth: '100%',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    minHeight: 32,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  chipText: { ...typography.text.caption, color: colors.foreground, fontWeight: typography.weight.medium, flexShrink: 1 },
  chipTextAccent: { color: colors.accentInk },
  weatherNote: { ...typography.text.caption, color: colors.mutedForeground, marginTop: spacing.sm },

  notesCard: {
    paddingVertical: spacing.xs,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: colors.hairline,
  },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  notesLabel: { ...typography.text.label, color: colors.foreground },
  notesPreview: { ...typography.text.bodySmall, color: colors.mutedForeground, flex: 1 },
  notesText: {
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.inkSubtle,
    lineHeight: typography.text.bodySmall.fontSize * 1.5,
    paddingBottom: spacing.sm,
  },
  sourceLinks: { gap: spacing.xs, paddingBottom: spacing.sm },
  sourceLink: {
    minHeight: 44,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sourceLinkText: { flex: 1, fontSize: typography.text.caption.fontSize, color: colors.primary, fontWeight: typography.weight.semibold },
  sourceFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  sourceFooterText: { ...typography.text.caption, color: colors.mutedForeground, flexShrink: 1 },
  sourceFooterLink: { ...typography.text.caption, color: colors.foreground, fontWeight: typography.weight.semibold, marginLeft: spacing.xs },
  openGlyph: { transform: [{ rotate: '45deg' }] },

  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  boardEyebrow: { ...typography.text.eyebrow, color: colors.primary },
  boardName: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.medium, color: colors.foreground },

  actions: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionOuter: { flex: 1 },
  stylistBtn: {
    minHeight: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  stylistBtnText: { ...typography.text.label, color: colors.white },
  ghostBtn: {
    minHeight: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderRadius: radii.full,
    borderWidth: stroke.fine,
    borderColor: colors.ghostStroke,
  },
  ghostBtnText: { ...typography.text.label, color: colors.foreground },
  btnDisabled: { opacity: 0.72 },
  manualLink: { alignSelf: 'center', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md },
  manualLinkText: { ...typography.text.bodySmall, color: colors.mutedForeground, textDecorationLine: 'underline' },
});
