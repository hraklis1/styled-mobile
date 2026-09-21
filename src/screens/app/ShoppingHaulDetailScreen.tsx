import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShoppingEditCard } from '../../components/shopping/ShoppingEditCard';
import { ShoppingItemLightbox } from '../../components/shopping/ShoppingItemLightbox';
import { ShoppingStoreAssignmentSheet } from '../../components/shopping/ShoppingStoreAssignmentSheet';
import { useAssignShoppingStore } from '../../hooks/useAssignShoppingStore';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { buildShoppingStoreOptions } from '../../lib/shoppingStoreFilters';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { buildShoppingEditItems, mergeShoppingSnaps, type ShoppingEditItem } from '../../lib/shoppingGallery';
import { buildShoppingSessionGroups } from '../../lib/shoppingSessionGroups';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { AppText } from '../../components/primitives/AppText';
import { ActionButton } from '../../components/primitives/Editorial';
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
  // Unfiltered on purpose — the immersive gallery shows the whole haul
  // regardless of whatever store/date filters are active back on the list.
  const homeCurrency = useCurrencyCode();
  const allItems = useMemo(
    () => buildShoppingEditItems(mergeShoppingSnaps(remoteSnaps, pendingUploads), { homeCurrency }),
    [homeCurrency, pendingUploads, remoteSnaps],
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
              <Ionicons name="chevron-back" size={23} color={colors.foreground} />
            </PressableScale>
          </View>
          <AppText variant="editorialCompact" tone={group.storeName ? 'primary' : 'action'} numberOfLines={1}>
            {group.storeName ?? SHORTLIST_COPY.needsStore}
          </AppText>
          {/* One line: when, where, how many. The row that pushed this screen
              said the same, so nothing here needs a second line. */}
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {[contextLine, `${group.itemCount} ${group.itemCount === 1 ? 'piece' : 'pieces'}`].filter(Boolean).join('  ·  ')}
          </AppText>
          {group.storeName ? null : (
            <View style={styles.heroStoreAction}>
              <ActionButton icon="add" label={SHORTLIST_COPY.addStore} variant="secondary" onPress={openStoreAssignment} />
            </View>
          )}
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
  heroStoreAction: { alignSelf: 'flex-start', marginTop: spacing.sm },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  grid: { gap: spacing.sm, padding: spacing.lg },
  gridRow: { flexDirection: 'row', gap: spacing.sm },
});
