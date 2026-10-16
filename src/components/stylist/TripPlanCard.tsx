import { StylistRichText } from './StylistRichText';
import { useState } from 'react';
import {
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreateOutfit, type CreateOutfitInput } from '../../hooks/useOutfits';
import { colors, spacing, stroke, typography } from '../../theme';
import type { Item } from '../../types/item';
import { TripSummaryCard } from '../trips/TripSummaryCard';
import { isTripPlanV2, type TripGap, type TripPlanV2Fields } from '../../features/trips/types';
import { TripOutfitCard, type EventContext, type TripOutfit } from '../trips/TripOutfitCard';

export type { TripOutfit } from '../trips/TripOutfitCard';
export type TripPlanData = Omit<TripPlanV2Fields, 'kind'> & {
  intro: string;
  outfits: TripOutfit[];
  packingList: string[];
  kind?: 'trip' | 'board_capsule' | 'style_item';
  /** style_item: the owned piece every look is built around. */
  anchorItemId?: number;
  // Set while the stream is still delivering outfit events so the carousel can
  // show placeholder slots ("filling in…") before the done event arrives.
  pending?: boolean;
};


/**
 * A v2 trip (saved, day by day) shows as a summary that opens the Trip screen;
 * capsules, style-item looks, v1 trips and a plan still streaming keep the
 * carousel. Split so each branch keeps a stable hook order across the switch.
 */
export function TripPlanCard(props: Parameters<typeof TripPlanCarousel>[0] & {
  /** Trip v2: stages a request in the trip's conversation (Swap a day, Pack lighter). */
  onAsk?: (prompt: string) => void;
  onShopGap?: (gap: TripGap) => void;
}) {
  const { plan, allItems, onAsk, onShopGap, ...rest } = props;
  if (!plan.pending && (!plan.kind || plan.kind === 'trip') && isTripPlanV2(plan)) {
    return <TripSummaryCard plan={plan as Parameters<typeof TripSummaryCard>[0]['plan']} allItems={allItems} onAsk={onAsk} onShopGap={onShopGap} />;
  }
  return <TripPlanCarousel plan={plan} allItems={allItems} {...rest} />;
}

function TripPlanCarousel({
  plan,
  allItems,
  createOutfit,
  eventContext,
  onAddToEvent,
  onNavigateToCloset,
  onSaveOutfit,
  saveLabel,
  eyebrowLabel,
}: {
  plan: TripPlanData;
  allItems: Item[];
  createOutfit: ReturnType<typeof useCreateOutfit>;
  eventContext?: EventContext;
  onAddToEvent?: (itemIds: number[]) => Promise<unknown>;
  /** Override what saving a look does — defaults to createOutfit.mutateAsync. */
  onNavigateToCloset?: (outfitId: number) => void;
  onSaveOutfit?: (input: CreateOutfitInput) => Promise<unknown>;
  saveLabel?: string;
  /** Replaces the "Trip plan" / "Board capsule" eyebrow, e.g. for a single board look. */
  eyebrowLabel?: string;
}) {
  const { width } = useWindowDimensions();
  // One card fills the column with the next peeking in by a clear margin,
  // so the rail reads as swipeable rather than clipped.
  const CARD_GAP = spacing.lg;
  const PEEK = 36;
  const cardWidth = Math.min(width - spacing.page * 2 - PEEK, 360);
  // Trailing room equal to the leftover column width lets the LAST card snap
  // flush left too, instead of stopping with the previous card showing.
  const trailing = Math.max(0, width - spacing.page * 2 - cardWidth);
  const [packed, setPacked] = useState<Record<number, boolean>>({});
  const [activeOutfit, setActiveOutfit] = useState(0);
  // A horizontal rail is as tall as its tallest card, which strands a short
  // look above empty space. Measure each card and fit the rail to the one in
  // view, easing the change as the reader swipes.
  const [cardHeights, setCardHeights] = useState<Record<number, number>>({});
  const activeHeight = cardHeights[activeOutfit];
  const goToOutfit = (next: number) => {
    if (next === activeOutfit) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setActiveOutfit(next);
  };
  const [packingExpanded, setPackingExpanded] = useState(false);
  const isBoardCapsule = plan.kind === 'board_capsule';
  const isStyleItem = plan.kind === 'style_item';
  // Only a real trip (it comes with a packing list) talks about packing;
  // capsules, style-item looks and multi-event plans just need the piece.
  const isPackingTrip = (!plan.kind || plan.kind === 'trip') && plan.packingList.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.sectionEyebrow}>
        <Ionicons name={isBoardCapsule ? 'albums-outline' : isStyleItem ? 'shirt-outline' : 'briefcase-outline'} size={13} color={colors.primary} />
        <Text style={styles.sectionEyebrowText}>{eyebrowLabel ?? (isBoardCapsule ? 'Board capsule' : isStyleItem ? 'Ways to wear it' : 'Trip plan')}</Text>
      </View>
      {plan.intro ? <StylistRichText text={plan.intro} /> : null}

      <ScrollView
        horizontal
        style={activeHeight && !plan.pending ? { height: activeHeight + spacing.xs * 2 } : undefined}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.carousel, { paddingRight: trailing }]}
        decelerationRate="fast"
        snapToInterval={cardWidth + CARD_GAP}
        onMomentumScrollEnd={(event) => {
          const page = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP));
          goToOutfit(Math.max(0, Math.min(page, plan.outfits.length - 1)));
        }}
      >
        {plan.outfits.map((o, i) => (
          <View
            key={`${o.label}-${i}`}
            onLayout={(event) => {
              const h = Math.round(event.nativeEvent.layout.height);
              setCardHeights((prev) => (prev[i] === h ? prev : { ...prev, [i]: h }));
            }}
          >
          <TripOutfitCard
            gapsTitle={isPackingTrip ? 'Complete before packing' : 'Complete the look'}
            index={i}
            total={plan.outfits.length}
            outfit={o}
            allItems={allItems}
            createOutfit={createOutfit}
            cardWidth={cardWidth}
            intro={plan.intro}
            eventContext={eventContext}
            onAddToEvent={onAddToEvent}
            onNavigateToCloset={onNavigateToCloset}
            onSaveOutfit={onSaveOutfit}
            saveLabel={saveLabel}
          />
          </View>
        ))}
        {plan.pending && (
          <View style={[styles.outfitCard, styles.placeholderCard, { width: cardWidth }]}>
            <Ionicons name="sparkles-outline" size={22} color={colors.mutedForeground} />
            <Text style={styles.placeholderText}>Filling in your looks…</Text>
          </View>
        )}
      </ScrollView>


      {plan.packingList.length > 0 && (
        <View style={styles.packing}>
          <TouchableOpacity style={styles.packingHeader} onPress={() => setPackingExpanded((open) => !open)}>
            <View>
              <Text style={styles.packingTitle}>{isBoardCapsule ? 'Capsule checklist' : 'Packing list'}</Text>
              <Text style={styles.packingMeta}>{Object.values(packed).filter(Boolean).length} of {plan.packingList.length} selected</Text>
            </View>
            <Ionicons name={packingExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
          </TouchableOpacity>
          {packingExpanded ? plan.packingList.map((entry, i) => (
              <TouchableOpacity
                key={`${entry}-${i}`}
                style={styles.packingRow}
                onPress={() => setPacked((p) => ({ ...p, [i]: !p[i] }))}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={packed[i] ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={packed[i] ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.packingText, packed[i] && styles.packingTextDone]}>{entry}</Text>
              </TouchableOpacity>
            )) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  sectionEyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionEyebrowText: {
    ...typography.text.eyebrow,
    color: colors.primary,
  },
  intro: {
    ...typography.text.sheetTitle,
    color: colors.foreground,
    lineHeight: typography.text.sheetTitle.fontSize * 1.4,
  },
  // Top-aligned, content-height cards: a short look keeps its button close
  // instead of stretching to the tallest card in the rail.
  carousel: { gap: spacing.lg, paddingVertical: spacing.xs, alignItems: 'flex-start' },
  outfitCard: { gap: spacing.md },
  placeholderCard: {
    alignItems: 'center', justifyContent: 'center', minHeight: 320,
    borderWidth: stroke.hairline, borderColor: colors.hairline, borderStyle: 'dashed',
  },
  placeholderText: { ...typography.text.bodySmall, color: colors.mutedForeground, marginTop: spacing.xs },
  packing: {
    paddingVertical: spacing.md, gap: spacing.xs,
  },
  packingTitle: {
    ...typography.text.sectionTitle,
    color: colors.foreground,
  },
  packingHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  packingMeta: { ...typography.text.caption, marginTop: 2, color: colors.mutedForeground, },
  packingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  packingText: { ...typography.text.bodySmall, flex: 1, color: colors.foreground },
  packingTextDone: { textDecorationLine: 'line-through', color: colors.mutedForeground },
});
