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
import { OCCASION_ICONS, formatTime, formatCountdown } from './calendarUtils';
import { colors, spacing, typography, radii } from '../../theme';
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

  useEffect(() => {
    if (!visible) return;
    handoffRef.current = false;
    setHandoffPending(false);
    setEventMenuVisible(false);
    setBoardPickerVisible(false);
    setManualExpanded(false);
    setNotesExpanded(false);
  }, [event?.id, visible]);

  if (!event) return null;
  const d = new Date(event.date);
  const countdown = formatCountdown(d);
  const iconName = (OCCASION_ICONS[event.occasion] ?? 'calendar-outline') as keyof typeof Ionicons.glyphMap;
  const presentation = presentCalendarEvent(event);
  const notesPresentation = presentEventNotes([...new Set([event.calendarMetadata?.sourceNotes, event.notes].filter(Boolean))].join('\n\n'));
  const hasOutfit = presentation.hasOutfit;
  const pieceCount = event.itemIds?.length ?? 0;
  const lookWidth = Math.max(240, Math.min(width - spacing.lg * 4, 480));

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
            <View style={s.readinessBadge}>
              <Ionicons
                name={hasOutfit ? 'checkmark' : 'sparkles-outline'}
                size={11}
                color={hasOutfit ? colors.success : colors.primary}
              />
              <Text style={[s.readinessBadgeText, hasOutfit && s.readinessBadgeTextReady]}>
                {presentation.readinessLabel}
              </Text>
            </View>
          </View>

          <View style={s.infoCard}>
            <View style={s.infoRow}>
              <Ionicons name="calendar-outline" size={15} color={colors.mutedForeground} />
              <Text selectable style={s.metaText}>{agendaDayHeading(eventDayKey(event))} · {event.calendarMetadata?.allDay ? 'All day' : formatTime(d)}</Text>
              {countdown ? (
                <View style={s.countdownBadge}>
                  <Text style={s.countdownText}>{countdown}</Text>
                </View>
              ) : null}
            </View>

            <View style={s.infoRow}>
              <Ionicons name={iconName} size={15} color={colors.mutedForeground} />
              <Text selectable style={s.metaText}>
                {[occasionDisplayLabel(event.occasion), event.environment].filter(Boolean).join(' · ')}
              </Text>
            </View>

            {event.location ? (
              <View style={s.infoRow}>
                <Ionicons name="location-outline" size={15} color={colors.mutedForeground} />
                <Text selectable style={s.metaText} numberOfLines={2}>{event.location}</Text>
              </View>
            ) : null}

            {forecast.data ? (
              <View style={s.infoRow}>
                <Ionicons name={WEATHER_ICONS[forecast.data.condition]} size={15} color={colors.mutedForeground} />
                <Text style={s.metaText}>
                  {formatTempRange(forecast.data, tempUnit)} · {forecast.data.locationSource === 'destination' ? 'Forecast for' : 'Weather near'} {forecast.data.locationLabel}
                </Text>
              </View>
            ) : null}
            {!forecast.data ? <Text style={s.outfitSubtext}>{forecast.isFetching ? 'Checking the forecast…' : 'Forecast unavailable for this event.'}</Text> : null}
            {forecast.data && forecast.data.locationSource !== 'destination' ? <Text style={s.outfitSubtext}>The event location was unavailable, so this forecast uses your nearby area.</Text> : null}
          </View>

          {hasOutfit ? (
            <View style={[s.outfitCard, s.outfitCardReady]}>
              <View style={s.outfitHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.outfitLabel}>Planned look</Text>
                  <Text style={s.outfitSubtext}>Your pieces are ready for this event</Text>
                </View>
                <View style={s.readyMark}>
                  <Ionicons name="checkmark" size={14} color={colors.success} />
                </View>
              </View>
              <PressableScale
                contentStyle={s.lookPreviewButton}
                onPress={() => onOpenOutfit(event)}
                disabled={event.outfitId == null}
                accessibilityRole={event.outfitId == null ? undefined : 'button'}
                accessibilityLabel={event.outfitId == null
                  ? `Custom look for ${event.title}, ${pieceCount} ${pieceCount === 1 ? 'piece' : 'pieces'}`
                  : `View outfit for ${event.title}, ${pieceCount} ${pieceCount === 1 ? 'piece' : 'pieces'}`}
              >
                <View style={s.lookPreviewCollage}>
                  <EventLookCollage
                    itemIds={event.itemIds ?? []}
                    allItems={allItems}
                    size={lookWidth}
                    height={Math.min(lookWidth * 0.62, 240)}
                    borderRadius={radii.lg}
                    outfit={outfit}
                  />
                </View>
                <View style={s.lookPreviewFooter}>
                  <View>
                    <Text style={s.lookPreviewTitle}>{event.outfitId == null ? 'Custom look' : 'Your look'}</Text>
                    <Text style={s.lookPreviewMeta}>{pieceCount} {pieceCount === 1 ? 'piece' : 'pieces'}</Text>
                  </View>
                  {event.outfitId != null ? (
                    <View style={s.viewLookPill}>
                      <Text style={s.viewLookText}>View outfit</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                    </View>
                  ) : null}
                </View>
              </PressableScale>
            </View>
          ) : (
            <View style={[s.outfitCard, s.outfitCardEmpty]}>
              <View style={s.emptyOutfitIcon}>
                <Ionicons name="sparkles-outline" size={19} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.emptyOutfitTitle}>Ready to style</Text>
                <Text style={s.outfitSubtext}>Styled will consider your closet, the occasion, and the forecast.</Text>
              </View>
            </View>
          )}

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
              <View style={s.notesHeader}>
                <Ionicons name="document-text-outline" size={15} color={colors.primary} />
                <Text style={s.notesLabel}>Event details</Text>
              </View>
              {notesPresentation.summary ? (
                <Text selectable style={s.notesText} numberOfLines={notesExpanded ? undefined : 3}>
                  {notesPresentation.summary}
                </Text>
              ) : null}
              {notesPresentation.summary && notesPresentation.summary.length > 150 ? (
                <TouchableOpacity onPress={() => setNotesExpanded((current) => !current)} style={s.notesMoreBtn} accessibilityRole="button" accessibilityState={{ expanded: notesExpanded }}>
                  <Text style={s.notesMoreText}>{notesExpanded ? 'Show less' : 'More details'}</Text>
                  <Ionicons name={notesExpanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
              {notesPresentation.links.length > 0 ? (
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
            <View style={s.sourceSection}>
              <Text style={s.metaText}>From {event.calendarMetadata.calendarName}</Text>
              <Text style={s.outfitSubtext}>Edit calendar details in your source calendar. Styling stays in Styled.</Text>
              {event.calendarMetadata.url && /^https:\/\//i.test(event.calendarMetadata.url) ? (
                <TouchableOpacity style={s.sourceLink} accessibilityRole="link" onPress={() => { void Linking.openURL(event.calendarMetadata!.url!).catch(() => {}); }}>
                  <Ionicons name="open-outline" size={14} color={colors.primary} />
                  <Text style={s.sourceLinkText}>Open calendar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <ActionMenuSheet
          compact
          deferSelectionUntilDismissed
          visible={eventMenuVisible}
          title="Event options"
          subtitle={event.title}
          options={[
            { label: event.calendarMetadata ? 'Edit styling details' : 'Edit event', icon: 'pencil-outline', onPress: () => onEdit(event) },
            ...(event.calendarMetadata?.url && /^https:\/\//i.test(event.calendarMetadata.url) ? [{ label: 'Open calendar', icon: 'open-outline' as const, onPress: () => { void Linking.openURL(event.calendarMetadata!.url!); } }] : []),
            { label: event.calendarMetadata ? 'Remove from Styled' : 'Delete event', icon: 'trash-outline', destructive: true, onPress: () => onDelete(event) },
          ]}
          onClose={() => setEventMenuVisible(false)}
        />

        <View style={[s.actions, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <PressableScale
            contentStyle={s.stylistBtn}
            disabled={handoffPending}
            accessibilityState={{ disabled: handoffPending, busy: handoffPending }}
            onPress={() => handoff(onOpenStylist)}
            accessibilityRole="button"
            accessibilityLabel={`${getEventPlanActionLabel(hasOutfit)} for ${event.title}`}
          >
            <Ionicons name="sparkles-outline" size={18} color={colors.white} />
            <Text style={s.stylistBtnText}>{getEventPlanActionLabel(hasOutfit)}</Text>
          </PressableScale>

          <PressableScale contentStyle={s.manualToggle} onPress={() => setManualExpanded(true)} accessibilityRole="button" accessibilityLabel={`Choose a look for ${event.title}`}>
            <Text style={s.manualToggleText}>Choose a look</Text>
            <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
          </PressableScale>
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
  titleBlock: { gap: spacing.sm, marginBottom: spacing.xs },
  title: {
    ...typography.text.editorialSheet,
    color: colors.foreground,
  },
  readinessBadge: {
    alignSelf: 'flex-start',
    minHeight: 26,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  readinessBadgeText: { ...typography.text.label, color: colors.primary },
  readinessBadgeTextReady: { color: colors.success },
  infoCard: {
    gap: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground, flex: 1 },
  countdownBadge: {
    backgroundColor: colors.surfaceSelected,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    minHeight: 24,
    justifyContent: 'center',
  },
  countdownText: { ...typography.text.label, color: colors.primary },
  notesCard: {
    gap: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notesLabel: { fontSize: typography.text.caption.fontSize, color: colors.primary, fontWeight: typography.weight.semibold, textTransform: 'uppercase', letterSpacing: typography.tracking.meta },
  notesText: { fontSize: typography.text.bodySmall.fontSize, color: colors.inkSubtle, lineHeight: typography.text.bodySmall.fontSize * 1.5 },
  notesMoreBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
  notesMoreText: { fontSize: typography.text.caption.fontSize, color: colors.primary, fontWeight: typography.weight.semibold },
  sourceSection: { gap: spacing.sm },
  sourceLinks: { gap: spacing.xs },
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
  actions: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  stylistBtn: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  stylistBtnText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  manualToggle: {
    backgroundColor: colors.surfaceSubtle, borderRadius: radii.full,
    minHeight: 44,
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  manualToggleText: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderCurve: 'continuous',
  },
  assignBtnOuter: { flex: 1 },
  assignBtnText: { fontSize: typography.text.bodySmall.fontSize, color: colors.foreground, fontWeight: typography.weight.medium },
  outfitCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginTop: 0,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  outfitCardReady: { backgroundColor: colors.card },
  outfitCardEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: spacing.sm,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  outfitHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  outfitLabel: {
    fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold,
    color: colors.primary, textTransform: 'uppercase', letterSpacing: typography.tracking.label,
  },
  outfitSubtext: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, lineHeight: 17, marginTop: 2 },
  readyMark: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E8F0EA', alignItems: 'center', justifyContent: 'center' },
  lookPreviewButton: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    borderCurve: 'continuous',
  },
  lookPreviewCollage: { overflow: 'hidden' },
  lookPreviewFooter: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
  },
  lookPreviewTitle: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  lookPreviewMeta: { marginTop: 2, fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
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
  boardEyebrow: {
    ...typography.text.eyebrow,
    color: colors.primary,
  },
  boardName: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.medium, color: colors.foreground },
  viewLookPill: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  viewLookText: {
    fontSize: typography.text.caption.fontSize,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  emptyOutfitIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyOutfitTitle: { fontSize: typography.text.bodySmall.fontSize, color: colors.foreground, fontWeight: typography.weight.semibold },
});
