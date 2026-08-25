import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { Easing, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../primitives/PressableScale';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { getSwatchColor } from '../../lib/colorUtils';
import { formatShoppingPrice } from '../../lib/shoppingPresentation';
import {
  shoppingSessionAttention,
  type ShoppingSessionAttentionKey,
  type ShoppingSessionGroup,
} from '../../lib/shoppingSessionGroups';
import { SHORTLIST_COPY } from '../../lib/shoppingVocabulary';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';
import type { ShoppingSnap } from '../../types/shoppingSnap';

const RAIL_WIDTH = 26;
const TILE_WIDTH = 96;
const STRIP_LIMIT = 8;

/**
 * The visit's colour, as a rule down the left of the row. Its length is a
 * function of the row's height, so a trip holding a dozen pieces draws a
 * visibly longer line than one holding a single piece.
 */
function ColorSpine({ label }: { label: string | null }) {
  // getSwatchColor('') resolves to black — every key contains the empty string —
  // so an unclassified visit must never reach it.
  const swatch = label?.trim() ? getSwatchColor(label) : null;

  return (
    <View style={styles.spine}>
      {swatch ? <View style={[styles.spineHalf, { backgroundColor: swatch.primary }]} /> : null}
      {swatch?.secondary ? <View style={[styles.spineHalf, { backgroundColor: swatch.secondary }]} /> : null}
    </View>
  );
}

function ShoppingSessionTile({
  item,
  selectionMode,
  isSelected,
  onPress,
  onLongPress,
}: {
  item: ShoppingEditItem;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const currencyCode = useCurrencyCode();
  const price = formatShoppingPrice(item.extractedPrice, currencyCode);

  return (
    <TouchableOpacity
      style={styles.tileColumn}
      activeOpacity={0.85}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={`${item.storeName ?? 'Shopping'} piece${price ? `, ${price}` : `, ${SHORTLIST_COPY.needsPrice}`}`}
    >
      <View style={styles.tile}>
        {failed ? (
          <View style={styles.tileFallback}>
            <Ionicons name="shirt-outline" size={20} color={colors.mutedForeground} />
          </View>
        ) : (
          <Image
            source={{ uri: item.primarySnap.imageUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
            cachePolicy="memory-disk"
            recyclingKey={item.primarySnap.id}
            transition={200}
            onError={() => setFailed(true)}
          />
        )}
        {selectionMode && isSelected ? <View pointerEvents="none" style={styles.tileSelectionRing} /> : null}
      </View>
      {/* Nothing is written on the photograph. The price sits beneath it, where
          it shares a baseline with every other tile and can be read down the
          strip instead of hunted for on each image. */}
      <View style={styles.tileCaption}>
        {item.isFavorite ? <Ionicons name="heart" size={11} color={colors.primary} /> : null}
        <Text style={styles.tileCaptionText} numberOfLines={1}>{price ?? '—'}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * One shopping trip, as a row: the visit's colour, its store, when and where,
 * what was found, and the single next thing it needs.
 */
export function ShoppingSessionBundle({
  group,
  isLast = false,
  onOpenDetail,
  selectionMode,
  isSelected,
  onPressItem,
  onSelectCard,
  onLongPressCard,
  onAddStore,
  onReviewGrouping,
}: {
  group: ShoppingSessionGroup;
  /** Suppresses the divider so the list ends on white space, not a rule. */
  isLast?: boolean;
  /** Tapping the row outside selection mode opens the full-screen haul gallery. */
  onOpenDetail: () => void;
  selectionMode: boolean;
  /** Whether every item in this visit is part of the current selection. */
  isSelected: boolean;
  /** Only reached outside selection mode — opens the tapped item's detail view. */
  onPressItem: (item: ShoppingEditItem, snap: ShoppingSnap) => void;
  /** Toggles selection for every item this visit contains, as one unit. */
  onSelectCard: () => void;
  /** Enters selection mode with this whole visit selected. */
  onLongPressCard: () => void;
  onAddStore?: () => void;
  /** Reopens this visit's photos in the organizer — the way back to a photo
   * dump that was saved without being sorted. */
  onReviewGrouping?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const currencyCode = useCurrencyCode();
  const spend = formatShoppingPrice(group.knownSpend, currencyCode);
  const stripItems = group.items.slice(0, STRIP_LIMIT);
  // Worth offering the organizer when there is something to correct: a photo
  // the classifier never sorted, or an item holding more than one shot.
  const needsGrouping = group.unsortedCount > 0 || group.photoCount > group.itemCount;

  // The row offers at most one action of its own, and whichever it offers is
  // dropped from the status line so the same nag never appears twice.
  const canAddStore = !group.storeName && Boolean(onAddStore) && !selectionMode;
  const canSortPhotos = needsGrouping && Boolean(onReviewGrouping) && !selectionMode;
  const spokenFor: ShoppingSessionAttentionKey[] = [
    ...(canAddStore ? (['needs-store'] as const) : []),
    ...(canSortPhotos ? (['unsorted'] as const) : []),
  ];
  const status = shoppingSessionAttention(group)
    .filter((entry) => !spokenFor.includes(entry.key))
    .slice(0, 2)
    .map((entry) => entry.label);

  const metaSegments = [
    group.dateLabel,
    group.placeLabel ?? group.locationHint,
    `${group.itemCount} ${group.itemCount === 1 ? SHORTLIST_COPY.piece : SHORTLIST_COPY.pieces}`,
  ].filter((segment): segment is string => Boolean(segment));

  // Selection is all-or-nothing per visit — every touch target below routes
  // through these so tapping/long-pressing anywhere in the row (its text or any
  // photo inside it) selects the whole visit, never a single item.
  const handleChromePress = () => {
    if (selectionMode) {
      onSelectCard();
      return;
    }
    void Haptics.selectionAsync();
    onOpenDetail();
  };

  const handleChromeLongPress = () => {
    if (selectionMode) {
      onSelectCard();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLongPressCard();
  };

  const handleItemPress = (item: ShoppingEditItem, snap: ShoppingSnap) => {
    if (selectionMode) {
      onSelectCard();
      return;
    }
    onPressItem(item, snap);
  };

  const handleItemLongPress = () => {
    if (selectionMode) {
      onSelectCard();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLongPressCard();
  };

  return (
    <Animated.View
      // Filtering re-lays out every surviving row at once. A spring made them
      // overshoot and settle at different rates; a short ease keeps the list
      // reading as one object rather than a dozen independently bouncing ones.
      layout={reduceMotion ? undefined : LinearTransition.duration(180).easing(Easing.out(Easing.quad))}
      style={[styles.row, isLast && styles.rowLast, isSelected && styles.rowSelected]}
    >
      {/* Rail and content are siblings of the *whole* row, not just its
          heading, so the spine's flex fills the row's real height — a visit
          holding a dozen pieces draws a visibly longer line than one holding
          a single piece. */}
      <View style={styles.body}>
        <View style={styles.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {selectionMode ? (
            <View style={[styles.selectionMark, isSelected && styles.selectionMarkActive]}>
              {isSelected ? <Ionicons name="checkmark" size={13} color={colors.primaryForeground} /> : null}
            </View>
          ) : null}
          <ColorSpine label={group.dominantColorLabel} />
        </View>

        <View style={styles.content}>
          {/* The strip is a horizontal scroller, so it stays outside this
              touchable — a parent press responder wrapping it steals the pan. */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={canAddStore ? onAddStore : handleChromePress}
            onLongPress={handleChromeLongPress}
            accessibilityRole="button"
            accessibilityLabel={canAddStore
              ? `${SHORTLIST_COPY.needsStore}. ${SHORTLIST_COPY.addStore} for this visit.`
              : `${group.storeName}, ${metaSegments.join(', ')}`}
          >
            {/* Where the store name would be, the row asks for one — and
                tapping it is what supplies it. Anywhere else on the row still
                opens the visit. */}
            <View style={styles.titleRow}>
              <Text style={[styles.title, canAddStore && styles.titleAction]} numberOfLines={1}>
                {group.storeName ?? SHORTLIST_COPY.needsStore}
              </Text>
              {canAddStore ? <Ionicons name="add" size={17} color={colors.action} /> : null}
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText} numberOfLines={1}>{metaSegments.join('  ·  ')}</Text>
              {spend ? <Text style={styles.metaPrice} numberOfLines={1}>{spend}</Text> : null}
            </View>
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
            style={styles.stripScroll}
          >
            {stripItems.map((item) => (
              <ShoppingSessionTile
                key={item.id}
                item={item}
                selectionMode={selectionMode}
                isSelected={isSelected}
                onPress={() => handleItemPress(item, item.primarySnap)}
                onLongPress={handleItemLongPress}
              />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            {canSortPhotos ? (
              <PressableScale
                motion="crisp"
                style={styles.footerActionSlot}
                onPress={onReviewGrouping}
                accessibilityRole="button"
                accessibilityLabel={`${SHORTLIST_COPY.sortPhotos} for this visit`}
              >
                <Text style={styles.footerAction}>
                  {group.unsortedCount > 0
                    ? `${SHORTLIST_COPY.sortPhotos} · ${group.unsortedCount}`
                    : SHORTLIST_COPY.sortPhotos}
                </Text>
              </PressableScale>
            ) : (
              <View style={styles.footerActionSlot}>
                <Text style={styles.footerStatus} numberOfLines={1}>{status.join('  ·  ')}</Text>
              </View>
            )}
            <PressableScale
              motion="crisp"
              style={styles.footerOpen}
              contentStyle={styles.footerOpenContent}
              onPress={handleChromePress}
              accessibilityRole="button"
            >
              <Text style={styles.footerOpenText}>
                {group.itemCount === 1 ? 'View piece' : `View all ${group.itemCount} pieces`}
              </Text>
              {/* Forward, not down — this pushes a screen, it does not disclose. */}
              <Ionicons name="chevron-forward" size={14} color={colors.inkSubtle} />
            </PressableScale>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // No card: a visit is a band of the page, separated by a hairline. Never add
  // overflow:'hidden' here — it would clip the strip's bleed to the edge.
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowLast: { borderBottomWidth: 0 },
  rowSelected: { backgroundColor: colors.surfaceSelected },

  body: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  rail: { width: RAIL_WIDTH, alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  spine: {
    width: 3,
    flex: 1,
    minHeight: 20,
    overflow: 'hidden',
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  spineHalf: { flex: 1 },
  // Sits where the rail's number would, so it lands at a constant x down the
  // whole list. The spine keeps carrying colour, never selection.
  selectionMark: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  selectionMarkActive: { borderColor: colors.primary, backgroundColor: colors.primary },

  content: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  titleAction: { color: colors.action },
  metaRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  metaText: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  // Fixed column so prices line up down the page rather than floating after
  // whatever length the date and place happened to be.
  metaPrice: {
    minWidth: 78,
    textAlign: 'right',
    fontSize: 14,
    lineHeight: 18,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },

  // Indented to the text column, then bleeding past the row's right padding so
  // the next find is clipped by the screen edge and invites the scroll.
  stripScroll: { marginRight: -spacing.lg, marginTop: spacing.md },
  strip: { gap: spacing.sm, paddingRight: spacing.lg, alignItems: 'flex-start' },
  tileColumn: { width: TILE_WIDTH },
  tile: {
    width: TILE_WIDTH,
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    borderRadius: radii.photo,
    backgroundColor: colors.surfaceSubtle,
  },
  tileFallback: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  tileCaption: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: spacing.xs },
  tileCaptionText: { flex: 1, fontSize: 12, lineHeight: 16, color: colors.inkSubtle, fontVariant: ['tabular-nums'] },
  tileSelectionRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: radii.photo,
  },

  footer: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  footerActionSlot: { flex: 1, minHeight: 36, justifyContent: 'center' },
  // Terracotta marks the outstanding task — the one thing this visit still
  // needs. Ambient navigation out of the row stays quiet below, so the row
  // only ever raises its voice for work.
  footerAction: { fontSize: 13, lineHeight: 18, fontWeight: typography.weight.medium, color: colors.action },
  footerStatus: { fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  footerOpen: { minHeight: 36 },
  footerOpenContent: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: spacing.sm,
    borderRadius: radii.full,
  },
  footerOpenText: { fontSize: 12, lineHeight: 18, color: colors.inkSubtle, fontVariant: ['tabular-nums'] },
});
