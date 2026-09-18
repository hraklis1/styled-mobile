import { touchShoppingImage } from '../../lib/shoppingImageCache';
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
import { formatShoppingPrice } from '../../lib/shoppingPresentation';
import { type ShoppingSessionGroup } from '../../lib/shoppingSessionGroups';
import { SHORTLIST_COPY } from '../../lib/shoppingVocabulary';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';
import type { ShoppingSnap } from '../../types/shoppingSnap';

const TILE_WIDTH = 96;
const STRIP_LIMIT = 8;

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
  const price = formatShoppingPrice(item.extractedPrice, item.currencyCode ?? null);

  return (
    <TouchableOpacity
      style={styles.tileColumn}
      activeOpacity={0.85}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={`${item.storeName ?? 'Shopping'} piece${price ? `, ${price}` : ''}`}
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
            contentFit="contain"
            contentPosition="center"
            cachePolicy="memory-disk" onLoad={() => touchShoppingImage(item.primarySnap.imageUri)}
            recyclingKey={item.primarySnap.id}
            transition={200}
            onError={() => setFailed(true)}
          />
        )}
        {selectionMode && isSelected ? <View pointerEvents="none" style={styles.tileSelectionRing} /> : null}
      </View>
      {/* Nothing is written on the photograph. The price sits beneath it, where
          it shares a baseline with every other tile and can be read down the
          strip instead of hunted for on each image. The caption keeps its
          height when there is nothing to say, so rails line up across visits
          instead of an unpriced strip sitting higher than a priced one. */}
      <View style={styles.tileCaption}>
        {item.isFavorite ? <Ionicons name="heart" size={11} color={colors.primary} /> : null}
        {price ? <Text style={styles.tileCaptionText} numberOfLines={1}>{price}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * One shopping trip, as a band of the page: its store, when and where, what
 * was found, and the single next thing it needs. The heading is the way in;
 * everything else the visit can do lives behind its overflow menu.
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
  onOpenMenu,
}: {
  group: ShoppingSessionGroup;
  /** Suppresses the divider so the list ends on white space, not a rule. */
  isLast?: boolean;
  /** Tapping the heading outside selection mode opens the full-screen haul gallery. */
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
  /** Opens the visit's overflow menu. Absent when the visit has nothing to offer. */
  onOpenMenu?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const stripItems = group.items.slice(0, STRIP_LIMIT);
  const overflowCount = group.items.length - stripItems.length;
  // Worth offering the organizer when there is something to correct: a photo
  // the classifier never sorted, or an item holding more than one shot.
  const needsGrouping = group.unsortedCount > 0;

  const canAddStore = !group.storeName && Boolean(onAddStore) && !selectionMode;
  const canSortPhotos = needsGrouping && Boolean(onReviewGrouping) && !selectionMode;
  const showMenu = Boolean(onOpenMenu) && !selectionMode;

  // A store-less visit has no name to tell it apart from the next one, so its
  // capture time does that job instead.
  const when = group.storeName ? group.dateLabel : `${group.dateLabel}, ${group.timeLabel}`;
  const metaSegments = [
    when,
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
      <View style={styles.headerRow}>
        {/* The strip is a horizontal scroller, so it stays outside this
            touchable — a parent press responder wrapping it steals the pan. */}
        <TouchableOpacity
          style={styles.heading}
          activeOpacity={0.7}
          onPress={canAddStore ? onAddStore : handleChromePress}
          onLongPress={handleChromeLongPress}
          accessibilityRole="button"
          accessibilityLabel={selectionMode ? `Select entire visit, ${group.itemCount} pieces` : canAddStore
            ? `${SHORTLIST_COPY.needsStore}. ${SHORTLIST_COPY.addStore} for this visit.`
            : `${group.storeName}, ${metaSegments.join(', ')}`}
        >
          {/* Where the store name would be, the row asks for one — and
              tapping it is what supplies it. Anywhere else on the row still
              opens the visit. */}
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {group.storeName ?? SHORTLIST_COPY.needsStore}
            </Text>
            {canAddStore
              ? null
              : <Ionicons name="chevron-forward" size={15} color={colors.inkSubtle} style={styles.titleChevron} />}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{metaSegments.join('  ·  ')}</Text>
            {/* Terracotta marks the outstanding task — the one thing this visit
                still needs. Navigation stays quiet, so the row only ever
                raises its voice for work. */}
            {canAddStore ? (
              <PressableScale
                motion="crisp"
                onPress={onAddStore}
                accessibilityRole="button"
                accessibilityLabel={SHORTLIST_COPY.addStore}
                hitSlop={8}
              >
                <Text style={styles.metaAction}>{SHORTLIST_COPY.addStore}</Text>
              </PressableScale>
            ) : null}
            {canSortPhotos ? (
              <PressableScale
                motion="crisp"
                onPress={onReviewGrouping}
                accessibilityRole="button"
                accessibilityLabel={`Sort ${group.unsortedCount} photos`}
                hitSlop={8}
              >
                <Text style={styles.metaAction}>Sort photos · {group.unsortedCount}</Text>
              </PressableScale>
            ) : null}
          </View>
        </TouchableOpacity>

        {selectionMode ? (
          <TouchableOpacity
            onPress={onSelectCard}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel="Select visit"
            style={styles.trailingSlot}
          >
            <View style={[styles.selectionMark, isSelected && styles.selectionMarkActive]}>
              {isSelected ? <Ionicons name="checkmark" size={13} color={colors.primaryForeground} /> : null}
            </View>
          </TouchableOpacity>
        ) : showMenu ? (
          <TouchableOpacity
            onPress={onOpenMenu}
            accessibilityRole="button"
            accessibilityLabel="Visit options"
            style={styles.trailingSlot}
            hitSlop={6}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

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
        {/* What the strip cannot hold is counted at its end, and that count
            is the way to the rest. */}
        {overflowCount > 0 ? (
          <TouchableOpacity
            style={styles.tileColumn}
            activeOpacity={0.85}
            onPress={handleChromePress}
            onLongPress={handleChromeLongPress}
            accessibilityRole="button"
            accessibilityLabel={`View all ${group.itemCount} pieces`}
          >
            <View style={[styles.tile, styles.overflowTile]}>
              <Text style={styles.overflowText}>+{overflowCount}</Text>
            </View>
            <View style={styles.tileCaption} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // No card and no indent: a visit is a full-width band of the page, set
  // apart by breathing room above and a hairline below. Never add
  // overflow:'hidden' here — it would clip the strip's bleed to the edge.
  row: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowLast: { borderBottomWidth: 0 },
  rowSelected: { backgroundColor: colors.surfaceSelected },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  heading: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  title: { ...typography.text.editorialCompact, color: colors.foreground, flexShrink: 1 },
  titleChevron: { marginTop: 2 },
  metaRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  metaText: { flexShrink: 1, minWidth: 0, ...typography.text.caption, lineHeight: 18, color: colors.mutedForeground },
  metaAction: { ...typography.text.label, lineHeight: 18, color: colors.action },

  // Sits on the title's baseline row so the mark or menu reads as part of the
  // heading rather than floating in the band's corner.
  trailingSlot: {
    width: 32,
    height: 32,
    marginTop: -3,
    marginRight: -spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  // Bleeds past the row's right padding so the next find is clipped by the
  // screen edge and invites the scroll.
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
  tileCaption: { height: 20, flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: spacing.xs },
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
  overflowTile: { alignItems: 'center', justifyContent: 'center' },
  overflowText: { ...typography.text.editorialCompact, color: colors.inkSubtle, fontVariant: ['tabular-nums'] },
});
