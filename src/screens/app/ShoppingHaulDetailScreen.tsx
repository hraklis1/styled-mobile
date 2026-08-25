import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShoppingEditCard } from '../../components/shopping/ShoppingEditCard';
import { ShoppingItemLightbox } from '../../components/shopping/ShoppingItemLightbox';
import { ShoppingStoreAssignmentSheet } from '../../components/shopping/ShoppingStoreAssignmentSheet';
import { useAssignShoppingStore } from '../../hooks/useAssignShoppingStore';
import { buildShoppingStoreOptions } from '../../lib/shoppingStoreFilters';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { buildShoppingEditItems, mergeShoppingSnaps, type ShoppingEditItem } from '../../lib/shoppingGallery';
import { formatShoppingPrice } from '../../lib/shoppingPresentation';
import { buildShoppingSessionGroups } from '../../lib/shoppingSessionGroups';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { AppText } from '../../components/primitives/AppText';
import { PressableScale } from '../../components/primitives/PressableScale';
import { SHORTLIST_COPY } from '../../lib/shoppingVocabulary';
import { colors, radii, spacing } from '../../theme';
import type { ShoppingHaulDetailScreenProps } from '../../navigation/types';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

export function ShoppingHaulDetailScreen({ route, navigation }: ShoppingHaulDetailScreenProps) {
  const { groupKey } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [lightboxItem, setLightboxItem] = useState<ShoppingEditItem | null>(null);
  const assignStoreSheetRef = useRef<BottomSheetModal>(null);
  const assignShoppingStore = useAssignShoppingStore();

  const { data: remoteSnaps = [] } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const currencyCode = useCurrencyCode();
  // Unfiltered on purpose — the immersive gallery shows the whole haul
  // regardless of whatever store/date filters are active back on the list.
  const allItems = useMemo(
    () => buildShoppingEditItems(mergeShoppingSnaps(remoteSnaps, pendingUploads)),
    [pendingUploads, remoteSnaps],
  );
  const groups = useMemo(() => buildShoppingSessionGroups(allItems), [allItems]);
  const storeOptions = useMemo(() => buildShoppingStoreOptions(allItems), [allItems]);
  const group = groups.find((candidate) => candidate.key === groupKey);

  const openStoreAssignment = useCallback(() => {
    setLightboxItem(null);
    requestAnimationFrame(() => assignStoreSheetRef.current?.present());
  }, []);

  const saveStoreAssignment = useCallback(async (storeName: string) => {
    if (!group) return;
    await assignShoppingStore({
      snaps: group.items.flatMap((item) => item.snaps),
      shoppingSessionId: group.shoppingSessionId,
    }, storeName);
  }, [assignShoppingStore, group]);

  // A lone find in a two-column grid sits next to an empty slot, so give it the
  // full width. Two still go side by side — one per screenful would trade the
  // gap for scrolling, which is the worse deal.
  const columns = (group?.itemCount ?? 0) === 1 ? 1 : 2;
  const cardWidth = columns === 1
    ? width - spacing.lg * 2
    : (width - spacing.lg * 2 - spacing.sm) / 2;
  const rows = useMemo(() => {
    if (!group) return [];
    return group.items.reduce<ShoppingEditItem[][]>((accumulated, item, index) => {
      if (index % columns === 0) accumulated.push([item]);
      else accumulated[accumulated.length - 1].push(item);
      return accumulated;
    }, []);
  }, [columns, group]);

  if (!group) {
    // The haul was deleted or fully re-filed out from under this screen.
    navigation.goBack();
    return null;
  }

  const spend = formatShoppingPrice(group.knownSpend, currencyCode);
  const contextLine = [group.dateLabel, group.placeLabel].filter(Boolean).join(' · ');

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={[styles.heroInner, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.heroTopRow}>
            <PressableScale
              contentStyle={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={22} color={colors.foreground} />
            </PressableScale>
          </View>
          {group.storeName ? (
            <AppText variant="editorialCompact" tone="primary" numberOfLines={1}>{group.storeName}</AppText>
          ) : (
            <PressableScale
              style={styles.heroStoreAction}
              onPress={openStoreAssignment}
              accessibilityRole="button"
              accessibilityLabel={`${SHORTLIST_COPY.needsStore}. ${SHORTLIST_COPY.addStore} for this visit.`}
            >
              <AppText variant="editorialCompact" tone="action" numberOfLines={1}>
                {SHORTLIST_COPY.needsStore}
              </AppText>
              <Ionicons name="add" size={18} color={colors.action} />
            </PressableScale>
          )}
          {contextLine ? <AppText variant="caption" tone="muted">{contextLine}</AppText> : null}
          {/* No item/photo counts and no status line here — the card that
              pushed this screen said both, and every tile below repeats them. */}
          {spend ? <AppText variant="dataLarge" tone="primary" style={styles.heroSpend}>{spend}</AppText> : null}
        </View>
      </View>

      <ScrollView
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
      </ScrollView>

      {lightboxItem ? (
        <ShoppingItemLightbox
          item={lightboxItem}
          onClose={() => setLightboxItem(null)}
          onAssignStore={openStoreAssignment}
        />
      ) : null}

      <ShoppingStoreAssignmentSheet
        sheetRef={assignStoreSheetRef}
        options={storeOptions}
        onSelect={(storeName) => void saveStoreAssignment(storeName)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  // Ivory, matching the list that pushes this screen — a white slab here read
  // as a card the moment the rows behind it stopped being cards.
  hero: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  heroInner: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 2 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, marginLeft: -spacing.sm },
  heroSpend: { marginTop: spacing.sm },
  heroStoreAction: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  grid: { gap: spacing.sm, padding: spacing.lg },
  gridRow: { flexDirection: 'row', gap: spacing.sm },
});
