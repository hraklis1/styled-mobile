import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '../primitives/AppText';
import { PressableScale } from '../primitives/PressableScale';
import { StylistRichText } from '../stylist/StylistRichText';
import { TripDetailModal } from './TripDetailModal';
import { useTempUnit } from '../../hooks/useTempUnit';
import { TRIPS_QUERY_KEY } from '../../hooks/useTrips';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { tripSpanLabel } from '../../features/stylist/workflows';
import { luggageFitCopy, tripDayParts, weatherIcon } from '../../features/trips/presentation';
import type { TripGap, TripPlanV2 } from '../../features/trips/types';
import type { Item } from '../../types/item';
import { colors, radii, shadows, spacing, stroke } from '../../theme';

const THUMBS = 5;

/**
 * A planned trip in the chat: the strategy in the stylist's words, then a
 * compact cover — dates, the week's weather, the capsule — that opens the full
 * Trip screen.
 */
export function TripSummaryCard({ plan, allItems, onAsk, onShopGap }: {
  plan: TripPlanV2;
  allItems: Item[];
  onAsk?: (prompt: string) => void;
  onShopGap?: (gap: TripGap) => void;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  // A re-plan ("pack lighter") rewrites the same saved trip; drop cached copies
  // so the Trip screen and Calendar show the new plan.
  const planSignature = plan.tripId != null ? `${plan.tripId}:${plan.outfits.map((o) => o.itemIds.join('.')).join('|')}` : null;
  useEffect(() => {
    if (planSignature) void qc.invalidateQueries({ queryKey: TRIPS_QUERY_KEY });
  }, [planSignature, qc]);
  const unit = useTempUnit();
  const temp = (c: number) => `${Math.round(unit === 'F' ? c * 9 / 5 + 32 : c)}°`;
  const span = plan.startDate && plan.endDate ? tripSpanLabel(plan.startDate, plan.endDate) : null;
  const byId = new Map(allItems.map((item) => [item.id, item]));
  const capsule = (plan.packingItemIds ?? []).map((id) => byId.get(id)).filter((item): item is Item => !!item);
  const days = (plan.days ?? []).filter((d) => d.weather).slice(0, 7);
  const stats = plan.stats;
  const fit = luggageFitCopy(stats?.luggageFit);
  const canOpen = plan.tripId != null;

  return (
    <View style={styles.container}>
      {plan.intro ? <StylistRichText text={plan.intro} /> : null}
      <PressableScale
        onPress={() => canOpen && setOpen(true)}
        disabled={!canOpen}
        scaleTo={0.98}
        contentStyle={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`Open trip to ${plan.destination ?? 'your destination'}`}
      >
        <View style={styles.cardHead}>
          <View style={styles.flex}>
            <AppText variant="editorialSection" numberOfLines={1}>{plan.destination ?? 'Your trip'}</AppText>
            {span ? <AppText variant="meta" tone="muted">{[span.range, span.nights].filter(Boolean).join(' · ')}</AppText> : null}
          </View>
          {canOpen ? <Ionicons name="arrow-forward" size={18} color={colors.foreground} /> : null}
        </View>

        {days.length ? (
          <View style={styles.weatherRow}>
            {days.map((day) => {
              const w = day.weather!;
              return (
                <View key={day.date} style={[styles.weatherDay, w.source === 'typical' && styles.typical]}>
                  <AppText variant="utility" tone="muted">{tripDayParts(day.date).weekday.slice(0, 2)}</AppText>
                  <Ionicons name={weatherIcon(w.condition)} size={15} color={colors.foreground} />
                  <AppText variant="meta">{temp(w.highC)}</AppText>
                </View>
              );
            })}
          </View>
        ) : null}

        {capsule.length ? (
          <View style={styles.capsule}>
            {capsule.slice(0, THUMBS).map((item, i) => (
              <View key={item.id} style={[styles.thumb, i > 0 && styles.thumbOverlap, { zIndex: THUMBS - i }]}>
                <Image source={{ uri: itemImageUri(item) }} style={styles.thumbImage} contentFit={itemImageContentFit(item)} cachePolicy="memory-disk" />
              </View>
            ))}
            {capsule.length > THUMBS ? (
              <View style={[styles.thumb, styles.thumbOverlap, styles.more]}>
                <AppText variant="label" tone="secondary">{`+${capsule.length - THUMBS}`}</AppText>
              </View>
            ) : null}
          </View>
        ) : null}

        {stats ? (
          <AppText variant="meta" tone="secondary">
            {[`${stats.looks} ${stats.looks === 1 ? 'look' : 'looks'}`, `${stats.days} ${stats.days === 1 ? 'day' : 'days'}`, `${stats.packedPieces} to pack`, fit].filter(Boolean).join('  ·  ')}
          </AppText>
        ) : null}

        {canOpen ? (
          <View style={styles.cta}>
            <AppText variant="label" tone="inverse">Open trip</AppText>
          </View>
        ) : null}
      </PressableScale>

      <TripDetailModal
        tripId={open ? plan.tripId ?? null : null}
        onClose={() => setOpen(false)}
        onAsk={onAsk ? (prompt) => { setOpen(false); onAsk(prompt); } : undefined}
        onShopGap={onShopGap ? (gap) => { setOpen(false); onShopGap(gap); } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  flex: { flex: 1 },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: stroke.hairline, borderColor: colors.hairline, padding: spacing.lg, gap: spacing.md, marginTop: spacing.xs, ...shadows.control },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weatherRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: stroke.hairline, borderBottomWidth: stroke.hairline, borderColor: colors.hairline },
  weatherDay: { alignItems: 'center', gap: 3, minWidth: 32 },
  typical: { opacity: 0.5 },
  capsule: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.imageMat, borderWidth: 2, borderColor: colors.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbOverlap: { marginLeft: -12 },
  thumbImage: { width: '100%', height: '100%' },
  more: { backgroundColor: colors.surfaceSubtle },
  cta: { alignItems: 'center', paddingVertical: spacing.md, borderRadius: radii.action, backgroundColor: colors.primary, marginTop: spacing.xs },
});
