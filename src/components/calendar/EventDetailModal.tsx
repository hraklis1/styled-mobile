import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWeatherForecast, type WeatherCondition } from '../../hooks/useWeather';
import { useGenerateOutfit, type GenerateOutfitResult } from '../../hooks/useOutfits';
import { ItemThumbStack } from './ItemThumbStack';
import { OCCASIONS, OCCASION_ICONS, formatDayLabel, formatTime, formatCountdown } from './calendarUtils';
import { colors, spacing, typography, radii } from '../../theme';
import type { Item } from '../../types/item';
import type { Event } from '../../types/event';

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
  allItems,
  generateOutfit,
  onViewOutfits,
  onOpenStylist,
  deviceCoords,
}: {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (ev: Event) => void;
  onDelete: (ev: Event) => void;
  onAssign: (ev: Event) => void;
  allItems: Item[];
  generateOutfit: ReturnType<typeof useGenerateOutfit>;
  onViewOutfits: () => void;
  onOpenStylist: (event: Event) => void;
  deviceCoords: { lat: number; lon: number } | null;
}) {
  const eventDateStr = event ? event.date.slice(0, 10) : null;
  const forecast = useWeatherForecast(
    deviceCoords?.lat ?? null,
    deviceCoords?.lon ?? null,
    eventDateStr,
  );

  if (!event) return null;
  const d = new Date(event.date);
  const countdown = formatCountdown(d);
  const occasionMeta = OCCASIONS.find((o) => o.id === event.occasion);
  const iconName = (OCCASION_ICONS[event.occasion] ?? 'calendar-outline') as keyof typeof Ionicons.glyphMap;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.circleBtn}>
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onEdit(event)} style={s.circleBtn}>
            <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.title}>{event.title}</Text>

          <View style={s.metaRow}>
            <Ionicons name="calendar-outline" size={15} color={colors.mutedForeground} />
            <Text style={s.metaText}>{formatDayLabel(d)} · {formatTime(d)}</Text>
            {countdown && (
              <View style={s.countdownBadge}>
                <Text style={s.countdownText}>{countdown}</Text>
              </View>
            )}
            {forecast.data && (
              <View style={s.forecastChip}>
                <Ionicons name={WEATHER_ICONS[forecast.data.condition]} size={12} color={colors.mutedForeground} />
                <Text style={s.forecastText}>
                  {forecast.data.tempMinF}–{forecast.data.tempMaxF}°F
                </Text>
              </View>
            )}
          </View>

          <View style={s.metaRow}>
            <Ionicons name={iconName} size={15} color={colors.mutedForeground} />
            <Text style={s.metaText}>{occasionMeta?.label ?? event.occasion}</Text>
          </View>

          {event.location ? (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={15} color={colors.mutedForeground} />
              <Text style={s.metaText}>{event.location}</Text>
            </View>
          ) : null}

          {event.environment ? (
            <View style={s.metaRow}>
              <Ionicons name="home-outline" size={15} color={colors.mutedForeground} />
              <Text style={s.metaText}>{event.environment}</Text>
            </View>
          ) : null}

          {event.notes?.trim() ? (
            <View style={s.notesCard}>
              <Ionicons name="document-text-outline" size={15} color={colors.mutedForeground} />
              <Text style={s.notesText}>{event.notes}</Text>
            </View>
          ) : null}

          {(event.itemIds ?? []).length > 0 ? (
            <View style={s.outfitCard}>
              <Text style={s.outfitLabel}>Outfit</Text>
              <View style={s.outfitRow}>
                <ItemThumbStack itemIds={event.itemIds!} allItems={allItems} onPress={() => onAssign(event)} />
                <TouchableOpacity onPress={() => onAssign(event)} style={s.changeOutfitBtn}>
                  <Text style={s.changeOutfitText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={s.actions}>
          <TouchableOpacity
            style={s.stylistBtn}
            onPress={() => onOpenStylist(event)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Ask AI Stylist what to wear to ${event.title}`}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
            <Text style={s.stylistBtnText}>Dress me for this event</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.generateBtn, generateOutfit.isPending && s.generateBtnDisabled]}
            onPress={() => {
              generateOutfit.mutate({ eventId: event.id }, {
                onSuccess: (result: GenerateOutfitResult) => {
                  Alert.alert(
                    'Outfit Generated',
                    `"${result.outfitName}"${result.stylistNotes ? `\n\n${result.stylistNotes}` : ''}`,
                    [
                      { text: 'View in Outfits', onPress: () => { onClose(); onViewOutfits(); } },
                      { text: 'Done', style: 'cancel' },
                    ]
                  );
                },
                onError: (err: any) => {
                  const msg = err?.response?.data?.message ?? 'Could not generate an outfit. Please try again.';
                  Alert.alert('Generation Failed', msg);
                },
              });
            }}
            disabled={generateOutfit.isPending}
            activeOpacity={0.85}
          >
            {generateOutfit.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="sparkles-outline" size={18} color={colors.white} />
            )}
            <Text style={s.generateBtnText}>
              {generateOutfit.isPending ? 'Generating…' : 'Generate Outfit with AI'}
            </Text>
          </TouchableOpacity>
          <View style={s.actionRow}>
            <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(event)} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={s.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.assignBtn} onPress={() => onAssign(event)} activeOpacity={0.8}>
              <Ionicons name="shirt-outline" size={18} color={colors.foreground} />
              <Text style={s.assignBtnText}>{(event.itemIds ?? []).length > 0 ? 'Edit Outfit' : 'Assign Outfit'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.editBtnFull} onPress={() => onEdit(event)} activeOpacity={0.8}>
              <Ionicons name="pencil-outline" size={18} color={colors.foreground} />
              <Text style={s.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: spacing.sm,
  },
  circleBtn: {
    width: 36, height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { fontSize: typography.size.sm, color: colors.mutedForeground, flex: 1 },
  countdownBadge: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countdownText: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },
  forecastChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.muted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  forecastText: { fontSize: 11, color: colors.mutedForeground },
  notesCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  notesText: { fontSize: typography.size.sm, color: colors.foreground, flex: 1, lineHeight: typography.size.sm * 1.5 },
  actions: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  stylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
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
    gap: spacing.md,
  },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
  },
  deleteBtnText: { fontSize: typography.size.sm, color: colors.error, fontWeight: typography.weight.medium },
  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  assignBtnText: { fontSize: typography.size.sm, color: colors.foreground, fontWeight: typography.weight.medium },
  editBtnFull: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  editBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  outfitCard: {
    backgroundColor: colors.muted, borderRadius: radii.md, padding: spacing.md,
    marginTop: spacing.xs, gap: spacing.sm,
  },
  outfitLabel: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
    color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  outfitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  changeOutfitBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  changeOutfitText: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },
});
