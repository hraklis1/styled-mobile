import { useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShoppingEditCard } from '../../components/shopping/ShoppingEditCard';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { buildShoppingEditItems, mergeShoppingSnaps, type ShoppingEditItem } from '../../lib/shoppingGallery';
import {
  formatShoppingPrice,
  garmentFriendlyContentFit,
  itemRoleSummary,
  parseShoppingTagOcr,
  shoppingItemBadges,
  snapRoleLabel,
} from '../../lib/shoppingPresentation';
import { buildShoppingSessionGroups, shoppingSessionHighlights } from '../../lib/shoppingSessionGroups';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingHaulDetailScreenProps } from '../../navigation/types';

function ShoppingHaulLightbox({ item, onClose }: { item: ShoppingEditItem; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showFullTag, setShowFullTag] = useState(false);

  const photos = useMemo(
    () => [item.primarySnap, ...item.snaps.filter((snap) => snap.id !== item.primarySnap.id)],
    [item],
  );
  const heroHeight = Math.min(height * 0.6, 620);
  const price = formatShoppingPrice(item.extractedPrice);
  const meta = [item.sizeLabel ? `Size ${item.sizeLabel}` : null, item.colorLabel, item.materialLabel]
    .filter(Boolean)
    .join('   ·   ');
  const badges = shoppingItemBadges(item);
  const activePhoto = photos[activeIndex] ?? item.primarySnap;

  // Tag photos carry more than the one price OCR already extracted — pull
  // out anything else recognizable (other currencies, size, style number)
  // and leave the rest collapsed rather than dumping the raw scan on screen.
  const tagOcrText = useMemo(
    () => item.snaps
      .filter((snap) => snap.captureRole === 'tag')
      .map((snap) => snap.rawOcrText.trim())
      .filter(Boolean)
      .join('\n'),
    [item],
  );
  const { fields: tagFields, leftover: tagLeftover } = useMemo(
    () => parseShoppingTagOcr(tagOcrText),
    [tagOcrText],
  );
  const tagSpecs = tagFields.filter((field) => field.label !== 'USD');
  const capturedLabel = new Date(item.capturedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const syncLabel = item.syncStatus === 'pending' ? 'Saved locally' : 'Synced';

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.lightboxRoot}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <View style={[styles.lightboxHero, { height: heroHeight }]}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const page = Math.round(event.nativeEvent.contentOffset.x / width);
                setActiveIndex(Math.max(0, Math.min(page, photos.length - 1)));
              }}
            >
              {photos.map((photo) => (
                <View key={photo.id} style={{ width, height: heroHeight }}>
                  <Image
                    source={{ uri: photo.imageUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit={garmentFriendlyContentFit(photo)}
                    contentPosition="center"
                    cachePolicy="memory-disk"
                    recyclingKey={photo.id}
                    transition={200}
                  />
                </View>
              ))}
            </ScrollView>
            <LinearGradient
              colors={['rgba(20, 15, 12, 0.4)', 'transparent']}
              style={styles.lightboxTopScrim}
              pointerEvents="none"
            />
            {photos.length > 1 ? (
              <LinearGradient
                colors={['transparent', 'rgba(20, 15, 12, 0.5)']}
                style={styles.lightboxBottomScrim}
                pointerEvents="none"
              />
            ) : null}
            <View style={[styles.lightboxRolePill, { top: insets.top + spacing.sm }]}>
              <Text style={styles.lightboxRolePillText}>{snapRoleLabel(activePhoto.captureRole)}</Text>
            </View>
            {photos.length > 1 ? (
              <View style={styles.lightboxDots} accessibilityLabel={`Photo ${activeIndex + 1} of ${photos.length}`}>
                {photos.map((photo, index) => (
                  <View key={photo.id} style={[styles.lightboxDot, index === activeIndex && styles.lightboxDotActive]} />
                ))}
              </View>
            ) : null}
          </View>

          <View style={[styles.lightboxContent, { paddingBottom: insets.bottom + spacing.xxl }]}>
            <Text style={styles.lightboxEyebrow}>{itemRoleSummary(item).toUpperCase()}</Text>
            <View style={styles.lightboxTitleRow}>
              <Text style={styles.lightboxTitle}>{item.category ?? 'Shopping find'}</Text>
              {price ? <Text style={styles.lightboxPrice}>{price}</Text> : <Text style={styles.lightboxPriceMuted}>Price not found</Text>}
            </View>
            {meta ? <Text style={styles.lightboxMeta}>{meta}</Text> : null}
            <View style={styles.lightboxDivider} />
            {tagSpecs.length > 0 ? (
              <Text style={styles.lightboxSpecs}>
                {tagSpecs.map((field) => `${field.label.toUpperCase()} ${field.value}`).join('   ·   ')}
              </Text>
            ) : null}
            {item.notes ? <Text style={styles.lightboxNotes}>“{item.notes}”</Text> : null}
            <View style={styles.lightboxBadgeRow}>
              {badges.map((badge) => (
                <View key={badge.key} style={styles.lightboxBadge}>
                  <View
                    style={[
                      styles.lightboxBadgeDot,
                      badge.tone === 'attention' && styles.lightboxBadgeDotAttention,
                      badge.tone === 'success' && styles.lightboxBadgeDotSuccess,
                    ]}
                  />
                  <Text style={styles.lightboxBadgeText}>{badge.label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.lightboxCaption}>Captured {capturedLabel} · {syncLabel}</Text>
            {tagLeftover ? (
              <View>
                <TouchableOpacity
                  style={styles.lightboxDisclosureTouch}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => setShowFullTag((current) => !current)}
                  accessibilityRole="button"
                >
                  <Text style={styles.lightboxDisclosure}>{showFullTag ? 'Hide tag text' : 'Read tag text'}</Text>
                </TouchableOpacity>
                {showFullTag ? <Text style={styles.lightboxTagText}>{tagLeftover}</Text> : null}
              </View>
            ) : null}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.lightboxClose, { top: insets.top + spacing.sm }]}
          onPress={onClose}
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export function ShoppingHaulDetailScreen({ route, navigation }: ShoppingHaulDetailScreenProps) {
  const { groupKey } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [lightboxItem, setLightboxItem] = useState<ShoppingEditItem | null>(null);

  const { data: remoteSnaps = [] } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  // Unfiltered on purpose — the immersive gallery shows the whole haul
  // regardless of whatever store/date filters are active back on the list.
  const allItems = useMemo(
    () => buildShoppingEditItems(mergeShoppingSnaps(remoteSnaps, pendingUploads)),
    [pendingUploads, remoteSnaps],
  );
  const groups = useMemo(() => buildShoppingSessionGroups(allItems), [allItems]);
  const group = groups.find((candidate) => candidate.key === groupKey);

  const cardWidth = (width - spacing.lg * 2 - spacing.sm) / 2;
  const rows = useMemo(() => {
    if (!group) return [];
    return group.items.reduce<ShoppingEditItem[][]>((accumulated, item, index) => {
      if (index % 2 === 0) accumulated.push([item]);
      else accumulated[accumulated.length - 1].push(item);
      return accumulated;
    }, []);
  }, [group]);

  if (!group) {
    // The haul was deleted or fully re-filed out from under this screen.
    navigation.goBack();
    return null;
  }

  const spend = formatShoppingPrice(group.knownSpend);
  const highlights = shoppingSessionHighlights(group);

  return (
    <View style={styles.screen}>
      <Animated.View sharedTransitionTag={`haul-card-${group.key}`} style={styles.hero}>
        <View style={[styles.heroInner, { paddingTop: insets.top + 56 }]}>
          <Text style={styles.heroDate}>{group.dateLabel}</Text>
          {group.storeName ? <Text style={styles.heroStore}>{group.storeName}</Text> : null}
          {group.placeLabel ? <Text style={styles.heroPlace}>{group.placeLabel}</Text> : null}
          <View style={styles.heroStatsRow}>
            <Text style={styles.heroStats}>
              {group.itemCount} item{group.itemCount === 1 ? '' : 's'} · {group.photoCount} photo{group.photoCount === 1 ? '' : 's'}
            </Text>
            {spend ? <Text style={styles.heroSpend}>{spend}</Text> : null}
          </View>
          {highlights.length > 0 ? (
            <Text style={styles.heroHighlights} numberOfLines={2}>{highlights.join(' · ')}</Text>
          ) : null}
        </View>
      </Animated.View>

      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + spacing.sm }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <Animated.ScrollView
        entering={FadeIn.duration(220).delay(80)}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row) => (
          <View key={row.map((item) => item.id).join(':')} style={styles.gridRow}>
            {row.map((item) => (
              <ShoppingEditCard
                key={item.id}
                item={item}
                width={cardWidth}
                isSelected={false}
                selectionMode={false}
                showStore={false}
                onPress={() => setLightboxItem(item)}
                onLongPress={() => {}}
              />
            ))}
            {row.length === 1 ? <View style={{ width: cardWidth }} /> : null}
          </View>
        ))}
      </Animated.ScrollView>

      {lightboxItem ? <ShoppingHaulLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  heroInner: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 2 },
  heroDate: { fontFamily: typography.family.display, fontSize: typography.size.xxl, color: colors.foreground },
  heroStore: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.primary },
  heroPlace: { fontSize: typography.size.sm, color: colors.mutedForeground },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  heroStats: { fontSize: typography.size.sm, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  heroSpend: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.foreground, fontVariant: ['tabular-nums'] },
  heroHighlights: { marginTop: spacing.xs, fontSize: typography.size.xs, color: colors.mutedForeground },
  backButton: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(251, 250, 247, 0.88)',
    boxShadow: '0 2px 8px rgba(40, 35, 31, 0.12)',
  },
  grid: { gap: spacing.sm, padding: spacing.lg },
  gridRow: { flexDirection: 'row', gap: spacing.sm },
  lightboxRoot: { flex: 1, backgroundColor: colors.background },
  lightboxHero: { width: '100%', backgroundColor: colors.surfaceSubtle },
  lightboxTopScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 100 },
  lightboxBottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 96 },
  lightboxRolePill: {
    position: 'absolute',
    left: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: 'rgba(250, 248, 245, 0.92)',
  },
  lightboxRolePillText: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 0.8, color: colors.foreground, textTransform: 'uppercase' },
  lightboxDots: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  lightboxDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  lightboxDotActive: { width: 18, backgroundColor: '#FFFFFF' },
  lightboxContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.sm },
  lightboxEyebrow: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1.5, color: colors.primary },
  lightboxTitleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  lightboxTitle: { flex: 1, fontFamily: typography.family.display, fontSize: typography.size.xxl, color: colors.foreground },
  lightboxPrice: { fontFamily: typography.family.display, fontSize: typography.size.xl, color: colors.foreground, fontVariant: ['tabular-nums'] },
  lightboxPriceMuted: { fontFamily: typography.family.display, fontSize: typography.size.lg, color: colors.mutedForeground },
  lightboxMeta: { fontSize: typography.size.sm, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.mutedForeground },
  lightboxDivider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.sm, backgroundColor: colors.hairline },
  lightboxSpecs: { fontSize: typography.size.xs, letterSpacing: 0.3, color: colors.secondaryForeground, fontVariant: ['tabular-nums'] },
  lightboxNotes: { fontSize: typography.size.md, lineHeight: 24, fontStyle: 'italic', color: colors.secondaryForeground },
  lightboxBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  lightboxBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lightboxBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mutedForeground },
  lightboxBadgeDotAttention: { backgroundColor: colors.primary },
  lightboxBadgeDotSuccess: { backgroundColor: colors.success },
  lightboxBadgeText: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  lightboxCaption: { marginTop: spacing.md, fontSize: 11, color: colors.mutedForeground },
  lightboxDisclosureTouch: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingVertical: spacing.xs },
  lightboxDisclosure: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primary },
  lightboxTagText: { marginTop: spacing.sm, fontSize: typography.size.sm, lineHeight: 21, color: colors.secondaryForeground },
  lightboxClose: {
    position: 'absolute',
    right: spacing.lg,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(24, 20, 18, 0.5)',
  },
});
