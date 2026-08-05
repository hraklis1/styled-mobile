import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useEventWeatherForecast, type WeatherCondition } from '../../hooks/useWeather';
import type { StylingLocationContext } from '../../lib/stylingLocation';
import { useTempUnit } from '../../hooks/useTempUnit';
import { formatTempRange } from '../../lib/temperature';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { EventLookCollage } from './EventLookCollage';
import { OCCASIONS, OCCASION_ICONS, formatDayLabel, formatTime, formatCountdown } from './calendarUtils';
import { colors, spacing, typography, radii } from '../../theme';
import type { Item } from '../../types/item';
import type { Event } from '../../types/event';
import type { Outfit } from '../../types/outfit';
import { getEventItemsActionLabel } from './calendarPlanning';
import { presentCalendarEvent, presentEventNotes } from './calendar-presentation';

const WEATHER_ICONS: Record<WeatherCondition, keyof typeof Ionicons.glyphMap> = {
  sunny: 'sunny-outline',
  rainy: 'rainy-outline',
  cold: 'snow-outline',
  mild: 'partly-sunny-outline',
};

export function EventDetailModal({
  event,
  visible,
  onClose,
  onEdit,
  onDelete,
  onAssign,
  onChooseOutfit,
  onOpenOutfit,
  onChangeLook,
  allItems,
  onPlanOutfit,
  isPlanning,
  onOpenStylist,
  weatherFallback,
  isPremium,
  outfit,
}: {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (ev: Event) => void;
  onDelete: (ev: Event) => void;
  onAssign: (ev: Event) => void;
  onChooseOutfit: (ev: Event) => void;
  onOpenOutfit: (ev: Event) => void;
  onChangeLook: (ev: Event) => void;
  allItems: Item[];
  outfit: Outfit | null;
  onPlanOutfit: (event: Event) => void;
  isPlanning: boolean;
  onOpenStylist: (event: Event) => void;
  weatherFallback: StylingLocationContext | null;
  isPremium: boolean;
}) {
  const eventDateStr = event ? event.date.slice(0, 10) : null;
  const forecast = useEventWeatherForecast(
    event?.location,
    weatherFallback,
    eventDateStr,
  );
  const tempUnit = useTempUnit();
  const { width } = useWindowDimensions();
  const [manualExpanded, setManualExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setManualExpanded(false);
    setNotesExpanded(false);
  }, [event?.id, visible]);

  if (!event) return null;
  const d = new Date(event.date);
  const countdown = formatCountdown(d);
  const occasionMeta = OCCASIONS.find((o) => o.id === event.occasion);
  const iconName = (OCCASION_ICONS[event.occasion] ?? 'calendar-outline') as keyof typeof Ionicons.glyphMap;
  const presentation = presentCalendarEvent(event);
  const notesPresentation = presentEventNotes(event.notes);
  const hasOutfit = presentation.hasOutfit;
  const pieceCount = event.itemIds?.length ?? 0;
  const lookWidth = Math.max(240, Math.min(width - spacing.lg * 4, 480));

  const openEventMenu = () => {
    const edit = () => onEdit(event);
    const remove = () => onDelete(event);
    if (process.env.EXPO_OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit event', 'Delete event'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
          title: event.title,
        },
        (index) => {
          if (index === 1) edit();
          if (index === 2) remove();
        },
      );
      return;
    }
    Alert.alert(event.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit event', onPress: edit },
      { text: 'Delete event', style: 'destructive', onPress: remove },
    ]);
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
            <View style={[s.readinessBadge, hasOutfit && s.readinessBadgeReady]}>
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

          <View style={s.metaRow}>
            <Ionicons name="calendar-outline" size={15} color={colors.mutedForeground} />
            <Text selectable style={s.metaText}>{formatDayLabel(d)} · {formatTime(d)}</Text>
            {countdown && (
              <View style={s.countdownBadge}>
                <Text style={s.countdownText}>{countdown}</Text>
              </View>
            )}
            {forecast.data && (
              <View style={s.forecastChip}>
                <Ionicons name={WEATHER_ICONS[forecast.data.condition]} size={12} color={colors.mutedForeground} />
                <Text style={s.forecastText}>
                  {formatTempRange(forecast.data, tempUnit)}
                </Text>
              </View>
            )}
          </View>

          <View style={s.metaRow}>
            <Ionicons name={iconName} size={15} color={colors.mutedForeground} />
            <Text selectable style={s.metaText}>
              {[occasionMeta?.label ?? event.occasion, event.environment].filter(Boolean).join(' · ')}
            </Text>
          </View>

          {event.location ? (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={15} color={colors.mutedForeground} />
              <Text selectable style={s.metaText}>{event.location}</Text>
            </View>
          ) : null}

          {forecast.data ? (
            <Text style={s.weatherSource}>
              {forecast.data.locationSource === 'destination' ? 'Forecast for' : 'Forecast fallback:'}{' '}
              {forecast.data.locationLabel}
            </Text>
          ) : null}

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
                <TouchableOpacity onPress={() => setNotesExpanded((current) => !current)} style={s.notesMoreBtn}>
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

          {isPlanning ? (
            <Animated.View
              style={s.planningCard}
              entering={FadeInDown.duration(180)}
              exiting={FadeOutUp.duration(140)}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Styling your outfit"
              accessibilityLiveRegion="polite"
            >
              <View style={s.planningSpinner}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
              <View style={s.planningCopy}>
                <Text style={s.planningTitle}>Styling your outfit</Text>
                <Text style={s.planningText}>
                  Considering the occasion, forecast, and pieces in your closet…
                </Text>
              </View>
            </Animated.View>
          ) : hasOutfit ? (
            <View style={[s.outfitCard, s.outfitCardReady]}>
              <View style={s.outfitHeader}>
                <View>
                  <Text style={s.outfitLabel}>Planned look</Text>
                  <Text style={s.outfitSubtext}>Your pieces are ready for this event</Text>
                </View>
                <View style={s.readyMark}>
                  <Ionicons name="checkmark" size={14} color={colors.success} />
                </View>
              </View>
              <TouchableOpacity
                style={s.lookPreviewButton}
                onPress={() => onOpenOutfit(event)}
                activeOpacity={0.82}
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
                    <Text style={s.lookPreviewTitle}>{event.outfitId == null ? 'Custom look' : 'Your outfit'}</Text>
                    <Text style={s.lookPreviewMeta}>{pieceCount} {pieceCount === 1 ? 'piece' : 'pieces'}</Text>
                  </View>
                  {event.outfitId != null ? (
                    <View style={s.viewLookPill}>
                      <Text style={s.viewLookText}>View outfit</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[s.outfitCard, s.outfitCardEmpty]}>
              <View style={s.emptyOutfitIcon}>
                <Ionicons name="sparkles-outline" size={19} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.emptyOutfitTitle}>Ready when you are</Text>
                <Text style={s.outfitSubtext}>Build a look from your closet, the occasion, and the forecast.</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={s.actions}>
          <TouchableOpacity
            style={[s.generateBtn, isPlanning && s.generateBtnDisabled]}
            onPress={() => hasOutfit ? onChangeLook(event) : onPlanOutfit(event)}
            disabled={isPlanning}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={hasOutfit
              ? `Change look for ${event.title}`
              : `Generate outfit for ${event.title}${isPremium ? '' : ', Premium feature'}`}
            accessibilityState={{ disabled: isPlanning, busy: isPlanning }}
          >
            {isPlanning ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name={hasOutfit ? 'options-outline' : 'sparkles-outline'} size={18} color={colors.white} />
            )}
            <Text style={s.generateBtnText}>
              {isPlanning ? 'Planning…' : hasOutfit ? 'Change look' : 'Generate outfit'}
            </Text>
            {!isPremium && !hasOutfit && !isPlanning ? (
              <View style={s.proPill}>
                <Text style={s.proPillText}>PRO</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity style={s.stylistBtn} onPress={() => onOpenStylist(event)} activeOpacity={0.8}>
            <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.primary} />
            <Text style={s.stylistBtnText}>Ask stylist about this</Text>
          </TouchableOpacity>

          {!hasOutfit ? (
            <>
              <TouchableOpacity
                style={s.manualToggle}
                onPress={() => setManualExpanded((current) => !current)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ expanded: manualExpanded }}
              >
                <Text style={s.manualToggleText}>Choose manually</Text>
                <Ionicons name={manualExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              {manualExpanded ? (
                <Animated.View style={s.actionRow} entering={FadeInDown.duration(180)} exiting={FadeOutUp.duration(140)}>
                  <TouchableOpacity style={s.assignBtn} onPress={() => onChooseOutfit(event)} activeOpacity={0.8}>
                    <Ionicons name="albums-outline" size={18} color={colors.foreground} />
                    <Text style={s.assignBtnText}>Choose outfit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.assignBtn} onPress={() => onAssign(event)} activeOpacity={0.8}>
                    <Ionicons name="shirt-outline" size={18} color={colors.foreground} />
                    <Text style={s.assignBtnText}>{getEventItemsActionLabel(hasOutfit)}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : null}
            </>
          ) : null}
        </View>
      </View>
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
    width: 40, height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  titleBlock: { gap: spacing.sm, marginBottom: spacing.xs },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    lineHeight: 34,
  },
  readinessBadge: {
    alignSelf: 'flex-start',
    minHeight: 26,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSelected,
  },
  readinessBadgeReady: { backgroundColor: '#E8F0EA' },
  readinessBadgeText: { fontSize: 10, color: colors.primary, fontWeight: typography.weight.semibold },
  readinessBadgeTextReady: { color: colors.success },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { fontSize: typography.size.sm, color: colors.mutedForeground, flex: 1 },
  countdownBadge: {
    backgroundColor: colors.surfaceSelected,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    minHeight: 24,
    justifyContent: 'center',
  },
  countdownText: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },
  forecastChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    minHeight: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  forecastText: { fontSize: 11, color: colors.mutedForeground },
  weatherSource: {
    marginLeft: 23,
    marginTop: -spacing.xs,
    fontSize: 10,
    color: colors.mutedForeground,
  },
  notesCard: {
    gap: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notesLabel: { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  notesText: { fontSize: typography.size.sm, color: colors.inkSubtle, lineHeight: typography.size.sm * 1.5 },
  notesMoreBtn: { minHeight: 32, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
  notesMoreText: { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.semibold },
  sourceLinks: { gap: spacing.xs },
  sourceLink: {
    minHeight: 40,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sourceLinkText: { flex: 1, fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.semibold },
  actions: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  generateBtn: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  stylistBtn: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSelected,
  },
  proPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    marginLeft: spacing.xs,
  },
  proPillText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.white,
    letterSpacing: 0.5,
  },
  stylistBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  generateBtnDisabled: { opacity: 0.7 },
  generateBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  manualToggle: {
    minHeight: 38,
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  manualToggleText: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  assignBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderCurve: 'continuous',
  },
  assignBtnText: { fontSize: typography.size.sm, color: colors.foreground, fontWeight: typography.weight.medium },
  outfitCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  planningCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceSelected,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  planningSpinner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  planningCopy: { flex: 1, gap: 3 },
  planningTitle: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    fontWeight: typography.weight.semibold,
  },
  planningText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    lineHeight: 17,
  },
  outfitCardReady: { backgroundColor: colors.card },
  outfitCardEmpty: { flexDirection: 'row', alignItems: 'center' },
  outfitHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  outfitLabel: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
    color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  outfitSubtext: { fontSize: typography.size.xs, color: colors.mutedForeground, lineHeight: 17, marginTop: 2 },
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  lookPreviewMeta: { marginTop: 2, fontSize: typography.size.xs, color: colors.mutedForeground },
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
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  emptyOutfitIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyOutfitTitle: { fontSize: typography.size.sm, color: colors.foreground, fontWeight: typography.weight.semibold },
});
