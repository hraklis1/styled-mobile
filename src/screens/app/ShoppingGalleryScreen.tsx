import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
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

import { ShoppingSessionBundle } from '../../components/shopping/ShoppingSessionBundle';
import { ShoppingItemLightbox } from '../../components/shopping/ShoppingItemLightbox';
import { ShoppingStoreFilterSheet } from '../../components/shopping/ShoppingStoreFilterSheet';
import { ShoppingStoreAssignmentSheet } from '../../components/shopping/ShoppingStoreAssignmentSheet';
import { useAuth } from '../../contexts/AuthContext';
import { SHOPPING_SNAPS_QUERY_KEY, useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { queryClient } from '../../lib/queryClient';
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
import { supabase } from '../../lib/supabase';
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

const SYNC_OPTIONS: { value: ShoppingSyncFilter; label: string }[] = [
  { value: 'all', label: 'All items' },
  { value: 'pending', label: 'On this device' },
  { value: 'synced', label: 'Synced' },
];

const REVIEW_OPTIONS: { value: ShoppingReviewFilter; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'needs-review', label: 'Needs review' },
];

export function ShoppingGalleryScreen({ navigation, route }: ShoppingGalleryScreenProps) {
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const storeSheetRef = useRef<BottomSheetModal>(null);
  const assignStoreSheetRef = useRef<BottomSheetModal>(null);
  const storeSheetOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storeChipScrollRef = useRef<ScrollView>(null);
  const storeChipOffsetsRef = useRef<Record<string, number>>({});
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: remoteSnaps = [], isLoading, isRefetching, isError, refetch } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const assignVisitStore = useShoppingSessionStore((state) => state.assignVisitStore);
  const assignCaptureStore = useShoppingSessionStore((state) => state.assignCaptureStore);
  const [storeFilter, setStoreFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<ShoppingDateFilter>('all');
  const [syncFilter, setSyncFilter] = useState<ShoppingSyncFilter>('all');
  const [reviewFilter, setReviewFilter] = useState<ShoppingReviewFilter>('all');
  const [reviewReasonFilter, setReviewReasonFilter] = useState<ShoppingReviewReasonKey | 'all'>('all');
  const [catalogFilter, setCatalogFilter] = useState<ShoppingCatalogFilter>('all');
  const [lightboxItem, setLightboxItem] = useState<ShoppingEditItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [isDeletingSelection, setIsDeletingSelection] = useState(false);
  const [returningToTab, setReturningToTab] = useState(false);
  const [storeAssignmentGroup, setStoreAssignmentGroup] = useState<ShoppingSessionGroup | null>(null);

  const allSnaps = useMemo(
    () => mergeShoppingSnaps(remoteSnaps, pendingUploads),
    [pendingUploads, remoteSnaps],
  );
  const allItems = useMemo(() => buildShoppingEditItems(allSnaps), [allSnaps]);

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
    navigation.goBack();
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
  const pendingCount = pendingUploads.length;
  const activeFilterCount = Number(storeFilter !== 'all') + Number(dateFilter !== 'all') + Number(syncFilter !== 'all') + Number(reviewFilter !== 'all') + Number(reviewReasonFilter !== 'all') + Number(catalogFilter !== 'all');

  useEffect(() => () => {
    if (storeSheetOpenTimerRef.current) clearTimeout(storeSheetOpenTimerRef.current);
  }, []);

  // A store picked in the sheet may sit off-screen in the chip rail — bring it into view.
  useEffect(() => {
    if (!activeQuickStoreValue) {
      storeChipScrollRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }
    const offset = storeChipOffsetsRef.current[activeQuickStoreValue];
    if (offset === undefined) return;
    storeChipScrollRef.current?.scrollTo({ x: Math.max(0, offset - spacing.lg), animated: true });
  }, [activeQuickStoreValue]);

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
    setSyncFilter('all');
    setReviewFilter('all');
    setReviewReasonFilter('all');
    setCatalogFilter('all');
  }, []);

  const openStorePicker = useCallback(() => {
    void Haptics.selectionAsync();
    storeSheetRef.current?.present();
  }, []);

  const openStoreAssignment = useCallback((group: ShoppingSessionGroup) => {
    setStoreAssignmentGroup(group);
    requestAnimationFrame(() => assignStoreSheetRef.current?.present());
  }, []);

  const saveStoreAssignment = useCallback(async (storeName: string) => {
    const group = storeAssignmentGroup;
    if (!group) return;
    const snaps = group.items.flatMap((item) => item.snaps);
    const ids = snaps.map((snap) => snap.id);
    const syncedIds = snaps.filter((snap) => snap.syncStatus === 'synced').map((snap) => snap.id);

    assignCaptureStore(ids, storeName);
    if (group.shoppingSessionId) assignVisitStore(group.shoppingSessionId, storeName);
    try {
      if (syncedIds.length > 0) {
        if (!user) throw new Error('You need to be signed in to update synced photos.');
        if (group.shoppingSessionId) {
          const { error: sessionError } = await supabase
            .from('shopping_sessions')
            .update({ store_name: storeName })
            .eq('id', group.shoppingSessionId)
            .eq('user_id', user.id);
          if (sessionError) throw sessionError;
        }
        const { error: snapsError } = await supabase
          .from('shopping_snaps')
          .update({ store_name: storeName })
          .eq('user_id', user.id)
          .in('id', syncedIds);
        if (snapsError) throw snapsError;
        await queryClient.invalidateQueries({ queryKey: SHOPPING_SNAPS_QUERY_KEY });
      }
      setStoreAssignmentGroup(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Could not add store', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [assignCaptureStore, assignVisitStore, storeAssignmentGroup, user]);

  // Two modals can't hand over instantly — dismiss the refine sheet, then present.
  const openStorePickerFromFilters = useCallback(() => {
    void Haptics.selectionAsync();
    filterSheetRef.current?.dismiss();
    if (storeSheetOpenTimerRef.current) clearTimeout(storeSheetOpenTimerRef.current);
    storeSheetOpenTimerRef.current = setTimeout(() => storeSheetRef.current?.present(), 320);
  }, []);

  const toggleStoreChip = useCallback((value: string) => {
    void Haptics.selectionAsync();
    setStoreFilter((current) => (current === value ? STORE_FILTER_ALL : value));
  }, []);

  const showMissingPriceItems = useCallback(() => {
    void Haptics.selectionAsync();
    setReviewFilter('needs-review');
    setReviewReasonFilter('missing-price');
  }, []);

  const showPendingItems = useCallback(() => {
    void Haptics.selectionAsync();
    setSyncFilter('pending');
    setReviewReasonFilter('all');
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

  const listHeader = (
    <View>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity style={styles.headerIcon} onPress={goBack} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={23} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.heroActions}>
            {selectionMode ? (
              <TouchableOpacity style={styles.headerTextButton} onPress={cancelSelection}>
                <Text style={styles.headerTextButtonText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.headerIcon}
                  onPress={() => filterSheetRef.current?.present()}
                  accessibilityLabel={`${activeFilterCount} active gallery filters`}
                >
                  <Ionicons name="options-outline" size={21} color={colors.foreground} />
                  {activeFilterCount > 0 ? <View style={styles.filterDot} /> : null}
                </TouchableOpacity>
                {allItems.length > 0 ? (
                  <TouchableOpacity
                    style={styles.headerIcon}
                    onPress={() => startSelection()}
                    accessibilityLabel="Select shopping items"
                  >
                    <Ionicons name="checkmark-circle-outline" size={21} color={colors.foreground} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.cameraButton} onPress={() => navigation.navigate('ShoppingCamera')}>
                  <Ionicons name="camera" size={18} color={colors.primaryForeground} />
                  <Text style={styles.cameraButtonText}>Add</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <Text style={styles.eyebrow}>THE SHORTLIST</Text>
        <Text style={styles.heroTitle}>Found, not yet yours.</Text>
        <Text style={styles.heroDeck}>Pieces you photographed while shopping, kept here while you decide.</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {selectionMode
              ? `${selectedItemIds.size} selected`
              : `${summary.itemCount} item${summary.itemCount === 1 ? '' : 's'}`}
          </Text>
          {pendingCount > 0 ? (
            <View style={styles.localSummary}>
              <View style={styles.localSummaryDot} />
              <Text style={styles.localSummaryText}>{pendingCount} waiting to sync</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.metricsStrip}>
          <TouchableOpacity style={styles.metricCell} onPress={clearItemFilters} accessibilityLabel="Show all shopping items">
            <Text style={styles.metricValue}>{summary.itemCount}</Text>
            <Text style={styles.metricLabel}>Items</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.metricCell} onPress={openStorePicker} accessibilityLabel="Filter by store">
            <Text style={styles.metricValue}>{summary.storeCount}</Text>
            <Text style={styles.metricLabel}>Stores</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.metricCell} onPress={showMissingPriceItems} accessibilityLabel="Show items that need a price">
            <Text style={[styles.metricValue, summary.missingPriceItemCount > 0 && styles.metricValueWarn]}>
              {summary.missingPriceItemCount}
            </Text>
            <Text style={styles.metricLabel}>Needs price</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.metricCell} onPress={showPendingItems} accessibilityLabel="Show locally saved items">
            <Text style={[styles.metricValue, summary.pendingItemCount > 0 && styles.metricValueWarn]}>
              {summary.pendingItemCount}
            </Text>
            <Text style={styles.metricLabel}>Pending</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.storeFilterBlock}>
        <ScrollView
          ref={storeChipScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storeChipRow}
          style={styles.storeChipScroll}
        >
          <TouchableOpacity
            style={[styles.storeFilterChip, storeFilter === STORE_FILTER_ALL && styles.storeFilterChipActive]}
            onPress={() => setStoreFilter(STORE_FILTER_ALL)}
          >
            <Text style={[styles.storeFilterText, storeFilter === STORE_FILTER_ALL && styles.storeFilterTextActive]}>All stores</Text>
          </TouchableOpacity>
          {quickStoreOptions.map((store) => {
            const isActive = storeFilter === store.value
              || store.locations.some((location) => location.value === storeFilter);
            return (
              <TouchableOpacity
                key={store.value}
                style={[styles.storeFilterChip, isActive && styles.storeFilterChipActive]}
                onLayout={(event) => {
                  storeChipOffsetsRef.current[store.value] = event.nativeEvent.layout.x;
                }}
                onPress={() => toggleStoreChip(store.value)}
                onLongPress={store.locations.length > 0 ? openStorePicker : undefined}
              >
                <Text style={[styles.storeFilterText, isActive && styles.storeFilterTextActive]} numberOfLines={1}>
                  {isActive ? storeFilterLabel : store.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          {storeFilter === 'none' ? (
            <TouchableOpacity
              style={[styles.storeFilterChip, styles.storeFilterChipActive]}
              onPress={() => setStoreFilter(STORE_FILTER_ALL)}
            >
              <Text style={[styles.storeFilterText, styles.storeFilterTextActive]}>Store not set</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
        <TouchableOpacity
          style={styles.storePickerButton}
          onPress={openStorePicker}
          accessibilityLabel="Browse all stores"
        >
          <Ionicons name="storefront-outline" size={15} color={colors.foreground} />
          <Text style={styles.storePickerText} numberOfLines={1}>
            {summary.storeCount} store{summary.storeCount === 1 ? '' : 's'}
          </Text>
          <Ionicons name="chevron-down" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
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
        renderItem={({ item: group }) => (
          <ShoppingSessionBundle
            group={group}
            expanded={selectionMode}
            onOpenDetail={() => navigation.navigate('ShoppingHaulDetail', { groupKey: group.key })}
            selectionMode={selectionMode}
            isSelected={group.items.length > 0 && group.items.every((item) => selectedItemIds.has(item.id))}
            onPressItem={pressItem}
            onSelectCard={() => toggleSelectGroup(group)}
            onLongPressCard={() => startSelection(group)}
            onAddStore={!group.storeName ? () => openStoreAssignment(group) : undefined}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={isLoading ? (
          <View style={styles.emptyState}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyMonogram}><Ionicons name="images-outline" size={34} color={colors.primary} /></View>
            <Text style={styles.emptyTitle}>{allItems.length ? 'No items match' : 'Your shortlist starts here'}</Text>
            <Text style={styles.emptyText}>
              {allItems.length ? 'Try clearing a filter to see more finds.' : 'Photograph pieces and price tags while you shop, or import them from your camera roll, and keep them here until you decide.'}
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('ShoppingCamera')}>
              <Ionicons name="camera-outline" size={18} color={colors.primaryForeground} />
              <Text style={styles.emptyButtonText}>Open Shopping Mode</Text>
            </TouchableOpacity>
          </View>
        )}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.listContent,
          selectionMode && styles.listContentSelecting,
          groups.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      />

      {selectionMode ? (
        <View style={[styles.selectionBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity style={styles.selectionBarButton} onPress={cancelSelection} disabled={isDeletingSelection}>
            <Text style={styles.selectionBarCancel}>Cancel</Text>
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
        snapPoints={['82%']}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        backgroundStyle={styles.filterSheetBackground}
        handleIndicatorStyle={styles.filterSheetHandle}
      >
        <BottomSheetView style={styles.filterSheetContent}>
          <Text style={styles.filterSheetTitle}>Refine your edit</Text>
          <Text style={styles.filterGroupLabel}>STORE</Text>
          <TouchableOpacity style={styles.storeFilterRow} onPress={openStorePickerFromFilters}>
            <Ionicons name="storefront-outline" size={17} color={colors.foreground} />
            <Text
              style={[styles.storeFilterRowText, storeFilter !== STORE_FILTER_ALL && styles.storeFilterRowTextActive]}
              numberOfLines={1}
            >
              {storeFilterLabel}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={styles.filterGroupLabel}>DATE</Text>
          <View style={styles.optionGrid}>
            {DATE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, dateFilter === option.value && styles.optionButtonActive]}
                onPress={() => setDateFilter(option.value)}
              >
                <Text style={[styles.optionText, dateFilter === option.value && styles.optionTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.filterGroupLabel}>STATUS</Text>
          <View style={styles.optionGrid}>
            {SYNC_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, syncFilter === option.value && styles.optionButtonActive]}
                onPress={() => setSyncFilter(option.value)}
              >
                <Text style={[styles.optionText, syncFilter === option.value && styles.optionTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.filterGroupLabel}>REVIEW</Text>
          <View style={styles.optionGrid}>
            {REVIEW_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, reviewFilter === option.value && styles.optionButtonActive]}
                onPress={() => {
                  setReviewFilter(option.value);
                  if (option.value === 'all') setReviewReasonFilter('all');
                }}
              >
                <Text style={[styles.optionText, reviewFilter === option.value && styles.optionTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {reviewReasonOptions.length > 0 ? (
            <>
              <Text style={styles.filterGroupLabel}>REVIEW QUEUE</Text>
              <View style={styles.optionGrid}>
                <TouchableOpacity
                  style={[styles.optionButton, reviewReasonFilter === 'all' && styles.optionButtonActive]}
                  onPress={() => setReviewReasonFilter('all')}
                >
                  <Text style={[styles.optionText, reviewReasonFilter === 'all' && styles.optionTextActive]}>Any reason</Text>
                </TouchableOpacity>
                {reviewReasonOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.optionButton, reviewReasonFilter === option.key && styles.optionButtonActive]}
                    onPress={() => {
                      setReviewFilter('needs-review');
                      setReviewReasonFilter(option.key);
                    }}
                  >
                    <Text style={[styles.optionText, reviewReasonFilter === option.key && styles.optionTextActive]}>
                      {option.label} · {option.count}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}
          <Text style={styles.filterGroupLabel}>CATALOG</Text>
          <View style={styles.optionGrid}>
            <TouchableOpacity
              style={[styles.optionButton, catalogFilter === 'all' && styles.optionButtonActive]}
              onPress={() => setCatalogFilter('all')}
            >
              <Text style={[styles.optionText, catalogFilter === 'all' && styles.optionTextActive]}>All finds</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, catalogFilter === 'active' && styles.optionButtonActive]}
              onPress={() => setCatalogFilter('active')}
            >
              <Text style={[styles.optionText, catalogFilter === 'active' && styles.optionTextActive]}>Active decisions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, catalogFilter === 'favorite' && styles.optionButtonActive]}
              onPress={() => setCatalogFilter('favorite')}
            >
              <Text style={[styles.optionText, catalogFilter === 'favorite' && styles.optionTextActive]}>Favorites</Text>
            </TouchableOpacity>
            {SHOPPING_CATALOG_STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, catalogFilter === option.value && styles.optionButtonActive]}
                onPress={() => setCatalogFilter(option.value)}
              >
                <Text style={[styles.optionText, catalogFilter === option.value && styles.optionTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
        <ShoppingItemLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingBottom: spacing.xxxl },
  listContentSelecting: { paddingBottom: 112 },
  listContentEmpty: { flexGrow: 1 },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.card },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.xl },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.surfaceElevated },
  headerTextButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: colors.surfaceElevated },
  headerTextButtonText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  filterDot: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  cameraButton: { height: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: colors.primary },
  cameraButtonText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  eyebrow: { fontSize: 11, fontWeight: typography.weight.bold, letterSpacing: 2.1, color: colors.primary },
  heroTitle: { maxWidth: 330, paddingTop: spacing.sm, fontFamily: typography.family.display, fontSize: 34, lineHeight: 39, color: colors.foreground },
  heroDeck: { maxWidth: 330, paddingTop: spacing.sm, fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  summaryRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.md },
  summaryText: { fontSize: typography.size.sm, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  localSummary: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  localSummaryDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  localSummaryText: { fontSize: typography.size.xs, color: colors.primary, fontVariant: ['tabular-nums'] },
  metricsStrip: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg },
  metricCell: { flex: 1, minHeight: 58, justifyContent: 'center', gap: 2, paddingHorizontal: spacing.sm, borderRadius: radii.md, backgroundColor: colors.background },
  metricValue: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.foreground, fontVariant: ['tabular-nums'] },
  metricValueWarn: { color: colors.primary },
  metricLabel: { fontSize: 10, fontWeight: typography.weight.semibold, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.mutedForeground },
  storeFilterBlock: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  storeChipScroll: { flex: 1 },
  storeChipRow: { gap: spacing.sm, paddingLeft: spacing.lg, paddingRight: spacing.sm },
  storeFilterChip: { maxWidth: 168, height: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  storePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    marginRight: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  storePickerText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.foreground, fontVariant: ['tabular-nums'] },
  storeFilterChipActive: { borderColor: colors.foreground, backgroundColor: colors.foreground },
  storeFilterText: { fontSize: typography.size.sm, color: colors.secondaryForeground },
  storeFilterTextActive: { fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  remoteError: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.accent },
  remoteErrorText: { flex: 1, fontSize: typography.size.xs, color: colors.secondaryForeground },
  emptyState: { flex: 1, minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyMonogram: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: colors.accent },
  emptyTitle: { fontFamily: typography.family.display, fontSize: typography.size.xxl, textAlign: 'center', color: colors.foreground },
  emptyText: { maxWidth: 310, fontSize: typography.size.sm, lineHeight: 21, textAlign: 'center', color: colors.mutedForeground },
  emptyButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.full, backgroundColor: colors.primary },
  emptyButtonText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  filterSheetBackground: { backgroundColor: colors.background },
  filterSheetHandle: { backgroundColor: colors.border },
  filterSheetContent: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  filterSheetTitle: { fontFamily: typography.family.display, fontSize: typography.size.xxl, color: colors.foreground },
  filterGroupLabel: { paddingTop: spacing.sm, fontSize: 11, fontWeight: typography.weight.bold, letterSpacing: 1.5, color: colors.mutedForeground },
  storeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
  },
  storeFilterRowText: { flex: 1, fontSize: typography.size.md, color: colors.secondaryForeground },
  storeFilterRowTextActive: { fontWeight: typography.weight.semibold, color: colors.foreground },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
  optionButtonActive: { backgroundColor: colors.foreground },
  optionText: { fontSize: typography.size.sm, color: colors.secondaryForeground },
  optionTextActive: { fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  doneButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: colors.primary },
  doneButtonText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primaryForeground, fontVariant: ['tabular-nums'] },
  selectionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
  selectionBarButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  selectionBarCancel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  selectionDeleteButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.md, backgroundColor: colors.error },
  selectionDeleteButtonDisabled: { opacity: 0.5 },
  selectionDeleteText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primaryForeground, fontVariant: ['tabular-nums'] },
});
