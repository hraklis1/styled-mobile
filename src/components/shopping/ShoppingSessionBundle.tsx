import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ShoppingEditCard } from './ShoppingEditCard';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { formatShoppingPrice, garmentFriendlyContentFit } from '../../lib/shoppingPresentation';
import { shoppingSessionHighlights, type ShoppingSessionGroup } from '../../lib/shoppingSessionGroups';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';
import type { ShoppingSnap } from '../../types/shoppingSnap';

const TILE_WIDTH = 132;
const STRIP_LIMIT = 8;

function ShoppingSessionTile({
  item,
  width,
  selectionMode,
  isSelected,
  onPress,
  onLongPress,
}: {
  item: ShoppingEditItem;
  width: number;
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
      style={[styles.tile, { width }]}
      activeOpacity={0.9}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={`${item.storeName ?? 'Shopping'} item${price ? `, ${price}` : ', needs price'}`}
    >
      {failed ? (
        <View style={styles.tileFallback}>
          <Ionicons name="shirt-outline" size={22} color={colors.primary} />
        </View>
      ) : (
        <Image
          source={{ uri: item.primarySnap.imageUri }}
          style={StyleSheet.absoluteFill}
          contentFit={garmentFriendlyContentFit(item.primarySnap)}
          contentPosition="center"
          cachePolicy="memory-disk"
          recyclingKey={item.primarySnap.id}
          transition={200}
          onError={() => setFailed(true)}
        />
      )}
      <LinearGradient colors={['transparent', 'rgba(20, 15, 12, 0.52)']} style={styles.tileScrim} />
      {item.photoCount > 1 ? (
        <View style={styles.tilePhotoPill}>
          <Ionicons name="albums-outline" size={11} color="#FFFFFF" />
          <Text style={styles.tilePhotoText}>{item.photoCount}</Text>
        </View>
      ) : null}
      {item.isFavorite ? (
        <View style={styles.tileFavorite}>
          <Ionicons name="heart" size={12} color="#FFFFFF" />
        </View>
      ) : null}
      <Text style={[styles.tilePrice, !price && styles.tilePriceMuted]} numberOfLines={1}>
        {price ?? 'Needs price'}
      </Text>
      {selectionMode && isSelected ? <View pointerEvents="none" style={styles.tileSelectionRing} /> : null}
    </TouchableOpacity>
  );
}

/**
 * One shopping trip, bundled. Collapsed it reads as a single stacked card with
 * a scrollable strip of what was found; expanded it opens into the full grid.
 */
export function ShoppingSessionBundle({
  group,
  expanded,
  onOpenDetail,
  selectionMode,
  isSelected,
  previewOnly = false,
  style,
  onPressItem,
  onSelectCard,
  onLongPressCard,
  onAddStore,
  onReviewGrouping,
}: {
  group: ShoppingSessionGroup;
  /** Forced open (full grid) while selection mode is picking items across the whole card. */
  expanded: boolean;
  /** Tapping the card outside selection mode opens the full-screen haul gallery. */
  onOpenDetail: () => void;
  selectionMode: boolean;
  /** Whether every item in this card is part of the current selection. */
  isSelected: boolean;
  /** On another screen the bundle advertises the shortlist rather than opening in place. */
  previewOnly?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Only reached outside selection mode — opens the tapped item's detail view. */
  onPressItem: (item: ShoppingEditItem, snap: ShoppingSnap) => void;
  /** Toggles selection for every item this card contains, as one unit. */
  onSelectCard: () => void;
  /** Enters selection mode with this whole card selected. */
  onLongPressCard: () => void;
  onAddStore?: () => void;
  /** Reopens this visit's photos in the organizer — the way back to a photo
   * dump that was saved without being sorted. */
  onReviewGrouping?: () => void;
}) {
  const { width } = useWindowDimensions();
  // Every host insets the bundle by a page margin and the card pads its own
  // contents, so the row a card sits in is the same width on either screen.
  const cardWidth = (width - spacing.lg * 2 - spacing.md * 2 - spacing.sm) / 2;
  const highlights = shoppingSessionHighlights(group);
  const currencyCode = useCurrencyCode();
  const spend = formatShoppingPrice(group.knownSpend, currencyCode);
  const isOpen = expanded && !previewOnly;
  const stripItems = group.items.slice(0, STRIP_LIMIT);
  // A short trip fills the row instead of trailing off; a long one keeps the
  // narrower tile so the next find peeks in and invites the scroll.
  const tileWidth = group.itemCount >= 3 ? TILE_WIDTH : cardWidth;
  const overflowCount = group.itemCount - stripItems.length;
  // Worth offering the organizer when there is something to correct: a photo
  // the classifier never sorted, or an item holding more than one shot.
  const needsGrouping = group.unsortedCount > 0 || group.photoCount > group.itemCount;
  const isStacked = !isOpen && group.itemCount > 1;
  const rows = group.items.reduce<ShoppingEditItem[][]>((accumulated, item, index) => {
    if (index % 2 === 0) accumulated.push([item]);
    else accumulated[accumulated.length - 1].push(item);
    return accumulated;
  }, []);

  // Selection is all-or-nothing per card — every touch target below routes
  // through these so tapping/long-pressing anywhere on the card (its chrome
  // or any photo inside it) selects the whole card, never a single item.
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
    <View style={[styles.wrap, style]}>
      {isStacked ? (
        <>
          <View pointerEvents="none" style={[styles.stackLayer, styles.stackLayerFar]} />
          <View pointerEvents="none" style={[styles.stackLayer, styles.stackLayerNear]} />
        </>
      ) : null}

      <Animated.View
        layout={LinearTransition.duration(240)}
        sharedTransitionTag={`haul-card-${group.key}`}
        style={[styles.card, isSelected && styles.cardSelected]}
      >
        {selectionMode ? (
          <View pointerEvents="none" style={[styles.cardSelectionBadge, isSelected && styles.cardSelectionBadgeActive]}>
            {isSelected ? <Ionicons name="checkmark" size={16} color={colors.primaryForeground} /> : null}
          </View>
        ) : null}
        <View style={styles.header}>
          {!group.storeName ? (
            <Image
              source={{ uri: group.coverSnap.imageUri }}
              style={styles.visitCover}
              contentFit="cover"
              recyclingKey={`visit-cover:${group.coverSnap.id}`}
            />
          ) : null}
          <View style={styles.headerCopy}>
            <Text style={styles.headerDate}>{group.dateLabel}</Text>
            {group.storeName ? (
              <TouchableOpacity onPress={handleChromePress} onLongPress={handleChromeLongPress} activeOpacity={0.7}>
                <Text style={styles.headerStore} numberOfLines={1}>{group.storeName}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.addStoreButton}
                onPress={onAddStore}
                disabled={!onAddStore}
                accessibilityRole="button"
                accessibilityLabel="Add Store Location"
              >
                <Ionicons name="add" size={17} color={colors.primaryForeground} />
                <Text style={styles.addStoreText}>Add Store Location</Text>
              </TouchableOpacity>
            )}
            {!group.storeName && group.locationHint ? (
              <Text style={styles.headerPlace} numberOfLines={2}>{group.locationHint}</Text>
            ) : null}
            {group.placeLabel ? (
              <Text style={styles.headerPlace} numberOfLines={2}>{group.placeLabel}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.headerStats}
            onPress={handleChromePress}
            onLongPress={handleChromeLongPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={previewOnly ? undefined : { expanded: isOpen }}
            accessibilityLabel={`${group.storeName ?? 'Store not set'}, ${group.dateLabel}, ${group.itemCount} item${group.itemCount === 1 ? '' : 's'}`}
          >
            <Text style={styles.headerCount}>
              {group.itemCount} item{group.itemCount === 1 ? '' : 's'} · {group.photoCount} photo{group.photoCount === 1 ? '' : 's'}
            </Text>
            {spend ? <Text style={styles.headerSpend}>{spend}</Text> : null}
          </TouchableOpacity>
        </View>

        {isOpen ? (
          <Animated.View entering={FadeIn.duration(180)} style={styles.grid}>
            {rows.map((row) => (
              <View key={row.map((item) => item.id).join(':')} style={styles.gridRow}>
                {row.map((item) => (
                  <ShoppingEditCard
                    key={item.id}
                    item={item}
                    width={cardWidth}
                    isSelected={isSelected}
                    selectionMode={selectionMode}
                    showStore={false}
                    onPress={(snap) => handleItemPress(item, snap)}
                    onLongPress={handleItemLongPress}
                  />
                ))}
                {row.length === 1 ? <View style={{ width: cardWidth }} /> : null}
              </View>
            ))}
          </Animated.View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.strip, group.itemCount === 1 && styles.stripCentered]}
            style={styles.stripScroll}
          >
            {stripItems.map((item) => (
              <ShoppingSessionTile
                key={item.id}
                item={item}
                width={tileWidth}
                selectionMode={selectionMode}
                isSelected={isSelected}
                onPress={() => handleItemPress(item, item.primarySnap)}
                onLongPress={handleItemLongPress}
              />
            ))}
            {overflowCount > 0 ? (
              <TouchableOpacity style={styles.overflowTile} onPress={handleChromePress} onLongPress={handleChromeLongPress} accessibilityLabel={`Show ${overflowCount} more items`}>
                <Text style={styles.overflowCount}>+{overflowCount}</Text>
                <Text style={styles.overflowLabel}>more</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        )}

        {needsGrouping && onReviewGrouping && !selectionMode && !previewOnly ? (
          <TouchableOpacity
            style={styles.reviewGrouping}
            onPress={onReviewGrouping}
            accessibilityLabel={`Review how this visit's ${group.photoCount} photos are grouped`}
          >
            <Ionicons name="albums-outline" size={14} color={colors.primary} />
            <Text style={styles.reviewGroupingText} numberOfLines={1}>
              {group.unsortedCount > 0
                ? `Review grouping · ${group.unsortedCount} to sort`
                : 'Review grouping'}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.footer} activeOpacity={0.75} onPress={handleChromePress} onLongPress={handleChromeLongPress}>
          <Text style={styles.footerHighlights} numberOfLines={1}>{highlights.join(' · ')}</Text>
          <View style={styles.footerAction}>
            <Text style={styles.footerActionText}>
              {previewOnly
                ? 'Open shortlist'
                : isOpen ? 'Collapse' : group.itemCount === 1 ? 'View item' : `View all ${group.itemCount}`}
            </Text>
            <Ionicons
              name={previewOnly ? 'arrow-forward' : isOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.primary}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The bottom margin also leaves room for the stack layers to peek out.
  wrap: { marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.lg },
  stackLayer: {
    position: 'absolute',
    height: 40,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stackLayerNear: { left: 10, right: 10, bottom: -6, backgroundColor: colors.surfaceSubtle },
  stackLayerFar: { left: 21, right: 21, bottom: -12, backgroundColor: colors.muted },
  card: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceElevated,
    boxShadow: '0 2px 10px rgba(40, 35, 31, 0.07)',
  },
  cardSelected: { borderColor: colors.primary },
  cardSelectionBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 16,
    backgroundColor: 'rgba(24, 20, 18, 0.42)',
  },
  cardSelectionBadgeActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerCopy: { flex: 1 },
  visitCover: { width: 62, height: 76, borderRadius: radii.md, borderCurve: 'continuous', backgroundColor: colors.surfaceSubtle },
  headerDate: { fontSize: typography.text.sheetTitle.fontSize, color: colors.foreground },
  headerStore: { paddingTop: spacing.xs, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primary },
  addStoreButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  addStoreText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.bold, color: colors.primaryForeground },
  headerPlace: { paddingTop: 1, fontSize: typography.text.caption.fontSize, lineHeight: 17, color: colors.mutedForeground },
  headerStats: { alignItems: 'flex-end', gap: 2, paddingTop: 4 },
  headerCount: { ...typography.text.caption, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  headerSpend: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.bold, color: colors.foreground, fontVariant: ['tabular-nums'] },
  stripScroll: { paddingTop: spacing.xs },
  strip: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  stripCentered: { flexGrow: 1, justifyContent: 'center' },
  tile: {
    aspectRatio: 4 / 5,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  tileFallback: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  tileScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 62 },
  tilePhotoPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: 'rgba(24, 20, 18, 0.62)',
  },
  tilePhotoText: { ...typography.text.caption, fontWeight: typography.weight.bold, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  tileFavorite: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(24, 20, 18, 0.62)',
  },
  tilePrice: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  tilePriceMuted: { fontWeight: typography.weight.medium, color: 'rgba(255, 255, 255, 0.82)' },
  tileSelectionRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  overflowTile: {
    width: 72,
    aspectRatio: 4 / 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  overflowCount: { fontSize: typography.text.sheetTitle.fontSize, color: colors.foreground, fontVariant: ['tabular-nums'] },
  overflowLabel: { ...typography.text.caption, letterSpacing: typography.tracking.compact, textTransform: 'uppercase', color: colors.mutedForeground },
  grid: { gap: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  gridRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  reviewGrouping: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: colors.accent,
  },
  reviewGroupingText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  footer: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  footerHighlights: { flex: 1, fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerActionText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.primary, fontVariant: ['tabular-nums'] },
});
