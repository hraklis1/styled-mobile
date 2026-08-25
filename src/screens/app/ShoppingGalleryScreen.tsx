import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions, usePreventRemove } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { ShoppingSessionBundle } from '../../components/shopping/ShoppingSessionBundle';
import { ShortlistFilterBar, type ShortlistFilterOption } from '../../components/shopping/ShortlistFilterBar';
import { ShoppingItemLightbox } from '../../components/shopping/ShoppingItemLightbox';
import { ShoppingStoreFilterSheet } from '../../components/shopping/ShoppingStoreFilterSheet';
import { ShoppingStoreAssignmentSheet } from '../../components/shopping/ShoppingStoreAssignmentSheet';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { AppText } from '../../components/primitives/AppText';
import { ActionButton, FilterControl, IconButton } from '../../components/primitives/Editorial';
import { OptionChips } from '../../components/primitives/EditAtoms';
import { useAuth } from '../../contexts/AuthContext';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { useAssignShoppingStore, type ShoppingStoreAssignmentTarget } from '../../hooks/useAssignShoppingStore';
import {
  buildShoppingEditItems,
  filterShoppingEditItems,
  mergeShoppingSnaps,
  summarizeShoppingEditItems,
  type ShoppingDateFilter,
  type ShoppingEditItem,
  type ShoppingReviewFilter,
  type ShoppingSyncFilter,
} from '../../lib/shoppingGallery';
import { buildShoppingSessionGroups, type ShoppingSessionGroup } from '../../lib/shoppingSessionGroups';
import {
  buildShoppingStoreOptions,
  countItemsWithoutStore,
  quickShoppingStoreOptions,
  shoppingStoreFilterLabel,
  STORE_FILTER_ALL,
} from '../../lib/shoppingStoreFilters';
import {
  buildShoppingReviewReasonOptions,
  itemHasShoppingReviewReason,
  SHOPPING_CATALOG_STATUS_OPTIONS,
  type ShoppingReviewReasonKey,
} from '../../lib/shoppingPresentation';
import { SHORTLIST_COPY } from '../../lib/shoppingVocabulary';
import { deleteShoppingSnaps as deleteShoppingSnapsService } from '../../lib/deleteShoppingSnaps';
import type { ShoppingGalleryScreenProps } from '../../navigation/types';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingFindCatalogStatus, ShoppingSnap } from '../../types/shoppingSnap';

type ShoppingCatalogFilter = 'all' | 'active' | 'favorite' | ShoppingFindCatalogStatus;

const DATE_OPTIONS: { value: ShoppingDateFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Past 7 days' },
  { value: '30d', label: 'Past 30 days' },
];

/** One axis for "what still needs doing", replacing three overlapping ones. */
type ShortlistAttentionFilter = 'all' | ShoppingReviewReasonKey | 'on-this-phone';

export function ShoppingGalleryScreen({ navigation, route }: ShoppingGalleryScreenProps) {
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const storeSheetRef = useRef<BottomSheetModal>(null);
  const assignStoreSheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: remoteSnaps = [], isLoading, isRefetching, isError, refetch } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const [storeFilter, setStoreFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<ShoppingDateFilter>('all');
  const [attentionFilter, setAttentionFilter] = useState<ShortlistAttentionFilter>('all');
  const [catalogFilter, setCatalogFilter] = useState<ShoppingCatalogFilter>('all');
  const [lightboxItem, setLightboxItem] = useState<ShoppingEditItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [isDeletingSelection, setIsDeletingSelection] = useState(false);
  const [returningToTab, setReturningToTab] = useState(false);
  const [storeAssignmentTarget, setStoreAssignmentTarget] = useState<ShoppingStoreAssignmentTarget | null>(null);
  const assignShoppingStore = useAssignShoppingStore();
  const [heroHeight, setHeroHeight] = useState(0);
  const [showCompactHeader, setShowCompactHeader] = useState(false);
  const reduceMotion = useReducedMotion();

  const allSnaps = useMemo(
    () => mergeShoppingSnaps(remoteSnaps, pendingUploads),
    [pendingUploads, remoteSnaps],
  );
  const allItems = useMemo(() => buildShoppingEditItems(allSnaps), [allSnaps]);

  // The one attention axis fans back out into the three arguments
  // filterShoppingEditItems already takes, so that library stays as it is.
  const syncFilter: ShoppingSyncFilter = attentionFilter === 'on-this-phone' ? 'pending' : 'all';
  const reviewFilter: ShoppingReviewFilter =
    attentionFilter !== 'all' && attentionFilter !== 'on-this-phone' ? 'needs-review' : 'all';
  const reviewReasonFilter: ShoppingReviewReasonKey | 'all' =
    attentionFilter === 'all' || attentionFilter === 'on-this-phone' ? 'all' : attentionFilter;

  // Opened from another tab (Home): backing or swiping out should land there,
  // not on the Shop tab this screen happens to live in.
  const returnTo = route.params?.returnTo;
  usePreventRemove(returnTo != null && !returningToTab, () => {
    setReturningToTab(true);
  });

  // Reached from another tab, this screen is the only route on the Shop stack,
  // so popping it would leave that tab with nothing to render. Put ShopMain in
  // its place before handing focus back.
  useEffect(() => {
    if (!returningToTab || !returnTo) return;

    // Switch tabs first to return focus to the source tab immediately.
    navigation.dispatch(CommonActions.navigate({ name: returnTo }));

    // Reset the stack of the Shop tab to ShopMain silently in the background
    // after the tab switch has initiated, avoiding animation transition races.
    const timeout = setTimeout(() => {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'ShopMain' }],
        })
      );
    }, 100);
    return () => clearTimeout(timeout);
  }, [navigation, returningToTab, returnTo]);

  const goBack = useCallback(() => {
    if (returnTo) {
      setReturningToTab(true);
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('ShopMain');
  }, [navigation, returnTo]);

  useEffect(() => {
    const requestedFilter = route.params?.catalogFilter;
    if (requestedFilter) setCatalogFilter(requestedFilter);
    const focusGroupId = route.params?.focusGroupId;
    if (focusGroupId) {
      const focused = allItems.find((item) => item.captureGroupId === focusGroupId);
      if (focused) setLightboxItem(focused);
    }
    if (focusGroupId || requestedFilter) {
      navigation.setParams({ focusGroupId: undefined, catalogFilter: undefined });
    }
  }, [allItems, navigation, route.params?.catalogFilter, route.params?.focusGroupId]);
  const storeOptions = useMemo(() => buildShoppingStoreOptions(allItems), [allItems]);
  const unassignedStoreCount = useMemo(() => countItemsWithoutStore(allItems), [allItems]);
  const quickStoreOptions = useMemo(
    () => quickShoppingStoreOptions(storeOptions, storeFilter),
    [storeFilter, storeOptions],
  );
  const storeFilterLabel = useMemo(
    () => shoppingStoreFilterLabel(storeOptions, storeFilter),
    [storeFilter, storeOptions],
  );
  const activeQuickStoreValue = useMemo(
    () => quickStoreOptions.find(
      (store) => store.value === storeFilter
        || store.locations.some((location) => location.value === storeFilter),
    )?.value ?? null,
    [quickStoreOptions, storeFilter],
  );
  const summary = useMemo(() => summarizeShoppingEditItems(allItems), [allItems]);
  const reviewReasonOptions = useMemo(() => buildShoppingReviewReasonOptions(allItems), [allItems]);
  // Counts come from every item, never the filtered list — a count badge that
  // re-counted the filtered set would zero itself the moment you tapped it.
  const attentionOptions = useMemo<ShortlistFilterOption<ShortlistAttentionFilter>[]>(() => {
    const options: ShortlistFilterOption<ShortlistAttentionFilter>[] = [{ value: 'all', label: 'Everything' }];
    for (const reason of reviewReasonOptions) {
      options.push({ value: reason.key, label: reason.label, count: reason.count });
    }
    if (summary.pendingItemCount > 0) {
      options.push({ value: 'on-this-phone', label: SHORTLIST_COPY.onThisPhone, count: summary.pendingItemCount });
    }
    return options;
  }, [reviewReasonOptions, summary.pendingItemCount]);
  const baseFilteredItems = useMemo(
    () => filterShoppingEditItems(allItems, storeFilter, dateFilter, syncFilter, reviewFilter),
    [allItems, dateFilter, reviewFilter, storeFilter, syncFilter],
  );
  const filteredItems = useMemo(
    () => {
      const reviewFiltered = reviewReasonFilter === 'all'
        ? baseFilteredItems
        : baseFilteredItems.filter((item) => itemHasShoppingReviewReason(item, reviewReasonFilter));
      if (catalogFilter === 'all') return reviewFiltered;
      if (catalogFilter === 'active') {
        return reviewFiltered.filter((item) => item.catalogStatus === 'considering' || item.catalogStatus === 'wishlist');
      }
      if (catalogFilter === 'favorite') return reviewFiltered.filter((item) => item.isFavorite);
      return reviewFiltered.filter((item) => item.catalogStatus === catalogFilter);
    },
    [baseFilteredItems, catalogFilter, reviewReasonFilter],
  );
  const groups = useMemo(() => buildShoppingSessionGroups(filteredItems), [filteredItems]);
  const selectedBulkSnaps = useMemo(
    () => allItems.filter((item) => selectedItemIds.has(item.id)).flatMap((item) => item.snaps),
    [allItems, selectedItemIds],
  );
  // Resolving the last item a filter was pointing at empties the list, so the
  // reward for fixing something is "No items match". When the filter's own
  // chip disappears, step back to everything.
  useEffect(() => {
    if (attentionFilter === 'all') return;
    if (attentionOptions.some((option) => option.value === attentionFilter)) return;
    setAttentionFilter('all');
  }, [attentionFilter, attentionOptions]);

  // One filter, one count — picking "needs price" used to score two.
  const activeFilterCount = Number(storeFilter !== 'all')
    + Number(dateFilter !== 'all')
    + Number(attentionFilter !== 'all')
    + Number(catalogFilter !== 'all');

  const deleteSnaps = useCallback(async (snaps: ShoppingSnap[]) => {
    await deleteShoppingSnapsService(snaps, user?.id ?? null);
  }, [user?.id]);

  // Selection operates on a whole card (session group) at a time — toggling
  // adds or removes every item it contains together, never one at a time.
  const toggleSelectGroup = useCallback((group: ShoppingSessionGroup) => {
    void Haptics.selectionAsync();
    setSelectedItemIds((current) => {
      const groupItemIds = group.items.map((item) => item.id);
      const isFullySelected = groupItemIds.every((id) => current.has(id));
      const next = new Set(current);
      groupItemIds.forEach((id) => (isFullySelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }, []);

  const startSelection = useCallback((group?: ShoppingSessionGroup) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectionMode(true);
    if (group) {
      setSelectedItemIds((current) => {
        const next = new Set(current);
        group.items.forEach((item) => next.add(item.id));
        return next;
      });
    }
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedItemIds(new Set());
  }, []);

  const clearItemFilters = useCallback(() => {
    void Haptics.selectionAsync();
    setStoreFilter(STORE_FILTER_ALL);
    setDateFilter('all');
    setAttentionFilter('all');
    setCatalogFilter('all');
  }, []);

  const openStorePicker = useCallback(() => {
    void Haptics.selectionAsync();
    storeSheetRef.current?.present();
  }, []);

  const openStoreAssignment = useCallback((group: ShoppingSessionGroup) => {
    setStoreAssignmentTarget({
      snaps: group.items.flatMap((item) => item.snaps),
      shoppingSessionId: group.shoppingSessionId,
    });
    requestAnimationFrame(() => assignStoreSheetRef.current?.present());
  }, []);

  // From the item lightbox. A bottom sheet cannot appear above that full-screen
  // modal, so the lightbox steps aside and the sheet takes over here. The store
  // still lands on the whole visit, not just the item that was open.
  const assignStoreForItem = useCallback((item: ShoppingEditItem) => {
    const group = groups.find((candidate) => candidate.items.some((candidateItem) => candidateItem.id === item.id));
    setStoreAssignmentTarget(group
      ? { snaps: group.items.flatMap((groupItem) => groupItem.snaps), shoppingSessionId: group.shoppingSessionId }
      : {
        snaps: item.snaps,
        shoppingSessionId: item.snaps.find((snap) => snap.shoppingSessionId)?.shoppingSessionId ?? null,
      });
    setLightboxItem(null);
    requestAnimationFrame(() => assignStoreSheetRef.current?.present());
  }, [groups]);

  const saveStoreAssignment = useCallback(async (storeName: string) => {
    if (!storeAssignmentTarget) return;
    const saved = await assignShoppingStore(storeAssignmentTarget, storeName);
    if (saved) setStoreAssignmentTarget(null);
  }, [assignShoppingStore, storeAssignmentTarget]);

  const toggleStoreChip = useCallback((value: string) => {
    void Haptics.selectionAsync();
    setStoreFilter((current) => (current === value ? STORE_FILTER_ALL : value));
  }, []);

  const selectAttention = useCallback((value: ShortlistAttentionFilter) => {
    void Haptics.selectionAsync();
    setAttentionFilter(value);
  }, []);

  const confirmDeleteSelection = useCallback(() => {
    if (selectedBulkSnaps.length === 0) return;
    const itemCount = selectedItemIds.size;
    const count = selectedBulkSnaps.length;
    Alert.alert(
      `Delete ${itemCount} item${itemCount === 1 ? '' : 's'}?`,
      `${count} shopping photo${count === 1 ? '' : 's'} will be removed from your history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setIsDeletingSelection(true);
            void deleteSnaps(selectedBulkSnaps)
              .then(() => {
                cancelSelection();
                setLightboxItem(null);
              })
              .catch((error) => {
                Alert.alert(
                  'Could not delete photos',
                  error instanceof Error ? error.message : 'Please try again.',
                );
              })
              .finally(() => setIsDeletingSelection(false));
          },
        },
      ],
    );
  }, [cancelSelection, deleteSnaps, selectedBulkSnaps, selectedItemIds.size]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  // Only reached outside selection mode — the bundle itself routes taps to
  // card selection while selectionMode is on, so this always opens detail.
  const pressItem = useCallback((item: ShoppingEditItem, _snap: ShoppingSnap) => {
    setLightboxItem(item);
  }, []);

  const filteredCount = filteredItems.length;
  const countLine = selectionMode
    ? `${selectedItemIds.size} selected`
    : [
      `${filteredCount === allItems.length ? filteredCount : `${filteredCount} of ${allItems.length}`} find${allItems.length === 1 ? '' : 's'}`,
      `${summary.storeCount} store${summary.storeCount === 1 ? '' : 's'}`,
    ].join('  ·  ');

  // Once the masthead has scrolled away the rails go with it, so the compact
  // bar's subtitle carries what is currently filtered. Costs no height, and
  // FilterControl is right beside it as the way back.
  const compactState = selectionMode
    ? `${selectedItemIds.size} selected`
    : [
      attentionOptions.find((option) => option.value === attentionFilter)?.label ?? 'Everything',
      storeFilterLabel,
    ].join('  ·  ');

  const headerActions = (
    <View style={styles.heroActions}>
      {selectionMode ? (
        <ActionButton icon="close" label="Cancel" onPress={cancelSelection} variant="secondary" />
      ) : (
        <>
          <FilterControl
            count={activeFilterCount}
            onPress={() => filterSheetRef.current?.present()}
            label="Refine shortlist"
          />
          {allItems.length > 0 ? (
            <IconButton
              icon="checkmark-circle-outline"
              label="Select shopping items"
              onPress={() => startSelection()}
              variant="secondary"
            />
          ) : null}
          <ActionButton
            icon="camera"
            label="Add"
            onPress={() => navigation.navigate('ShoppingCamera')}
          />
        </>
      )}
    </View>
  );

  const listHeader = (
    <View>
      {/* Measured so the sticky instance below knows when to take over. Guarded
          because the rails and counts inside re-fire onLayout on every filter
          change, which would otherwise loop. */}
      <View onLayout={(event) => {
        const next = event.nativeEvent.layout.height;
        setHeroHeight((current) => (current === next ? current : next));
      }}>
        <ShopSubpageHeader
          title="Found, not yet yours."
          subtitle={allItems.length > 0
            ? `Pieces you photographed while shopping, kept here while you decide.  —  ${countLine}`
            : 'Pieces you photographed while shopping, kept here while you decide.'}
          eyebrow="THE SHORTLIST"
          onBack={goBack}
          actions={headerActions}
          style={styles.heroHeader}
        />
        {allItems.length > 0 ? (
          <View style={styles.railBlock}>
            <ShortlistFilterBar
              attentionOptions={attentionOptions}
              attentionValue={attentionFilter}
              attentionRestingValue="all"
              onSelectAttention={selectAttention}
              storeOptions={quickStoreOptions}
              storeFilter={storeFilter}
              storeActiveLabel={storeFilterLabel}
              storeActiveValue={activeQuickStoreValue}
              onSelectStore={toggleStoreChip}
              onBrowseStores={openStorePicker}
            />
          </View>
        ) : null}
      </View>

      {isError ? (
        <View style={styles.remoteError}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.primary} />
          <Text style={styles.remoteErrorText}>Showing saved device photos. Synced history is unavailable.</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={groups}
        keyExtractor={(group) => group.key}
        renderItem={({ item: group, index }) => (
          <ShoppingSessionBundle
            group={group}
            isLast={index === groups.length - 1}
            onOpenDetail={() => navigation.navigate('ShoppingHaulDetail', { groupKey: group.key })}
            selectionMode={selectionMode}
            isSelected={group.items.length > 0 && group.items.every((item) => selectedItemIds.has(item.id))}
            onPressItem={pressItem}
            onSelectCard={() => toggleSelectGroup(group)}
            onLongPressCard={() => startSelection(group)}
            onAddStore={!group.storeName ? () => openStoreAssignment(group) : undefined}
            onReviewGrouping={group.shoppingSessionId
              ? () => navigation.navigate('ShoppingVisitReview', { sessionId: group.shoppingSessionId as string })
              : undefined}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={isLoading ? (
          <View style={styles.emptyState}><ActivityIndicator color={colors.primary} /></View>
        ) : allItems.length > 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No items match</Text>
            <Text style={styles.emptyText}>Try clearing a filter to see more finds.</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={clearItemFilters}>
              <Text style={styles.emptyButtonText}>Clear filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Your shortlist starts here</Text>
            <Text style={styles.emptyText}>
              Photograph pieces and price tags while you shop, or import them from your camera roll, and keep them here until you decide.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('ShoppingCamera')}>
              <Ionicons name="camera-outline" size={18} color={colors.primaryForeground} />
              <Text style={styles.emptyButtonText}>Open Shopping Mode</Text>
            </TouchableOpacity>
          </View>
        )}
        onScroll={(event) => {
          // The expanded header never changes size and the compact bar is not
          // in this list's layout, so nothing here can move contentOffset —
          // which is what broke the collapse on ShoppingBriefDetailScreen.
          const compactHeaderHeight = insets.top + spacing.md + 52 + spacing.sm;
          const next = event.nativeEvent.contentOffset.y >= Math.max(0, heroHeight - compactHeaderHeight);
          setShowCompactHeader((current) => (current === next ? current : next));
        }}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.listContent,
          selectionMode && styles.listContentSelecting,
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      />

      {showCompactHeader ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(120)}
          exiting={reduceMotion ? undefined : FadeOut.duration(90)}
          style={styles.stickyHeader}
        >
          <ShopSubpageHeader
            compact
            title="Found, not yet yours."
            subtitle={compactState}
            eyebrow="THE SHORTLIST"
            onBack={goBack}
            actions={headerActions}
            style={styles.stickyHeaderContent}
          />
        </Animated.View>
      ) : null}

      {selectionMode ? (
        <View style={[styles.selectionBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity style={styles.selectionBarButton} onPress={cancelSelection} disabled={isDeletingSelection}>
            <Text style={styles.selectionBarCancel} numberOfLines={1}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.selectionDeleteButton,
              (selectedItemIds.size === 0 || isDeletingSelection) && styles.selectionDeleteButtonDisabled,
            ]}
            onPress={confirmDeleteSelection}
            disabled={selectedItemIds.size === 0 || isDeletingSelection}
          >
            {isDeletingSelection ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Ionicons name="trash-outline" size={18} color={colors.primaryForeground} />
            )}
            <Text style={styles.selectionDeleteText}>
              Delete {selectedItemIds.size || ''}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <BottomSheetModal
        ref={filterSheetRef}
        index={0}
        snapPoints={['70%']}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        backgroundStyle={styles.filterSheetBackground}
        handleIndicatorStyle={styles.filterSheetHandle}
      >
        <BottomSheetView style={styles.filterSheetContent}>
          <AppText variant="sheetTitle" tone="primary">Refine your edit</AppText>

          <AppText variant="eyebrow" tone="muted" style={styles.filterGroupLabel}>WHEN</AppText>
          <OptionChips
            options={DATE_OPTIONS}
            value={dateFilter}
            onSelect={(value) => setDateFilter(value)}
          />

          <AppText variant="eyebrow" tone="muted" style={styles.filterGroupLabel}>NEEDS ATTENTION</AppText>
          <OptionChips
            options={attentionOptions.map((option) => ({
              value: option.value,
              label: option.count === undefined ? option.label : `${option.label} · ${option.count}`,
            }))}
            value={attentionFilter}
            onSelect={(value) => setAttentionFilter(value)}
          />

          <AppText variant="eyebrow" tone="muted" style={styles.filterGroupLabel}>DECISION</AppText>
          <OptionChips
            options={[
              { value: 'all' as ShoppingCatalogFilter, label: 'Everything' },
              { value: 'active' as ShoppingCatalogFilter, label: 'Active decisions' },
              { value: 'favorite' as ShoppingCatalogFilter, label: 'Favorites' },
              ...SHOPPING_CATALOG_STATUS_OPTIONS.map((option) => ({
                value: option.value as ShoppingCatalogFilter,
                label: option.label,
              })),
            ]}
            value={catalogFilter}
            onSelect={(value) => setCatalogFilter(value)}
          />

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => filterSheetRef.current?.dismiss()}
          >
            <Text style={styles.doneButtonText}>View {filteredItems.length} item{filteredItems.length === 1 ? '' : 's'}</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>

      <ShoppingStoreFilterSheet
        sheetRef={storeSheetRef}
        options={storeOptions}
        totalItemCount={allItems.length}
        unassignedCount={unassignedStoreCount}
        storeFilter={storeFilter}
        onSelect={setStoreFilter}
      />

      <ShoppingStoreAssignmentSheet
        sheetRef={assignStoreSheetRef}
        options={storeOptions}
        onSelect={(storeName) => void saveStoreAssignment(storeName)}
      />

      {lightboxItem ? (
        <ShoppingItemLightbox
          item={lightboxItem}
          onClose={() => setLightboxItem(null)}
          onAssignStore={() => assignStoreForItem(lightboxItem)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingBottom: spacing.xxxl },
  listContentSelecting: { paddingBottom: 112 },
  heroHeader: { paddingBottom: spacing.lg, backgroundColor: colors.background },
  railBlock: { paddingBottom: spacing.lg },
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  stickyHeaderContent: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  remoteError: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.accent },
  remoteErrorText: { flex: 1, fontSize: typography.text.caption.fontSize, color: colors.secondaryForeground },
  emptyState: { minHeight: 320, alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.text.editorialCompact, textAlign: 'center', color: colors.foreground },
  emptyText: { maxWidth: 310, fontSize: typography.text.bodySmall.fontSize, lineHeight: 21, textAlign: 'center', color: colors.mutedForeground },
  emptyButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.full, backgroundColor: colors.primary },
  emptyButtonText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  filterSheetBackground: { backgroundColor: colors.background },
  filterSheetHandle: { backgroundColor: colors.border },
  filterSheetContent: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  filterGroupLabel: { paddingTop: spacing.sm, ...typography.text.eyebrow, color: colors.mutedForeground },
  doneButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: colors.primary },
  doneButtonText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground, fontVariant: ['tabular-nums'] },
  selectionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
  selectionBarButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  selectionBarCancel: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  selectionDeleteButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.md, backgroundColor: colors.error },
  selectionDeleteButtonDisabled: { opacity: 0.5 },
  selectionDeleteText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground, fontVariant: ['tabular-nums'] },
});
