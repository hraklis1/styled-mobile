import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../primitives/AppText';
import { AnimatedProgressBar } from '../primitives/AnimatedProgressBar';
import { PressableScale } from '../primitives/PressableScale';
import { StylistRichText } from '../stylist/StylistRichText';
import { GapCard } from '../stylist/GapCard';
import { TripOutfitCard } from './TripOutfitCard';
import { useItems } from '../../hooks/useItems';
import { useCreateOutfit } from '../../hooks/useOutfits';
import { useDeleteTrip, useSetTripPacked, useTrip } from '../../hooks/useTrips';
import { useTempUnit } from '../../hooks/useTempUnit';
import * as Haptics from '../../lib/haptics';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { tripSpanLabel } from '../../features/stylist/workflows';
import { daysWearingLook, luggageFitCopy, orderLookPieces, packingGroups, packingProgress, tripDayParts, weatherIcon } from '../../features/trips/presentation';
import type { Trip, TripDayWeather, TripGap, TripPlanDay } from '../../features/trips/types';
import type { Item } from '../../types/item';
import { colors, radii, spacing, stroke, typography } from '../../theme';

type Tab = 'days' | 'packing' | 'looks';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'days', label: 'Itinerary' },
  { key: 'packing', label: 'Packing' },
  { key: 'looks', label: 'Looks' },
];

export type TripDetailViewProps = {
  tripId: number;
  onClose: () => void;
  /** Sends a request to the stylist in this trip's conversation. Hidden when absent. */
  onAsk?: (prompt: string) => void;
  onShopGap?: (gap: TripGap) => void;
};

function useTemp() {
  const unit = useTempUnit();
  return useCallback((c: number) => `${Math.round(unit === 'F' ? c * 9 / 5 + 32 : c)}°`, [unit]);
}

function lookPieces(look: { status?: string; itemIds: number[]; foundationItemIds?: number[] }) {
  return look.status === 'incomplete' ? look.foundationItemIds ?? look.itemIds : look.itemIds;
}

export function TripDetailView({ tripId, onClose, onAsk, onShopGap }: TripDetailViewProps) {
  const insets = useSafeAreaInsets();
  const { data: trip, isLoading, isError, refetch } = useTrip(tripId);
  const { data: items = [] } = useItems();
  const [tab, setTab] = useState<Tab>('days');
  const deleteTrip = useDeleteTrip();

  const confirmDelete = () => {
    Alert.alert('Delete this trip?', 'The plan and your packing progress will be removed. Saved outfits stay in your closet.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTrip.mutate(tripId, { onSuccess: onClose }) },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close trip" style={styles.iconButton}>
          <Ionicons name="chevron-down" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <AppText variant="masthead" tone="muted">Trip</AppText>
        <TouchableOpacity onPress={confirmDelete} hitSlop={12} accessibilityRole="button" accessibilityLabel="Delete trip" style={styles.iconButton} disabled={!trip}>
          <Ionicons name="trash-outline" size={19} color={trip ? colors.mutedForeground : 'transparent'} />
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.mutedForeground} /></View>
      ) : isError || !trip ? (
        <View style={styles.center}>
          <AppText variant="editorialCard">This trip couldn't load.</AppText>
          <TouchableOpacity onPress={() => refetch()} style={styles.retry} accessibilityRole="button">
            <AppText variant="label">Try again</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <TripHero trip={trip} />
          <View style={styles.tabsWrap}>
            <View style={styles.tabs} accessibilityRole="tablist">
              {TABS.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tab, tab === t.key && styles.tabActive]}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setTab(t.key); }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t.key }}
                >
                  <AppText variant="label" tone={tab === t.key ? 'inverse' : 'secondary'}>{t.label}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {tab === 'days' ? <Itinerary trip={trip} items={items} onAsk={onAsk} onShowLooks={() => setTab('looks')} />
            : tab === 'packing' ? <Packing trip={trip} items={items} onShopGap={onShopGap} />
            : <Looks trip={trip} items={items} />}
          {onAsk ? <Refine onAsk={onAsk} /> : null}
        </ScrollView>
      )}
    </View>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────────

function TripHero({ trip }: { trip: Trip }) {
  const temp = useTemp();
  const plan = trip.plan;
  const span = tripSpanLabel(trip.startDate, trip.endDate);
  const country = plan.place?.split(', ').slice(1).join(', ');
  const fit = luggageFitCopy(plan.stats?.luggageFit);
  const days = plan.days ?? [];
  const hasTypical = days.some((d) => d.weather?.source === 'typical');
  return (
    <View style={styles.hero}>
      <AppText variant="eyebrow" tone="muted">{[span?.range, span?.nights].filter(Boolean).join('  ·  ')}</AppText>
      <AppText variant="editorialHero" style={styles.heroTitle}>{trip.destination}</AppText>
      {country ? <AppText variant="meta" tone="muted">{country}</AppText> : null}
      {plan.intro ? <View style={styles.intro}><StylistRichText text={plan.intro} /></View> : null}
      {plan.stats ? (
        <View style={styles.stats}>
          <Stat value={String(plan.stats.looks)} label={plan.stats.looks === 1 ? 'look' : 'looks'} />
          <View style={styles.statRule} />
          <Stat value={String(plan.stats.packedPieces)} label="to pack" />
          <View style={styles.statRule} />
          <Stat value={plan.stats.wearsPerPiece.toFixed(1)} label="wears a piece" />
        </View>
      ) : null}
      {fit ? (
        <View style={[styles.fitPill, plan.stats?.luggageFit === 'over' && styles.fitPillWarn]}>
          <Ionicons name="briefcase-outline" size={13} color={plan.stats?.luggageFit === 'over' ? colors.error : colors.accentInk} />
          <AppText variant="meta" style={{ color: plan.stats?.luggageFit === 'over' ? colors.error : colors.accentInk }}>{fit}</AppText>
        </View>
      ) : null}
      {days.some((d) => d.weather) ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weatherStrip} style={styles.weatherScroll}>
            {days.map((day) => <WeatherCell key={day.date} date={day.date} weather={day.weather ?? null} temp={temp} />)}
          </ScrollView>
          {hasTypical ? <AppText variant="meta" tone="muted" style={styles.weatherNote}>Faded days are typical weather for those dates, not a forecast yet.</AppText> : null}
        </>
      ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="editorialSection" style={styles.statValue}>{value}</AppText>
      <AppText variant="meta" tone="muted">{label}</AppText>
    </View>
  );
}

function WeatherCell({ date, weather, temp }: { date: string; weather: TripDayWeather | null; temp: (c: number) => string }) {
  const parts = tripDayParts(date);
  const typical = weather?.source === 'typical';
  return (
    <View style={[styles.weatherCell, typical && styles.weatherTypical]} accessibilityLabel={weather ? `${parts.weekday} ${parts.day}: ${weather.condition}, high ${temp(weather.highC)}, low ${temp(weather.lowC)}${typical ? ', typical' : ''}` : `${parts.weekday} ${parts.day}`}>
      <AppText variant="utility" tone="muted">{parts.weekday}</AppText>
      <AppText variant="data">{parts.day}</AppText>
      {weather ? (
        <>
          <Ionicons name={weatherIcon(weather.condition)} size={18} color={colors.foreground} style={styles.weatherIcon} />
          <AppText variant="label">{temp(weather.highC)}</AppText>
          <AppText variant="meta" tone="muted">{temp(weather.lowC)}</AppText>
        </>
      ) : <AppText variant="meta" tone="muted">—</AppText>}
    </View>
  );
}

// ── Itinerary ──────────────────────────────────────────────────────────────────

function Itinerary({ trip, items, onAsk, onShowLooks }: { trip: Trip; items: Item[]; onAsk?: (prompt: string) => void; onShowLooks: () => void }) {
  const days = trip.plan.days ?? [];
  return (
    <View style={styles.section}>
      {days.map((day, i) => (
        <DayRow key={day.date} index={i} last={i === days.length - 1} day={day} trip={trip} items={items} onAsk={onAsk} onShowLooks={onShowLooks} />
      ))}
    </View>
  );
}

function DayRow({ day, index, last, trip, items, onAsk, onShowLooks }: { day: TripPlanDay; index: number; last: boolean; trip: Trip; items: Item[]; onAsk?: (prompt: string) => void; onShowLooks: () => void }) {
  const temp = useTemp();
  const parts = tripDayParts(day.date);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const uses = useMemo(() => new Map((trip.plan.capsule ?? []).map((c) => [c.itemId, c.uses])), [trip.plan.capsule]);
  const title = day.title || (day.lookIndexes.length ? 'Your day' : 'A free day');
  return (
    <View style={styles.dayRow}>
      <View style={styles.dayRail}>
        <AppText variant="chapterNumeral" tone="muted" numberOfLines={1}>{String(index + 1).padStart(2, '0')}</AppText>
        {!last ? <View style={styles.dayLine} /> : null}
      </View>
      <View style={styles.dayBody}>
        <AppText variant="eyebrow" tone="muted">{`${parts.weekday} ${parts.day} ${parts.month}`}</AppText>
        <View style={styles.dayTitleRow}>
          <AppText variant="editorialCard" style={styles.dayTitle}>{title}</AppText>
          {day.weather ? (
            <View style={styles.dayWeather}>
              <Ionicons name={weatherIcon(day.weather.condition)} size={14} color={colors.mutedForeground} />
              <AppText variant="meta" tone="muted">{`${temp(day.weather.highC)} / ${temp(day.weather.lowC)}`}</AppText>
            </View>
          ) : null}
        </View>
        {day.note ? <AppText variant="bodySmall" tone="secondary" style={styles.dayNote}>{day.note}</AppText> : null}
        {day.lookIndexes.length ? (
          <View style={styles.dayLooks}>
            {day.lookIndexes.map((lookIndex, slot) => {
              const look = trip.plan.outfits[lookIndex];
              if (!look) return null;
              const pieces = lookPieces(look).map((id) => byId.get(id)).filter((item): item is Item => !!item);
              return (
                <PressableScale key={`${lookIndex}-${slot}`} onPress={onShowLooks} contentStyle={styles.dayLook} accessibilityRole="button" accessibilityLabel={`${look.label}. Show all looks`}>
                  <View style={styles.dayLookText}>
                    <AppText variant="utility" tone="muted">{slot === 0 ? (day.lookIndexes.length > 1 ? 'Day' : 'Look') : 'Evening'}</AppText>
                    <AppText variant="productName" numberOfLines={1}>{look.label}</AppText>
                    {trip.plan.travelLookIndex === lookIndex && (index === 0 || last) ? <AppText variant="meta" style={styles.transitTag}>Worn in transit</AppText> : null}
                    {look.status === 'incomplete' ? <AppText variant="meta" tone="danger">Needs a piece</AppText> : null}
                  </View>
                  <PieceStrip pieces={orderLookPieces(pieces)} uses={uses} />
                </PressableScale>
              );
            })}
          </View>
        ) : null}
        {onAsk ? (
          <TouchableOpacity
            style={styles.swap}
            onPress={() => onAsk(`Swap the look for ${parts.weekday} ${parts.day} ${parts.month}${day.title ? ` (${day.title})` : ''}. Keep the rest of the trip plan the same.`)}
            accessibilityRole="button"
            accessibilityLabel={`Swap the look for ${parts.weekday} ${parts.day}`}
          >
            <Ionicons name="swap-horizontal" size={14} color={colors.mutedForeground} />
            <AppText variant="meta" tone="muted">Swap this day</AppText>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const STRIP_MAX = 5;

/**
 * A look as a row of equal tiles rather than a collage: every piece shows
 * whole, and a piece re-worn across the trip is the same tile day after day,
 * marked with its wear count.
 */
function PieceStrip({ pieces, uses }: { pieces: Item[]; uses: Map<number, number> }) {
  const overflow = pieces.length > STRIP_MAX ? pieces.length - (STRIP_MAX - 1) : 0;
  const shown = overflow ? pieces.slice(0, STRIP_MAX - 1) : pieces;
  return (
    <View style={styles.strip}>
      {shown.map((item) => {
        const n = uses.get(item.id) ?? 1;
        return (
          <View key={item.id} style={styles.stripTile}>
            <Image source={{ uri: itemImageUri(item) }} contentFit={itemImageContentFit(item)} style={styles.thumbImage} accessibilityLabel={item.name} />
            {n > 1 ? (
              <View style={styles.stripBadge}>
                <AppText variant="meta" style={styles.stripBadgeText}>{`${n}×`}</AppText>
              </View>
            ) : null}
          </View>
        );
      })}
      {overflow ? (
        <View style={[styles.stripTile, styles.stripMore]}>
          <AppText variant="meta" tone="muted">{`+${overflow}`}</AppText>
        </View>
      ) : null}
    </View>
  );
}

// ── Packing ────────────────────────────────────────────────────────────────────

function Packing({ trip, items, onShopGap }: { trip: Trip; items: Item[]; onShopGap?: (gap: TripGap) => void }) {
  const setPacked = useSetTripPacked(trip.id);
  const { transit, groups } = useMemo(() => packingGroups(trip.plan, items), [trip.plan, items]);
  const progress = packingProgress(trip.plan, items, trip.packedItemIds, trip.packedExtras);
  const packed = new Set(trip.packedItemIds);
  const packedExtras = new Set(trip.packedExtras.map((e) => e.toLowerCase()));

  const toggleItem = (id: number) => {
    Haptics.selectionAsync().catch(() => {});
    const next = packed.has(id) ? trip.packedItemIds.filter((x) => x !== id) : [...trip.packedItemIds, id];
    setPacked.mutate({ itemIds: next, extras: trip.packedExtras });
  };
  const toggleExtra = (extra: string) => {
    Haptics.selectionAsync().catch(() => {});
    const has = packedExtras.has(extra.toLowerCase());
    const next = has ? trip.packedExtras.filter((e) => e.toLowerCase() !== extra.toLowerCase()) : [...trip.packedExtras, extra];
    setPacked.mutate({ itemIds: trip.packedItemIds, extras: next });
  };

  return (
    <View style={styles.section}>
      <View style={styles.progress}>
        <View style={styles.progressText}>
          <AppText variant="editorialSection">{progress.done === progress.total && progress.total > 0 ? 'All packed' : `${progress.done} of ${progress.total} packed`}</AppText>
          {progress.done === progress.total && progress.total > 0 ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
        </View>
        <AnimatedProgressBar progress={progress.fraction * 100} height={4} />
      </View>

      {transit.length ? (
        <View style={styles.group}>
          <AppText variant="eyebrow" tone="muted">Wear on the way</AppText>
          <AppText variant="meta" tone="muted" style={styles.groupHint}>The bulkiest pieces travel on you, not in the bag.</AppText>
          {transit.map((row) => <PieceRow key={row.item.id} item={row.item} uses={row.uses} />)}
        </View>
      ) : null}

      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <AppText variant="eyebrow" tone="muted">{group.title}</AppText>
          {group.rows.map((row) => (
            <PieceRow key={row.item.id} item={row.item} uses={row.uses} checked={packed.has(row.item.id)} onToggle={() => toggleItem(row.item.id)} />
          ))}
        </View>
      ))}

      {trip.plan.packingList.length ? (
        <View style={styles.group}>
          <AppText variant="eyebrow" tone="muted">Also bring</AppText>
          {trip.plan.packingList.map((extra) => {
            const checked = packedExtras.has(extra.toLowerCase());
            return (
              <TouchableOpacity key={extra} style={styles.extraRow} onPress={() => toggleExtra(extra)} accessibilityRole="checkbox" accessibilityState={{ checked }}>
                <Check checked={checked} />
                <AppText variant="body" style={[styles.flex, checked && styles.done]}>{extra}</AppText>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {trip.plan.gaps?.length ? (
        <View style={styles.group}>
          <AppText variant="eyebrow" tone="muted">Before you go</AppText>
          <AppText variant="meta" tone="muted" style={styles.groupHint}>Pieces that would finish the plan. Worth it only if you'd wear them again.</AppText>
          {trip.plan.gaps.map((gap, i) => <GapCard key={`${gap.category}-${i}`} item={gap} onPress={onShopGap ? () => onShopGap(gap) : undefined} style={styles.gap} />)}
        </View>
      ) : null}
    </View>
  );
}

function Check({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.check, checked && styles.checkOn]}>
      {checked ? <Ionicons name="checkmark" size={14} color={colors.primaryForeground} /> : null}
    </View>
  );
}

function PieceRow({ item, uses, checked, onToggle }: { item: Item; uses: number; checked?: boolean; onToggle?: () => void }) {
  const body = (
    <>
      <View style={styles.thumb}>
        <Image source={{ uri: itemImageUri(item) }} style={styles.thumbImage} contentFit={itemImageContentFit(item)} cachePolicy="memory-disk" />
      </View>
      <View style={styles.flex}>
        <AppText variant="productName" numberOfLines={1} style={checked && styles.done}>{item.name}</AppText>
        <AppText variant="meta" tone="muted">{uses === 1 ? 'In 1 look' : `In ${uses} looks`}</AppText>
      </View>
      {onToggle ? <Check checked={!!checked} /> : <Ionicons name="walk-outline" size={16} color={colors.mutedForeground} />}
    </>
  );
  return onToggle ? (
    <TouchableOpacity style={styles.pieceRow} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: !!checked }} accessibilityLabel={item.name}>{body}</TouchableOpacity>
  ) : <View style={styles.pieceRow}>{body}</View>;
}

// ── Looks ──────────────────────────────────────────────────────────────────────

function Looks({ trip, items }: { trip: Trip; items: Item[] }) {
  const { width } = useWindowDimensions();
  const createOutfit = useCreateOutfit();
  const cardWidth = width - spacing.page * 2;
  return (
    <View style={[styles.section, styles.looks]}>
      {trip.plan.outfits.map((outfit, i) => {
        const worn = daysWearingLook(trip.plan, i);
        return (
          <View key={`${outfit.label}-${i}`} style={styles.lookBlock}>
            {worn ? <AppText variant="meta" tone="muted" style={styles.lookWorn}>{`Worn ${worn}${trip.plan.travelLookIndex === i ? ' · in transit' : ''}`}</AppText> : null}
            <TripOutfitCard outfit={outfit} allItems={items} createOutfit={createOutfit} cardWidth={cardWidth} intro={trip.plan.intro} index={i} total={trip.plan.outfits.length} gapsTitle="Complete before packing" />
          </View>
        );
      })}
    </View>
  );
}

// ── Refine ─────────────────────────────────────────────────────────────────────

const REFINEMENTS = [
  { label: 'Pack lighter', prompt: 'Pack lighter: rework this trip with fewer pieces while keeping every day covered.' },
  { label: 'Dressier evenings', prompt: 'Make the evenings on this trip a little dressier, using what I own.' },
  { label: 'Rework for the weather', prompt: "Check this trip against the latest weather and adjust any day that isn't dressed for it." },
];

function Refine({ onAsk }: { onAsk: (prompt: string) => void }) {
  return (
    <View style={styles.refine}>
      <AppText variant="eyebrow" tone="muted">Refine with your stylist</AppText>
      <View style={styles.refineChips}>
        {REFINEMENTS.map((r) => (
          <TouchableOpacity key={r.label} style={styles.refineChip} onPress={() => onAsk(r.prompt)} accessibilityRole="button">
            <AppText variant="label">{r.label}</AppText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, height: 48 },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  retry: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.action, borderWidth: stroke.fine, borderColor: colors.border },
  flex: { flex: 1 },
  done: { color: colors.mutedForeground, textDecorationLine: 'line-through' },

  hero: { paddingHorizontal: spacing.page, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  heroTitle: { marginTop: spacing.xs },
  intro: { marginTop: spacing.lg },
  stats: { flexDirection: 'row', alignItems: 'stretch', marginTop: spacing.xl, paddingVertical: spacing.md, borderTopWidth: stroke.hairline, borderBottomWidth: stroke.hairline, borderColor: colors.hairline },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontVariant: ['tabular-nums'] },
  statRule: { width: stroke.hairline, backgroundColor: colors.hairline },
  fitPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.action, backgroundColor: colors.accent },
  fitPillWarn: { backgroundColor: '#F4E3E1' },
  weatherScroll: { marginTop: spacing.lg, marginHorizontal: -spacing.page },
  weatherStrip: { paddingHorizontal: spacing.page, gap: spacing.sm },
  weatherCell: { width: 56, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: stroke.hairline, borderColor: colors.hairline, gap: 2 },
  weatherTypical: { opacity: 0.55, borderStyle: 'dashed', borderWidth: stroke.fine },
  weatherIcon: { marginVertical: spacing.xs },
  weatherNote: { marginTop: spacing.sm },

  tabsWrap: { backgroundColor: colors.background, paddingHorizontal: spacing.page, paddingVertical: spacing.sm },
  tabs: { flexDirection: 'row', padding: 3, borderRadius: radii.action, backgroundColor: colors.surfaceSubtle },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.action },
  tabActive: { backgroundColor: colors.primary },

  section: { paddingHorizontal: spacing.page, paddingTop: spacing.lg },
  dayRow: { flexDirection: 'row', gap: spacing.md },
  dayRail: { width: 44, alignItems: 'center' },
  dayLine: { flex: 1, width: stroke.hairline, backgroundColor: colors.border, marginTop: spacing.xs },
  dayBody: { flex: 1, paddingBottom: spacing.xl },
  dayTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginTop: 2 },
  dayTitle: { flex: 1 },
  dayWeather: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayNote: { marginTop: spacing.xs },
  dayLooks: { marginTop: spacing.md, gap: spacing.md },
  dayLook: { gap: spacing.sm },
  dayLookText: { gap: 2 },
  strip: { flexDirection: 'row', gap: spacing.xs },
  stripTile: { flex: 1, maxWidth: 64, aspectRatio: 1, borderRadius: radii.photo, backgroundColor: colors.imageMat, overflow: 'hidden' },
  stripMore: { alignItems: 'center', justifyContent: 'center' },
  stripBadge: { position: 'absolute', right: 3, bottom: 3, paddingHorizontal: 4, borderRadius: 6, backgroundColor: colors.background },
  stripBadgeText: { fontSize: 10, lineHeight: 14, color: colors.accentInk },
  transitTag: { color: colors.accentInk },
  swap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, alignSelf: 'flex-start' },

  progress: { gap: spacing.md, paddingBottom: spacing.lg },
  progressText: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  group: { paddingTop: spacing.lg, gap: spacing.xs },
  groupHint: { marginBottom: spacing.xs },
  pieceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: stroke.hairline, borderColor: colors.hairline },
  thumb: { width: 48, height: 48, borderRadius: radii.photo, backgroundColor: colors.imageMat, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: stroke.hairline, borderColor: colors.hairline },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: stroke.fine, borderColor: colors.controlOutline, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  gap: { marginTop: spacing.sm },

  looks: { gap: spacing.xl },
  lookBlock: { gap: spacing.xs },
  lookWorn: { ...typography.text.meta },

  refine: { paddingHorizontal: spacing.page, paddingTop: spacing.xxl, gap: spacing.md },
  refineChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  refineChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radii.action, borderWidth: stroke.fine, borderColor: colors.border, backgroundColor: colors.card },
});
