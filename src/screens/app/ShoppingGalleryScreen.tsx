import { ShoppingPieceTile } from '../../components/shopping/ShoppingPieceTile';
import { ShoppingCompare } from '../../components/shopping/ShoppingCompare';
import { ShoppingSyncNotice } from '../../components/shopping/ShoppingSyncNotice';
import { useShoppingItemActions } from '../../hooks/useShoppingItemActions';
import { useShoppingOfflineStore, emptyShoppingAccount } from '../../stores/useShoppingOfflineStore';
import { browseShoppingItems } from '../../lib/shoppingSearch';
import { track } from '../../lib/analytics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  TextInput,
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
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { ShoppingSessionBundle } from '../../components/shopping/ShoppingSessionBundle';
import { ShortlistFilterBar, ShortlistToggleChip, type ShortlistAppliedFilter } from '../../components/shopping/ShortlistFilterBar';
import { ShoppingItemLightbox } from '../../components/shopping/ShoppingItemLightbox';
import { ShoppingStoreFilterSheet } from '../../components/shopping/ShoppingStoreFilterSheet';
import { ShoppingStoreAssignmentSheet } from '../../components/shopping/ShoppingStoreAssignmentSheet';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { AppText } from '../../components/primitives/AppText';
import { ActionButton, FilterControl, IconButton, SegmentedControl } from '../../components/primitives/Editorial';
import { SearchField } from '../../components/primitives/SearchField';
import { ActionMenuSheet, type ActionMenuOption } from '../../components/primitives/ActionMenuSheet';
import { OptionChips } from '../../components/primitives/EditAtoms';
import { useAuth } from '../../contexts/AuthContext';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { useAssignShoppingStore, type ShoppingStoreAssignmentTarget } from '../../hooks/useAssignShoppingStore';
import {
  buildShoppingEditItems,
  filterShoppingEditItems,
  matchesShoppingCatalogStatuses,
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
  const account = useShoppingOfflineStore((state) => state.accounts[user?.id ?? ''] ?? emptyShoppingAccount);
  const viewMode = account.view;
  const { saveCatalog } = useShoppingItemActions();
  const [query, setQuery] = useState('');
  // Search hides behind a magnifier until asked for; a typed query keeps the
  // field open so the results can't be narrowed by something invisible.
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuGroup, setMenuGroup] = useState<ShoppingSessionGroup | null>(null);
  const [favorites, setFavorites] = useState(false);
  const [category, setCategory] = useState('');
  const [currency, setCurrency] = useState('');
  const [minimum, setMinimum] = useState('');
  const [maximum, setMaximum] = useState('');
  const [oldest, setOldest] = useState(false);
  const [comparison, setComparison] = useState<ShoppingEditItem[] | null>(null);
  const { data: remoteSnaps = [], isLoading, isRefetching, isError, refetch } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const [storeFilter, setStoreFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<ShoppingDateFilter>('all');
  const [attentionFilter, setAttentionFilter] = useState<ShortlistAttentionFilter>('all');
  const [catalogStatuses, setCatalogStatuses] = useState<Set<ShoppingFindCatalogStatus>>(() => new Set(['considering']));
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
    if (requestedFilter) {
      setCatalogStatuses(requestedFilter === 'active'
        ? new Set<ShoppingFindCatalogStatus>(['considering', 'wishlist'])
        : new Set());
    }
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
  const storeFilterLabel = useMemo(
    () => shoppingStoreFilterLabel(storeOptions, storeFilter),
    [storeFilter, storeOptions],
  );
  const summary = useMemo(() => summarizeShoppingEditItems(allItems), [allItems]);
  const reviewReasonOptions = useMemo(() => buildShoppingReviewReasonOptions(allItems), [allItems]);
  // Counts come from every item, never the filtered list — a count badge that
  // re-counted the filtered set would zero itself the moment you tapped it.
  const attentionOptions = useMemo<{ value: ShortlistAttentionFilter; label: string; count?: number }[]>(() => {
    const options: { value: ShortlistAttentionFilter; label: string; count?: number }[] = [{ value: 'all', label: 'Everything' }];
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
      return browseShoppingItems(reviewFiltered.filter((item) => matchesShoppingCatalogStatuses(item.catalogStatus, catalogStatuses)), { query, favorites, category, currency, min: minimum, max: maximum, oldest });
    },
    [baseFilteredItems, catalogStatuses, reviewReasonFilter, query, favorites, category, currency, minimum, maximum, oldest],
  );
  const groups = useMemo(() => { const visits = buildShoppingSessionGroups(filteredItems); return oldest ? visits.reverse() : visits; }, [filteredItems, oldest]);
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
    + catalogStatuses.size + Number(Boolean(category)) + Number(Boolean(currency)) + Number(Boolean(minimum || maximum)) + Number(oldest);

  const appliedFilters = useMemo<ShortlistAppliedFilter[]>(() => {
    const filters: ShortlistAppliedFilter[] = [];
    if (dateFilter !== 'all') {
      filters.push({
        key: `date:${dateFilter}`,
        label: DATE_OPTIONS.find((option) => option.value === dateFilter)?.label ?? dateFilter,
        onRemove: () => setDateFilter('all'),
      });
    }
    if (attentionFilter !== 'all') {
      filters.push({
        key: `attention:${attentionFilter}`,
        label: attentionOptions.find((option) => option.value === attentionFilter)?.label ?? attentionFilter,
        onRemove: () => setAttentionFilter('all'),
      });
    }
    for (const status of catalogStatuses) {
      filters.push({
        key: `status:${status}`,
        label: SHOPPING_CATALOG_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status.charAt(0).toUpperCase() + status.slice(1),
        onRemove: () => setCatalogStatuses((current) => {
          const next = new Set(current);
          next.delete(status);
          return next;
        }),
      });
    }
    if (storeFilter !== STORE_FILTER_ALL) {
      filters.push({
        key: `store:${storeFilter}`,
        label: storeFilterLabel,
        onRemove: () => setStoreFilter(STORE_FILTER_ALL),
      });
    }
    if (category) filters.push({ key: 'category', label: category, onRemove: () => setCategory('') });
    if (currency) filters.push({ key: 'currency', label: currency, onRemove: () => { setCurrency(''); setMinimum(''); setMaximum(''); } });
    if (minimum || maximum) filters.push({ key: 'price', label: `${minimum || '0'}–${maximum || 'any'}`, onRemove: () => { setMinimum(''); setMaximum(''); } });
    if (oldest) filters.push({ key: 'sort', label: 'Oldest first', onRemove: () => setOldest(false) });
    return filters;
  }, [category, currency, minimum, maximum, oldest, attentionFilter, attentionOptions, catalogStatuses, dateFilter, storeFilter, storeFilterLabel]);

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
    setCategory(''); setCurrency(''); setMinimum(''); setMaximum(''); setOldest(false); setFavorites(false); setQuery('');
    void Haptics.selectionAsync();
    setStoreFilter(STORE_FILTER_ALL);
    setDateFilter('all');
    setAttentionFilter('all');
    setCatalogStatuses(new Set());
  }, []);

  const openStorePicker = useCallback(() => {
    void Haptics.selectionAsync();
    filterSheetRef.current?.dismiss();
    requestAnimationFrame(() => storeSheetRef.current?.present());
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

  const toggleCatalogStatus = useCallback((value: ShoppingFindCatalogStatus) => {
    void Haptics.selectionAsync();
    setCatalogStatuses((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const confirmDeleteSelection = useCallback(() => {
    if (selectedBulkSnaps.length === 0) return;
    const itemCount = selectedItemIds.size;
    const count = selectedBulkSnaps.length;
    Alert.alert(
      `Delete ${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'}?`,
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

  const confirmDeleteGroup = useCallback((group: ShoppingSessionGroup) => {
    const snaps = group.items.flatMap((item) => item.snaps);
    Alert.alert(
      `Delete ${group.itemCount} ${group.itemCount === 1 ? 'piece' : 'pieces'}?`,
      `${snaps.length} shopping photo${snaps.length === 1 ? '' : 's'} will be removed from your history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteSnaps(snaps).catch((error) => {
              Alert.alert('Could not delete photos', error instanceof Error ? error.message : 'Please try again.');
            });
          },
        },
      ],
    );
  }, [deleteSnaps]);

  // Everything a visit can do, in one place. Options only appear when they
  // apply, so a stored, sorted visit offers just select and delete.
  const menuOptions = useMemo<ActionMenuOption[]>(() => {
    if (!menuGroup) return [];
    const group = menuGroup;
    const options: ActionMenuOption[] = [];
    if (group.shoppingSessionId) {
      const sessionId = group.shoppingSessionId;
      if (group.unsortedCount > 0) {
        options.push({
          label: `Sort photos · ${group.unsortedCount}`,
          icon: 'albums-outline',
          onPress: () => navigation.navigate('ShoppingVisitReview', { sessionId }),
        });
      }
      options.push({
        label: 'Adjust grouping',
        icon: 'git-branch-outline',
        onPress: () => navigation.navigate('ShoppingVisitReview', { sessionId }),
      });
    }
    if (!group.storeName) {
      options.push({ label: SHORTLIST_COPY.addStore, icon: 'storefront-outline', onPress: () => openStoreAssignment(group) });
      // The row's heading is spoken for (it asks for the store), so the way
      // into the visit lives here instead.
      options.push({ label: 'Open visit', icon: 'images-outline', onPress: () => navigation.navigate('ShoppingHaulDetail', { groupKey: group.key }) });
    }
    options.push({ label: 'Select visit', icon: 'checkmark-circle-outline', onPress: () => startSelection(group) });
    options.push({ label: 'Delete visit', icon: 'trash-outline', destructive: true, onPress: () => confirmDeleteGroup(group) });
    return options;
  }, [confirmDeleteGroup, menuGroup, navigation, openStoreAssignment, startSelection]);

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
      `${filteredCount === allItems.length ? filteredCount : `${filteredCount} of ${allItems.length}`} ${filteredCount === 1 ? 'piece' : 'pieces'}`,
      `${summary.storeCount} store${summary.storeCount === 1 ? '' : 's'}`,
    ].join('  ·  ');

  // Once the masthead has scrolled away, the compact bar carries active state.
  // At rest it shows the useful piece/store summary instead of spelling out
  // invisible defaults such as "Everything" and "All stores".
  const compactState = selectionMode
    ? `${selectedItemIds.size} selected`
    : appliedFilters.length > 0
      ? appliedFilters.map((filter) => filter.label).join('  ·  ')
      : countLine;

  const headerActions = (
    <View style={styles.heroActions}>
      {selectionMode ? (
        <ActionButton icon="close" label="Cancel" onPress={cancelSelection} variant="secondary" />
      ) : (
        <>
          {/* Selection has no button — long-pressing any visit or piece enters
              it, as in the closet. */}
          <IconButton
            icon={query ? 'search' : 'search-outline'}
            label="Search shortlist"
            variant={query ? 'primary' : 'secondary'}
            onPress={() => setSearchOpen((open) => !open || Boolean(query))}
          />
          <FilterControl
            count={activeFilterCount}
            onPress={() => filterSheetRef.current?.present()}
            label="Refine shortlist"
          />
          <ActionButton
            icon="camera"
            label="Add piece"
            onPress={() => navigation.navigate('ShoppingCamera')}
          />
        </>
      )}
    </View>
  );

  const listHeader = (
    <View>
      {/* Measured so the sticky instance below knows when to take over. Guarded
          because filter state inside can re-fire onLayout, which would
          otherwise loop. */}
      <View onLayout={(event) => {
        const next = event.nativeEvent.layout.height;
        setHeroHeight((current) => (current === next ? current : next));
      }}>
        <ShopSubpageHeader
          title="Your shortlist"
          compact={allItems.length > 0}
          subtitle={allItems.length > 0
            ? countLine
            : 'Pieces you photographed while shopping, kept here while you decide.'}
          eyebrow={null}
          onBack={goBack}
          actions={headerActions}
          style={styles.heroHeader}
        />
        <View style={styles.controls}>
          {/* Mode on the left, the one always-on filter on the right: a single
              row instead of a rail that held nothing but Favorites at rest. */}
          <View style={styles.modeRow}>
            <SegmentedControl
              value={viewMode}
              options={[{ value: 'pieces', label: 'Pieces' }, { value: 'visits', label: 'Visits' }]}
              onChange={(value) => { if (user) useShoppingOfflineStore.getState().view(user.id, value); cancelSelection(); }}
            />
            {allItems.length > 0 ? (
              <ShortlistToggleChip
                label="Favorites"
                icon="heart-outline"
                activeIcon="heart"
                active={favorites}
                onPress={() => setFavorites((value) => !value)}
              />
            ) : null}
          </View>
          {searchOpen || query ? (
            <SearchField
              value={query}
              onChangeText={setQuery}
              onClear={() => setSearchOpen(false)}
              dismissible
              autoFocus
              placeholder="Search pieces, brands, stores, notes…"
              accessibilityLabel="Search shortlist"
              onSubmitEditing={() => track('shopping_search_used', { result_count: filteredItems.length })}
              style={styles.searchField}
            />
          ) : null}
        </View>
        {allItems.length > 0 ? <ShortlistFilterBar filters={appliedFilters} /> : null}
        {/* Carries its own padding only when it has something to say, so an
            idle notice adds no gap above the first visit. */}
        <View style={styles.syncNotice}><ShoppingSyncNotice /></View>
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
      {viewMode === 'pieces' ? <FlatList
        data={filteredItems}
        numColumns={2}
        key="pieces"
        keyExtractor={(item) => item.id}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        ListHeaderComponent={listHeader}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: selectionMode ? 180 : 32 }}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyTitle}>{allItems.length ? 'No matching pieces' : 'Your next find starts here'}</Text><Text style={styles.emptyText}>Photograph a piece or import photos to consider later.</Text><ActionButton icon="add" label={allItems.length ? 'Clear filters' : 'Add piece'} onPress={() => { if (allItems.length) { setQuery(''); setFavorites(false); setCategory(''); setCurrency(''); setMinimum(''); setMaximum(''); setCatalogStatuses(new Set()); clearItemFilters(); } else navigation.navigate('ShoppingCamera'); }} /></View>}
        renderItem={({ item }) => <ShoppingPieceTile item={item} selected={selectedItemIds.has(item.id)} selecting={selectionMode} onPress={() => { if (selectionMode) setSelectedItemIds((ids) => { const next = new Set(ids); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; }); else setLightboxItem(item); }} onLongPress={() => { setSelectionMode(true); setSelectedItemIds(new Set([item.id])); }} onFavorite={() => void saveCatalog(item.captureGroupId, { isFavorite: !item.isFavorite }).catch((error) => Alert.alert('Could not save', error.message))} />}
      /> : <FlatList
        key="visits"
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
            onOpenMenu={() => setMenuGroup(group)}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={isLoading ? (
          <View style={styles.emptyState}><ActivityIndicator color={colors.primary} /></View>
        ) : allItems.length > 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No pieces match</Text>
            <Text style={styles.emptyText}>Try clearing a filter to see more pieces.</Text>
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
      />}

      {comparison ? <ShoppingCompare items={comparison} onClose={() => setComparison(null)} /> : null}

      <ActionMenuSheet
        visible={menuGroup !== null}
        title={menuGroup?.storeName ?? SHORTLIST_COPY.needsStore}
        subtitle={menuGroup ? `${menuGroup.dateLabel}  ·  ${menuGroup.itemCount} ${menuGroup.itemCount === 1 ? SHORTLIST_COPY.piece : SHORTLIST_COPY.pieces}` : undefined}
        options={menuOptions}
        onClose={() => setMenuGroup(null)}
      />

      {viewMode === 'visits' && showCompactHeader ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(120)}
          exiting={reduceMotion ? undefined : FadeOut.duration(90)}
          style={styles.stickyHeader}
        >
          <ShopSubpageHeader
            compact
            title="Your shortlist"
            subtitle={compactState}
            eyebrow={null}
            onBack={goBack}
            actions={headerActions}
            style={styles.stickyHeaderContent}
          />
        </Animated.View>
      ) : null}

      {selectionMode ? (
        <View style={[styles.selectionBar, { flexWrap: 'wrap' }, { paddingBottom: insets.bottom + spacing.md }]}>
          <ActionButton icon="git-compare-outline" label="Compare" variant="secondary" onPress={() => { const selected = allItems.filter((item) => selectedItemIds.has(item.id)); if (selected.length < 2 || selected.length > 3) { Alert.alert('Choose two or three pieces', 'Adjust your selection to compare.'); return; } track('shopping_comparison_opened', { piece_count: selected.length }); setComparison(selected); }} />
          {SHOPPING_CATALOG_STATUS_OPTIONS.map((option) => <TouchableOpacity key={option.value} style={styles.selectionBarButton} onPress={() => { void Promise.all([...selectedItemIds].map((id) => saveCatalog(id, { catalogStatus: option.value }))).then(cancelSelection).catch((error) => Alert.alert('Could not save', error.message)); }}><Text style={{ color: colors.primary }}>{option.label}</Text></TouchableOpacity>)}
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
        <BottomSheetView style={{ flex: 1 }}><ScrollView contentContainerStyle={styles.filterSheetContent} keyboardShouldPersistTaps="handled">
          <AppText variant="sheetTitle" tone="primary">Refine your shortlist</AppText>

          <AppText variant="eyebrow" tone="muted">CATEGORY</AppText>
          <OptionChips options={[{ value: '', label: 'All categories' }, ...[...new Set(allItems.map((item) => item.category).filter((value): value is string => Boolean(value)))].map((value) => ({ value, label: value }))]} value={category} onSelect={setCategory} />
          <AppText variant="eyebrow" tone="muted">PRICE AND CURRENCY</AppText>
          <TextInput value={currency} onChangeText={(value) => setCurrency(value.toUpperCase())} autoCapitalize="characters" maxLength={3} placeholder="Currency, e.g. CAD" accessibilityLabel="Price filter currency" style={{ minHeight: 44, color: colors.foreground }} />
          <View style={{ flexDirection: 'row', gap: 12 }}>{[{ value: minimum, set: setMinimum, label: 'Minimum' }, { value: maximum, set: setMaximum, label: 'Maximum' }].map((field) => <TextInput key={field.label} value={field.value} onChangeText={field.set} editable={currency.length === 3} keyboardType="decimal-pad" placeholder={field.label} accessibilityLabel={field.label + ' price'} style={{ flex: 1, minHeight: 44, color: colors.foreground }} />)}</View>
          <OptionChips options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }]} value={oldest ? 'oldest' : 'newest'} onSelect={(value) => setOldest(value === 'oldest')} />
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

          <AppText variant="eyebrow" tone="muted" style={styles.filterGroupLabel}>STATUS</AppText>
          <OptionChips
            options={SHOPPING_CATALOG_STATUS_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            multi
            multiValue={[...catalogStatuses]}
            onMultiToggle={(value) => toggleCatalogStatus(value as ShoppingFindCatalogStatus)}
          />

          <AppText variant="eyebrow" tone="muted" style={styles.filterGroupLabel}>STORE</AppText>
          <TouchableOpacity style={styles.storePickerButton} onPress={openStorePicker}>
            <Text style={styles.storePickerText}>{storeFilter === STORE_FILTER_ALL ? 'All stores' : storeFilterLabel}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>

          {activeFilterCount > 0 ? (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearItemFilters}>
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.doneButton} onPress={() => filterSheetRef.current?.dismiss()}>
            <Text style={styles.doneButtonText}>Show {filteredItems.length} piece{filteredItems.length === 1 ? '' : 's'}</Text>
          </TouchableOpacity>
        </ScrollView></BottomSheetView>
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
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  stickyHeaderContent: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  controls: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  syncNotice: { paddingHorizontal: spacing.lg },
  searchField: { flex: 0 },
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
  clearFiltersButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  clearFiltersText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.action },
  storePickerButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  storePickerText: { flex: 1, fontSize: typography.text.bodySmall.fontSize, color: colors.foreground },
  selectionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
  selectionBarButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  selectionBarCancel: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  selectionDeleteButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.md, backgroundColor: colors.error },
  selectionDeleteButtonDisabled: { opacity: 0.5 },
  selectionDeleteText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground, fontVariant: ['tabular-nums'] },
});
