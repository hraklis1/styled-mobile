import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';
import { SHOPPING_SNAPS_QUERY_KEY, useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { queryClient } from '../../lib/queryClient';
import {
  buildShoppingEditItems,
  dateGroupLabel,
  filterShoppingEditItems,
  mergeShoppingSnaps,
  summarizeShoppingEditItems,
  type ShoppingDateFilter,
  type ShoppingEditItem,
  type ShoppingReviewFilter,
  type ShoppingSyncFilter,
} from '../../lib/shoppingGallery';
import {
  buildShoppingSnapOrganizationUpdates,
  type ShoppingSnapOrganizationStage,
  type ShoppingSnapOrganizationUpdate,
} from '../../lib/shoppingSnapOrganizer';
import {
  formatShoppingDetailLocation,
  formatShoppingPlaceLabel,
  normalizeStoreName,
  shoppingFilterKey,
} from '../../lib/shoppingLocations';
import { supabase } from '../../lib/supabase';
import type { ShoppingGalleryScreenProps } from '../../navigation/types';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import type { ShoppingCaptureRole, ShoppingSnap } from '../../types/shoppingSnap';

type GalleryRow = ShoppingEditItem[];
type GallerySection = {
  key: string;
  dateLabel: string;
  storeName: string;
  placeLabel: string | null;
  itemCount: number;
  photoCount: number;
  knownSpend: number | null;
  data: GalleryRow[];
};
type StoreFilterOption = { value: string; label: string };

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

const SHOPPING_BUCKET = 'shopping-snaps';

function priceLabel(price: number | null): string | null {
  if (price === null) return null;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(price);
}

function itemPlaceLabel(item: ShoppingEditItem): string | null {
  const label = formatShoppingPlaceLabel(item);
  return label === 'Location not set' ? null : label;
}

function itemStatusLabel(item: ShoppingEditItem): string {
  if (item.needsReview) return item.reviewReasons[0] ?? 'Needs review';
  if (item.syncStatus === 'pending') return 'Waiting to sync';
  return 'Ready';
}

function buildSections(items: ShoppingEditItem[]): GallerySection[] {
  const grouped = new Map<string, { dateLabel: string; storeName: string; placeLabel: string | null; items: ShoppingEditItem[] }>();

  for (const item of items) {
    const date = new Date(item.capturedAt);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const storeName = item.storeName ?? 'Store not set';
    const placeLabel = itemPlaceLabel(item);
    const key = `${dateKey}:${storeName}:${placeLabel ?? ''}`;
    const current = grouped.get(key) ?? { dateLabel: dateGroupLabel(date), storeName, placeLabel, items: [] };
    current.items.push(item);
    grouped.set(key, current);
  }

  return [...grouped.entries()].map(([key, group]) => ({
    key,
    dateLabel: group.dateLabel,
    storeName: group.storeName,
    placeLabel: group.placeLabel,
    itemCount: group.items.length,
    photoCount: group.items.reduce((count, item) => count + item.photoCount, 0),
    knownSpend: group.items.some((item) => item.extractedPrice !== null)
      ? group.items.reduce((total, item) => total + (item.extractedPrice ?? 0), 0)
      : null,
    data: group.items.reduce<GalleryRow[]>((rows, item, index) => {
      if (index % 2 === 0) rows.push([item]);
      else rows[rows.length - 1].push(item);
      return rows;
    }, []),
  }));
}

function roleLabel(role: ShoppingCaptureRole): string {
  if (role === 'tag') return 'Tag';
  if (role === 'garment') return 'Garment';
  return 'Unsorted';
}

function nextRole(role: ShoppingCaptureRole): ShoppingCaptureRole {
  if (role === 'unknown') return 'garment';
  if (role === 'garment') return 'tag';
  return 'unknown';
}

function stagePrice(snaps: ShoppingSnap[], snapIds: string[]): string | null {
  const snapSet = new Set(snapIds);
  const price = snaps.find((snap) => snapSet.has(snap.id) && snap.captureRole === 'tag' && snap.extractedPrice !== null)?.extractedPrice
    ?? snaps.find((snap) => snapSet.has(snap.id) && snap.extractedPrice !== null)?.extractedPrice
    ?? null;
  return priceLabel(price);
}

function ShoppingSnapOrganizerModal({
  visible,
  snaps,
  onClose,
  onSave,
  isSaving,
}: {
  visible: boolean;
  snaps: ShoppingSnap[];
  onClose: () => void;
  onSave: (updates: ShoppingSnapOrganizationUpdate[]) => Promise<void>;
  isSaving: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [unassignedIds, setUnassignedIds] = useState<string[]>([]);
  const [stages, setStages] = useState<ShoppingSnapOrganizationStage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [rolesBySnapId, setRolesBySnapId] = useState<Record<string, ShoppingCaptureRole>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const snapById = useMemo(() => new Map(snaps.map((snap) => [snap.id, snap])), [snaps]);
  const snapsWithStagedRoles = useMemo(
    () => snaps.map((snap) => ({ ...snap, captureRole: rolesBySnapId[snap.id] ?? snap.captureRole })),
    [rolesBySnapId, snaps],
  );
  const originalCaptureGroupId = snaps[0]?.captureGroupId ?? '';
  const hasRoleChanges = snaps.some((snap) => rolesBySnapId[snap.id] && rolesBySnapId[snap.id] !== snap.captureRole);
  const hasGroupChanges = stages.length > 0;
  const canSave = (hasRoleChanges || hasGroupChanges) && snaps.length > 0 && !isSaving;

  const orderIds = useCallback((ids: string[]) => {
    const order = new Map(snaps.map((snap, index) => [snap.id, index]));
    return [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  }, [snaps]);

  useEffect(() => {
    if (!visible) return;
    setUnassignedIds(snaps.map((snap) => snap.id));
    setStages([]);
    setSelectedIds(new Set());
    setRolesBySnapId(Object.fromEntries(snaps.map((snap) => [snap.id, snap.captureRole])));
    setSaveError(null);
  }, [snaps, visible]);

  const toggleSelected = useCallback((snapId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(snapId)) next.delete(snapId);
      else next.add(snapId);
      return next;
    });
  }, []);

  const cycleRole = useCallback((snapId: string) => {
    setRolesBySnapId((current) => {
      const snap = snapById.get(snapId);
      const currentRole = current[snapId] ?? snap?.captureRole ?? 'unknown';
      return { ...current, [snapId]: nextRole(currentRole) };
    });
  }, [snapById]);

  const makeItem = useCallback(() => {
    const selected = unassignedIds.filter((snapId) => selectedIds.has(snapId));
    if (selected.length === 0) return;
    setStages((current) => [...current, { id: Crypto.randomUUID(), snapIds: selected }]);
    setUnassignedIds((current) => current.filter((snapId) => !selectedIds.has(snapId)));
    setSelectedIds(new Set());
    setSaveError(null);
    void Haptics.selectionAsync();
  }, [selectedIds, unassignedIds]);

  const undoStage = useCallback((stageId: string) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage) return;
    setStages((current) => current.filter((item) => item.id !== stageId));
    setUnassignedIds((current) => orderIds([...current, ...stage.snapIds]));
    setSelectedIds(new Set());
  }, [orderIds, stages]);

  const save = useCallback(() => {
    const stagedItems = [
      ...stages,
      { id: 'unassigned', snapIds: unassignedIds },
    ].filter((stage) => stage.snapIds.length > 0);
    const updates = buildShoppingSnapOrganizationUpdates(snaps, stagedItems, rolesBySnapId, {
      originalCaptureGroupId,
      createGroupId: () => Crypto.randomUUID(),
    });
    setSaveError(null);
    void onSave(updates).catch((error) => {
      setSaveError(error instanceof Error ? error.message : 'Please try again.');
    });
  }, [onSave, originalCaptureGroupId, rolesBySnapId, snaps, stages, unassignedIds]);

  const renderPhoto = useCallback((snapId: string, selectable: boolean) => {
    const snap = snapById.get(snapId);
    if (!snap) return null;
    const role = rolesBySnapId[snapId] ?? snap.captureRole;
    const selected = selectedIds.has(snapId);
    return (
      <View key={snapId} style={styles.organizerPhotoWrap}>
        <TouchableOpacity
          style={[styles.organizerPhoto, selected && styles.organizerPhotoSelected]}
          onPress={() => selectable && toggleSelected(snapId)}
          disabled={!selectable || isSaving}
          activeOpacity={0.85}
          accessibilityLabel={`${roleLabel(role)} photo${selectable ? ', tap to select' : ''}`}
          accessibilityState={{ selected }}
        >
          <Image source={{ uri: snap.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          {selected ? (
            <View style={styles.organizerCheck}>
              <Ionicons name="checkmark" size={15} color={colors.primaryForeground} />
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.organizerRoleChip}
          onPress={() => cycleRole(snapId)}
          disabled={isSaving}
          accessibilityLabel={`Change photo role from ${roleLabel(role)}`}
        >
          <Text style={styles.organizerRoleText}>{roleLabel(role)}</Text>
        </TouchableOpacity>
      </View>
    );
  }, [cycleRole, isSaving, rolesBySnapId, selectedIds, snapById, toggleSelected]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.organizerRoot, { paddingTop: insets.top }]}>
        <View style={styles.organizerHeader}>
          <View style={styles.organizerHeaderCopy}>
            <Text style={styles.detailEyebrow}>ORGANIZE</Text>
            <Text style={styles.organizerTitle}>Group photos</Text>
            <Text style={styles.organizerSubtitle}>Group related photos into items, then save.</Text>
          </View>
          <TouchableOpacity style={styles.detailIconButton} onPress={onClose} disabled={isSaving} accessibilityLabel="Close organizer">
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.organizerContent, { paddingBottom: insets.bottom + 96 }]}>
          <View style={styles.organizerPool}>
            <View style={styles.organizerSectionHeader}>
              <View>
                <Text style={styles.organizerSectionTitle}>Unassigned</Text>
                <Text style={styles.organizerSectionMeta}>{unassignedIds.length} photo{unassignedIds.length === 1 ? '' : 's'}</Text>
              </View>
              <TouchableOpacity
                style={[styles.organizerMakeButton, selectedIds.size === 0 && styles.organizerMakeButtonDisabled]}
                onPress={makeItem}
                disabled={selectedIds.size === 0 || isSaving}
              >
                <Ionicons name="albums-outline" size={16} color={colors.primaryForeground} />
                <Text style={styles.organizerMakeText}>Create item</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.organizerGrid}>
              {unassignedIds.map((snapId) => renderPhoto(snapId, true))}
            </View>
          </View>

          {stages.map((stage, index) => (
            <View key={stage.id} style={styles.organizerPool}>
              <View style={styles.organizerSectionHeader}>
                <View>
                  <Text style={styles.organizerSectionTitle}>Item {index + 1}</Text>
                  <Text style={styles.organizerSectionMeta}>
                    {stage.snapIds.length} photo{stage.snapIds.length === 1 ? '' : 's'}
                    {stagePrice(snapsWithStagedRoles, stage.snapIds)
                      ? ` · ${stagePrice(snapsWithStagedRoles, stage.snapIds)}`
                      : ''}
                  </Text>
                </View>
                <TouchableOpacity style={styles.organizerUndoButton} onPress={() => undoStage(stage.id)} disabled={isSaving}>
                  <Ionicons name="return-up-back-outline" size={17} color={colors.primary} />
                  <Text style={styles.organizerUndoText}>Undo</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.organizerGrid}>
                {stage.snapIds.map((snapId) => renderPhoto(snapId, false))}
              </View>
            </View>
          ))}

          {saveError ? (
            <View style={styles.organizerError}>
              <Ionicons name="alert-circle-outline" size={17} color={colors.error} />
              <Text selectable style={styles.organizerErrorText}>{saveError}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.organizerSaveBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity style={styles.organizerCancelButton} onPress={onClose} disabled={isSaving}>
            <Text style={styles.organizerCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.organizerSaveButton, !canSave && styles.organizerSaveButtonDisabled]}
            onPress={save}
            disabled={!canSave}
          >
            {isSaving ? <ActivityIndicator color={colors.primaryForeground} /> : <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />}
            <Text style={styles.organizerSaveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ShoppingSnapDetail({
  snap,
  relatedSnaps,
  onSelect,
  onDelete,
  onOrganize,
  isDeleting,
  onClose,
}: {
  snap: ShoppingSnap | null;
  relatedSnaps: ShoppingSnap[];
  onSelect: (snap: ShoppingSnap) => void;
  onDelete: (snap: ShoppingSnap) => void;
  onOrganize: () => void;
  isDeleting: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const detailPhotoWidth = width - spacing.lg * 2;
  const detailPhotoHeight = Math.min(width * 1.12, 540);
  const detailPhotoScrollRef = useRef<ScrollView>(null);
  const [ocrExpanded, setOcrExpanded] = useState(false);
  const [activeDetailPhotoIndex, setActiveDetailPhotoIndex] = useState(0);
  const itemPrice = relatedSnaps.find((related) => related.extractedPrice !== null)?.extractedPrice ?? snap?.extractedPrice ?? null;
  const formattedPrice = priceLabel(itemPrice);
  const itemPhotoCount = relatedSnaps.length || (snap ? 1 : 0);
  const tagCount = relatedSnaps.filter((related) => related.captureRole === 'tag').length;
  const itemSyncStatus = relatedSnaps.some((related) => related.syncStatus === 'pending') ? 'pending' : snap?.syncStatus;
  const itemOcrText = relatedSnaps
    .map((related) => related.rawOcrText.trim())
    .filter(Boolean)
    .join('\n\n');
  const fullLocationLabel = snap ? formatShoppingDetailLocation(snap) : 'Location not set';
  const canOrganize = relatedSnaps.length > 1 || relatedSnaps.some((related) => related.captureRole === 'unknown');
  const detailPhotos = useMemo(
    () => (relatedSnaps.length > 0 ? relatedSnaps : snap ? [snap] : []),
    [relatedSnaps, snap],
  );

  useEffect(() => {
    setOcrExpanded(false);
  }, [snap?.id]);

  useEffect(() => {
    if (!snap) return;
    const snapIndex = detailPhotos.findIndex((photo) => photo.id === snap.id);
    const nextIndex = Math.max(0, snapIndex);
    setActiveDetailPhotoIndex(nextIndex);
    requestAnimationFrame(() => {
      detailPhotoScrollRef.current?.scrollTo({ x: nextIndex * detailPhotoWidth, animated: false });
    });
  }, [detailPhotoWidth, detailPhotos, snap]);

  const openMap = useCallback(() => {
    if (!snap || snap.latitude === null || snap.longitude === null) return;
    void Linking.openURL(
      `https://maps.apple.com/?q=${encodeURIComponent(`${snap.latitude},${snap.longitude}`)}`,
    );
  }, [snap]);

  return (
    <Modal visible={snap !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {snap ? (
        <View style={[styles.detailRoot, { paddingTop: insets.top }]}> 
          <View style={styles.detailHeader}>
            <View>
              <Text style={styles.detailEyebrow}>SHOPPING SNAP</Text>
              <Text style={styles.detailTitle}>{snap.storeName ?? 'Store not set'}</Text>
              <Text style={styles.detailLocation} numberOfLines={1}>{fullLocationLabel}</Text>
            </View>
            <View style={styles.detailActions}>
              {canOrganize ? (
                <TouchableOpacity
                  style={styles.detailOrganizeButton}
                  onPress={onOrganize}
                  accessibilityLabel="Organize shopping photos"
                >
                  <Ionicons name="albums-outline" size={18} color={colors.foreground} />
                  <Text style={styles.detailOrganizeText}>Organize</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.detailIconButton, styles.detailDelete, isDeleting && styles.detailIconButtonDisabled]}
                onPress={() => onDelete(snap)}
                disabled={isDeleting}
                accessibilityLabel="Delete shopping photo"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.detailIconButton} onPress={onClose} accessibilityLabel="Close photo details">
                <Ionicons name="close" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={[styles.detailImageCarousel, { height: detailPhotoHeight }]}>
              <ScrollView
                ref={detailPhotoScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(event) => {
                  const page = Math.round(event.nativeEvent.contentOffset.x / detailPhotoWidth);
                  const nextIndex = Math.max(0, Math.min(page, detailPhotos.length - 1));
                  setActiveDetailPhotoIndex(nextIndex);
                  const nextSnap = detailPhotos[nextIndex];
                  if (nextSnap && nextSnap.id !== snap.id) onSelect(nextSnap);
                }}
              >
                {detailPhotos.map((photo) => (
                  <Image
                    key={photo.id}
                    source={{ uri: photo.imageUri }}
                    style={{ width: detailPhotoWidth, height: detailPhotoHeight }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={photo.id}
                    transition={180}
                  />
                ))}
              </ScrollView>
              {detailPhotos.length > 1 ? (
                <View style={styles.detailPhotoDots} accessibilityLabel={`Photo ${activeDetailPhotoIndex + 1} of ${detailPhotos.length}`}>
                  {detailPhotos.map((photo, index) => (
                    <View key={photo.id} style={[styles.detailPhotoDot, index === activeDetailPhotoIndex && styles.detailPhotoDotActive]} />
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.detailMetaRow}>
              {formattedPrice ? <Text style={styles.detailPrice}>{formattedPrice}</Text> : <Text style={styles.detailPriceMuted}>Price not found</Text>}
              <View style={[styles.statusPill, itemSyncStatus === 'pending' && styles.statusPillPending]}>
                <Ionicons
                  name={itemSyncStatus === 'pending' ? 'cloud-upload-outline' : 'checkmark-circle-outline'}
                  size={14}
                  color={itemSyncStatus === 'pending' ? colors.primary : colors.success}
                />
                <Text style={[styles.statusPillText, itemSyncStatus === 'pending' && styles.statusPillTextPending]}>
                  {itemSyncStatus === 'pending' ? 'Saved locally' : 'Synced'}
                </Text>
              </View>
            </View>

            <View style={styles.detailInfoCard}>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Store</Text>
                <Text selectable style={styles.detailInfoValue}>{snap.storeName ?? 'Store not set'}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Captured</Text>
                <Text selectable style={styles.detailInfoValue}>
                  {new Date(snap.capturedAt).toLocaleString(undefined, {
                    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </Text>
              </View>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Photos</Text>
                <Text selectable style={styles.detailInfoValue}>
                  {itemPhotoCount} total{tagCount > 0 ? ` · ${tagCount} tag${tagCount === 1 ? '' : 's'}` : ''}
                </Text>
              </View>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Role</Text>
                <Text selectable style={styles.detailInfoValue}>
                  {snap.captureRole === 'tag' ? 'Tag photo' : snap.captureRole === 'garment' ? 'Garment photo' : 'Needs sorting'}
                </Text>
              </View>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Location</Text>
                <Text selectable style={styles.detailInfoValue}>{fullLocationLabel}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Location source</Text>
                <Text selectable style={styles.detailInfoValue}>
                  {snap.locationSource ? snap.locationSource.replace('_', ' ') : 'Not captured'}
                  {snap.locationAccuracyMeters !== null ? ` · ~${Math.round(snap.locationAccuracyMeters)} m` : ''}
                </Text>
              </View>
            </View>

            {relatedSnaps.length > 1 ? (
              <View style={styles.captureStackCard}>
                <View style={styles.captureStackHeading}>
                  <Text style={styles.captureStackTitle}>THIS ITEM</Text>
                  <Text style={styles.captureStackCount}>{relatedSnaps.length} photos</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.captureStackRow}
                >
                  {relatedSnaps.map((related) => (
                    <TouchableOpacity
                      key={related.id}
                      style={[
                        styles.captureStackThumb,
                        related.id === snap.id && styles.captureStackThumbActive,
                      ]}
                      onPress={() => onSelect(related)}
                      accessibilityLabel={`View ${related.captureRole} photo in this item`}
                    >
                      <Image source={{ uri: related.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      {related.captureRole === 'tag' ? (
                        <View style={styles.stackTagBadge}>
                          <Text style={styles.stackTagBadgeText}>TAG</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {snap.latitude !== null && snap.longitude !== null ? (
              <TouchableOpacity style={styles.mapButton} onPress={openMap}>
                <Ionicons name="location-outline" size={17} color={colors.primary} />
                <View style={styles.mapButtonCopy}>
                  <Text style={styles.mapButtonText}>View store location</Text>
                  {snap.locationAccuracyMeters !== null ? (
                    <Text style={styles.mapButtonSubtext}>
                      Accurate to about {Math.round(snap.locationAccuracyMeters)} m
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}

            {itemOcrText ? (
              <View style={styles.ocrCard}>
                <TouchableOpacity
                  style={styles.ocrToggle}
                  onPress={() => setOcrExpanded((expanded) => !expanded)}
                  accessibilityLabel={ocrExpanded ? 'Hide text found on device' : 'Show text found on device'}
                >
                  <Text style={styles.ocrLabel}>TEXT FOUND ON DEVICE</Text>
                  <Ionicons
                    name={ocrExpanded ? 'chevron-up' : 'chevron-down'}
                    size={17}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
                {ocrExpanded ? <Text selectable style={styles.ocrText}>{itemOcrText}</Text> : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

function ShoppingEditCard({
  item,
  width,
  isSelected,
  selectionMode,
  onPress,
  onLongPress,
}: {
  item: ShoppingEditItem;
  width: number;
  isSelected: boolean;
  selectionMode: boolean;
  onPress: (snap: ShoppingSnap) => void;
  onLongPress: () => void;
}) {
  const price = priceLabel(item.extractedPrice);
  const statusLabel = itemStatusLabel(item);

  return (
    <TouchableOpacity
      style={[styles.photoCard, { width }, isSelected && styles.photoCardSelected]}
      activeOpacity={0.9}
      onPress={() => onPress(item.primarySnap)}
      onLongPress={onLongPress}
      accessibilityLabel={`${item.storeName ?? 'Shopping'} item${price ? `, ${price}` : ''}${item.needsReview ? ', needs review' : ''}`}
      accessibilityState={{ selected: isSelected }}
    >
      <Image
        source={{ uri: item.primarySnap.imageUri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={item.primarySnap.id}
        transition={160}
      />
      <LinearGradient
        colors={['transparent', 'rgba(20, 15, 12, 0.68)']}
        style={StyleSheet.absoluteFill}
        locations={[0.48, 1]}
      />
      {price ? (
        <View style={[styles.priceBadge, selectionMode && styles.priceBadgeSelecting]}>
          <Text style={styles.priceBadgeText}>{price}</Text>
        </View>
      ) : null}
      {item.syncStatus === 'pending' ? (
        <View style={styles.pendingBadge}>
          <Ionicons name="cloud-upload-outline" size={13} color="#FFFFFF" />
        </View>
      ) : null}
      {item.needsReview ? (
        <View style={styles.reviewBadge}><Text style={styles.reviewBadgeText}>REVIEW</Text></View>
      ) : null}
      {item.tagSnaps.length > 0 ? (
        <View style={styles.itemThumbStack}>
          {item.tagSnaps.slice(0, 2).map((tagSnap) => (
            <Image
              key={tagSnap.id}
              source={{ uri: tagSnap.imageUri }}
              style={styles.itemTagThumb}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ))}
        </View>
      ) : null}
      {selectionMode ? (
        <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeActive]}>
          {isSelected ? <Ionicons name="checkmark" size={16} color={colors.primaryForeground} /> : null}
        </View>
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={styles.cardStore} numberOfLines={1}>{item.storeName ?? 'Store not set'}</Text>
        <Text style={styles.cardLocation} numberOfLines={2}>{itemPlaceLabel(item) ?? 'Location not set'}</Text>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardTime}>
            {item.photoCount} photo{item.photoCount === 1 ? '' : 's'}
          </Text>
          <Text style={styles.cardTime} numberOfLines={1}>{statusLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function ShoppingGalleryScreen({ navigation }: ShoppingGalleryScreenProps) {
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const organizerOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { data: remoteSnaps = [], isLoading, isRefetching, isError, refetch } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const removePendingUpload = useShoppingSessionStore((state) => state.removePendingUpload);
  const regroupPendingUploads = useShoppingSessionStore((state) => state.regroupPendingUploads);
  const [storeFilter, setStoreFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<ShoppingDateFilter>('all');
  const [syncFilter, setSyncFilter] = useState<ShoppingSyncFilter>('all');
  const [reviewFilter, setReviewFilter] = useState<ShoppingReviewFilter>('all');
  const [selectedSnap, setSelectedSnap] = useState<ShoppingSnap | null>(null);
  const [organizerSnaps, setOrganizerSnaps] = useState<ShoppingSnap[] | null>(null);
  const [deletingSnapId, setDeletingSnapId] = useState<string | null>(null);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [isDeletingSelection, setIsDeletingSelection] = useState(false);

  const allSnaps = useMemo(
    () => mergeShoppingSnaps(remoteSnaps, pendingUploads),
    [pendingUploads, remoteSnaps],
  );
  const allItems = useMemo(() => buildShoppingEditItems(allSnaps), [allSnaps]);
  const storeOptions = useMemo<StoreFilterOption[]>(() => {
    const byStore = new Map<string, ShoppingEditItem[]>();
    for (const item of allItems) {
      if (!item.storeName) continue;
      const key = normalizeStoreName(item.storeName);
      byStore.set(key, [...(byStore.get(key) ?? []), item]);
    }

    return [...byStore.entries()]
      .flatMap(([normalizedStore, items]) => {
        const firstStoreName = items[0].storeName ?? normalizedStore;
        const locationKeys = new Map<string, ShoppingEditItem>();
        for (const item of items) {
          locationKeys.set(shoppingFilterKey(item), item);
        }
        if (locationKeys.size <= 1) {
          return [{ value: `store:${normalizedStore}`, label: firstStoreName }];
        }
        return [...locationKeys.values()].map((item) => ({
          value: shoppingFilterKey(item),
          label: `${item.storeName ?? firstStoreName} · ${itemPlaceLabel(item) ?? 'Location not set'}`,
        }));
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allItems]);
  const summary = useMemo(() => summarizeShoppingEditItems(allItems), [allItems]);
  const filteredItems = useMemo(
    () => filterShoppingEditItems(allItems, storeFilter, dateFilter, syncFilter, reviewFilter),
    [allItems, dateFilter, reviewFilter, storeFilter, syncFilter],
  );
  const sections = useMemo(() => buildSections(filteredItems), [filteredItems]);
  const selectedGroupSnaps = useMemo(() => {
    if (!selectedSnap) return [];
    return allSnaps
      .filter((snap) => snap.captureGroupId === selectedSnap.captureGroupId)
      .sort((a, b) => a.captureSequence - b.captureSequence);
  }, [allSnaps, selectedSnap]);
  const selectedBulkSnaps = useMemo(
    () => allItems.filter((item) => selectedItemIds.has(item.id)).flatMap((item) => item.snaps),
    [allItems, selectedItemIds],
  );
  const cardWidth = (width - spacing.lg * 2 - spacing.sm) / 2;
  const pendingCount = pendingUploads.length;
  const activeFilterCount = Number(storeFilter !== 'all') + Number(dateFilter !== 'all') + Number(syncFilter !== 'all') + Number(reviewFilter !== 'all');

  useEffect(() => () => {
    if (organizerOpenTimerRef.current) clearTimeout(organizerOpenTimerRef.current);
  }, []);

  const deleteSnaps = useCallback(async (snaps: ShoppingSnap[]) => {
    if (snaps.length === 0) return;
    const syncedSnaps = snaps.filter((snap) => snap.syncStatus === 'synced');
    if (syncedSnaps.length > 0 && !user) {
      throw new Error('You need to be signed in to delete synced photos.');
    }

    if (syncedSnaps.length > 0 && user) {
      const { error: rowError } = await supabase
        .from('shopping_snaps')
        .delete()
        .eq('user_id', user.id)
        .in('id', syncedSnaps.map((snap) => snap.id));
      if (rowError) throw rowError;

      const storagePaths = syncedSnaps
        .map((snap) => snap.storagePath)
        .filter((path): path is string => Boolean(path));
      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(SHOPPING_BUCKET)
          .remove(storagePaths);
        if (storageError) {
          console.warn('Deleted shopping photo rows but could not remove every storage object', storageError);
        }
      }

      await queryClient.invalidateQueries({ queryKey: SHOPPING_SNAPS_QUERY_KEY });
    }

    for (const snap of snaps.filter((item) => item.syncStatus === 'pending')) {
      removePendingUpload(snap.id);
      try {
        const file = new File(snap.imageUri);
        if (file.exists) file.delete();
      } catch (fileError) {
        console.warn('Deleted pending shopping photo but could not remove local file', fileError);
      }
    }
  }, [removePendingUpload, user]);

  const deleteSnap = useCallback(async (snap: ShoppingSnap) => {
    setDeletingSnapId(snap.id);
    try {
      await deleteSnaps([snap]);
      setSelectedSnap(null);
    } catch (error) {
      Alert.alert(
        'Could not delete photo',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setDeletingSnapId(null);
    }
  }, [deleteSnaps]);

  const confirmDeleteSnap = useCallback((snap: ShoppingSnap) => {
    Alert.alert('Delete this photo?', 'This shopping photo will be removed from your edit.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteSnap(snap) },
    ]);
  }, [deleteSnap]);

  const openOrganizer = useCallback(() => {
    const snapsToOrganize = selectedGroupSnaps;
    if (snapsToOrganize.length === 0) return;
    setSelectedSnap(null);
    if (organizerOpenTimerRef.current) clearTimeout(organizerOpenTimerRef.current);
    organizerOpenTimerRef.current = setTimeout(() => {
      setOrganizerSnaps(snapsToOrganize);
      organizerOpenTimerRef.current = null;
    }, 450);
  }, [selectedGroupSnaps]);

  const saveOrganization = useCallback(async (updates: ShoppingSnapOrganizationUpdate[]) => {
    if (updates.length === 0) return;
    const snapById = new Map(allSnaps.map((snap) => [snap.id, snap]));
    const syncedUpdates = updates.filter((update) => snapById.get(update.snapId)?.syncStatus === 'synced');
    const pendingUpdates = updates.filter((update) => snapById.get(update.snapId)?.syncStatus === 'pending');

    setIsSavingOrganization(true);
    try {
      if (syncedUpdates.length > 0) {
        if (!user) throw new Error('You need to be signed in to organize synced photos.');

        const groupPayloads = [...new Map(syncedUpdates.map((update) => {
          const snap = snapById.get(update.snapId);
          return [update.captureGroupId, {
            id: update.captureGroupId,
            user_id: user.id,
            shopping_session_id: snap?.shoppingSessionId ?? null,
            started_at: new Date(update.captureGroupStartedAt).toISOString(),
          }];
        })).values()];
        const { error: groupError } = await supabase
          .from('shopping_capture_groups')
          .upsert(groupPayloads, { onConflict: 'id' });
        if (groupError) throw groupError;

        for (const update of syncedUpdates) {
          const { error: rowError } = await supabase
            .from('shopping_snaps')
            .update({
              capture_group_id: update.captureGroupId,
              capture_role: update.captureRole,
              capture_sequence: update.captureSequence,
            })
            .eq('user_id', user.id)
            .eq('id', update.snapId);
          if (rowError) throw rowError;
        }
      }

      if (pendingUpdates.length > 0) {
        regroupPendingUploads(pendingUpdates);
      }
      if (syncedUpdates.length > 0) {
        await queryClient.invalidateQueries({ queryKey: SHOPPING_SNAPS_QUERY_KEY });
      }
      setOrganizerSnaps(null);
      setSelectedSnap(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsSavingOrganization(false);
    }
  }, [allSnaps, regroupPendingUploads, user]);

  const toggleSelectItem = useCallback((itemId: string) => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const startSelection = useCallback((itemId?: string) => {
    setSelectionMode(true);
    if (itemId) {
      setSelectedItemIds((current) => {
        const next = new Set(current);
        next.add(itemId);
        return next;
      });
    }
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedItemIds(new Set());
  }, []);

  const confirmDeleteSelection = useCallback(() => {
    if (selectedBulkSnaps.length === 0) return;
    const itemCount = selectedItemIds.size;
    const count = selectedBulkSnaps.length;
    Alert.alert(
      `Delete ${itemCount} item${itemCount === 1 ? '' : 's'}?`,
      `${count} shopping photo${count === 1 ? '' : 's'} will be removed from your edit.`,
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
                setSelectedSnap(null);
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

  const renderCard = useCallback((item: ShoppingEditItem) => (
    <ShoppingEditCard
      key={item.id}
      item={item}
      width={cardWidth}
      isSelected={selectedItemIds.has(item.id)}
      selectionMode={selectionMode}
      onPress={(snap) => {
        if (selectionMode) toggleSelectItem(item.id);
        else setSelectedSnap(snap);
      }}
      onLongPress={() => startSelection(item.id)}
    />
  ), [cardWidth, selectedItemIds, selectionMode, startSelection, toggleSelectItem]);

  const listHeader = (
    <View>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.goBack()} accessibilityLabel="Back">
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

        <Text style={styles.eyebrow}>THE SHOPPING EDIT</Text>
        <Text style={styles.heroTitle}>Your finds, beautifully kept.</Text>
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
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{summary.itemCount}</Text>
            <Text style={styles.metricLabel}>Items</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{summary.storeCount}</Text>
            <Text style={styles.metricLabel}>Stores</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={[styles.metricValue, summary.missingPricePhotoCount > 0 && styles.metricValueWarn]}>
              {summary.missingPricePhotoCount}
            </Text>
            <Text style={styles.metricLabel}>No price</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={[styles.metricValue, summary.pendingPhotoCount > 0 && styles.metricValueWarn]}>
              {summary.pendingPhotoCount}
            </Text>
            <Text style={styles.metricLabel}>Pending</Text>
          </View>
        </View>
      </View>

      <View style={styles.storeFilterBlock}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeChipRow}>
          <TouchableOpacity
            style={[styles.storeFilterChip, storeFilter === 'all' && styles.storeFilterChipActive]}
            onPress={() => setStoreFilter('all')}
          >
            <Text style={[styles.storeFilterText, storeFilter === 'all' && styles.storeFilterTextActive]}>All stores</Text>
          </TouchableOpacity>
          {storeOptions.map((store) => (
            <TouchableOpacity
              key={store.value}
              style={[styles.storeFilterChip, storeFilter === store.value && styles.storeFilterChipActive]}
              onPress={() => setStoreFilter(store.value)}
            >
              <Text style={[styles.storeFilterText, storeFilter === store.value && styles.storeFilterTextActive]}>{store.label}</Text>
            </TouchableOpacity>
          ))}
          {allSnaps.some((snap) => !snap.storeName) ? (
            <TouchableOpacity
              style={[styles.storeFilterChip, storeFilter === 'none' && styles.storeFilterChipActive]}
              onPress={() => setStoreFilter('none')}
            >
              <Text style={[styles.storeFilterText, storeFilter === 'none' && styles.storeFilterTextActive]}>Store not set</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
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
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.map((item) => item.id).join(':')}
        renderItem={({ item: row }) => (
          <View style={styles.photoRow}>
            {row.map(renderCard)}
            {row.length === 1 ? <View style={{ width: cardWidth }} /> : null}
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionDate}>{section.dateLabel}</Text>
              <Text style={styles.sectionStore} numberOfLines={1}>{section.storeName}</Text>
              {section.placeLabel ? (
                <Text style={styles.sectionLocation} numberOfLines={2}>{section.placeLabel}</Text>
              ) : null}
            </View>
            <View style={styles.sectionStats}>
              <Text style={styles.sectionStatText}>
                {section.itemCount} item{section.itemCount === 1 ? '' : 's'} · {section.photoCount} photo{section.photoCount === 1 ? '' : 's'}
              </Text>
              {section.knownSpend !== null ? (
                <Text style={styles.sectionSpend}>{priceLabel(section.knownSpend)}</Text>
              ) : null}
            </View>
          </View>
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={isLoading ? (
          <View style={styles.emptyState}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyMonogram}><Ionicons name="images-outline" size={34} color={colors.primary} /></View>
            <Text style={styles.emptyTitle}>{allItems.length ? 'No items match' : 'Your shopping edit starts here'}</Text>
            <Text style={styles.emptyText}>
              {allItems.length ? 'Try clearing a filter to see more finds.' : 'Capture pieces and price tags while you shop, or import them from your camera roll.'}
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
          sections.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
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
        snapPoints={['58%']}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        backgroundStyle={styles.filterSheetBackground}
        handleIndicatorStyle={styles.filterSheetHandle}
      >
        <BottomSheetView style={styles.filterSheetContent}>
          <Text style={styles.filterSheetTitle}>Refine your edit</Text>
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
                onPress={() => setReviewFilter(option.value)}
              >
                <Text style={[styles.optionText, reviewFilter === option.value && styles.optionTextActive]}>{option.label}</Text>
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

      <ShoppingSnapDetail
        snap={selectedSnap}
        relatedSnaps={selectedGroupSnaps}
        onSelect={setSelectedSnap}
        onDelete={confirmDeleteSnap}
        onOrganize={openOrganizer}
        isDeleting={selectedSnap ? deletingSnapId === selectedSnap.id : false}
        onClose={() => setSelectedSnap(null)}
      />

      <ShoppingSnapOrganizerModal
        visible={organizerSnaps !== null}
        snaps={organizerSnaps ?? []}
        onClose={() => {
          if (!isSavingOrganization) setOrganizerSnaps(null);
        }}
        onSave={saveOrganization}
        isSaving={isSavingOrganization}
      />
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
  storeFilterBlock: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  storeChipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  storeFilterChip: { height: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  storeFilterChipActive: { borderColor: colors.foreground, backgroundColor: colors.foreground },
  storeFilterText: { fontSize: typography.size.sm, color: colors.secondaryForeground },
  storeFilterTextActive: { fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  remoteError: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.accent },
  remoteErrorText: { flex: 1, fontSize: typography.size.xs, color: colors.secondaryForeground },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  sectionHeaderCopy: { flex: 1 },
  sectionDate: { fontFamily: typography.family.display, fontSize: typography.size.xl, color: colors.foreground },
  sectionStore: { paddingTop: spacing.xs, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },
  sectionLocation: { paddingTop: 1, fontSize: typography.size.xs, lineHeight: 17, color: colors.mutedForeground },
  sectionStats: { alignItems: 'flex-end', gap: 2, paddingTop: 4 },
  sectionStatText: { fontSize: 10, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  sectionSpend: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.foreground, fontVariant: ['tabular-nums'] },
  photoRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  photoCard: { aspectRatio: 0.76, overflow: 'hidden', borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: colors.surfaceSubtle, ...shadows.sm },
  photoCardSelected: { borderWidth: 3, borderColor: colors.primary },
  priceBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.full, backgroundColor: 'rgba(250, 248, 245, 0.94)' },
  priceBadgeSelecting: { top: 46 },
  priceBadgeText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.foreground, fontVariant: ['tabular-nums'] },
  pendingBadge: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(149, 109, 81, 0.92)' },
  reviewBadge: { position: 'absolute', top: 46, right: spacing.sm, paddingHorizontal: 7, paddingVertical: 4, borderRadius: radii.full, backgroundColor: 'rgba(24, 20, 18, 0.78)' },
  reviewBadgeText: { fontSize: 9, fontWeight: typography.weight.bold, letterSpacing: 0.8, color: '#FFFFFF' },
  itemThumbStack: { position: 'absolute', left: spacing.sm, bottom: 64, flexDirection: 'row', gap: 4 },
  itemTagThumb: { width: 36, height: 44, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.72)', borderRadius: 8, backgroundColor: colors.surfaceSubtle },
  selectionBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 15, backgroundColor: 'rgba(24, 20, 18, 0.42)' },
  selectionBadgeActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  cardFooter: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
  cardStore: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: '#FFFFFF' },
  cardLocation: { paddingTop: 1, fontSize: 10, lineHeight: 13, fontWeight: typography.weight.medium, color: 'rgba(255,255,255,0.78)' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingTop: 2 },
  cardTime: { paddingTop: 2, fontSize: 11, color: 'rgba(255,255,255,0.76)', fontVariant: ['tabular-nums'] },
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
  organizerRoot: { flex: 1, backgroundColor: colors.background },
  organizerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  organizerHeaderCopy: { flex: 1 },
  organizerTitle: { paddingTop: 2, fontFamily: typography.family.display, fontSize: typography.size.xxl, color: colors.foreground },
  organizerSubtitle: { paddingTop: 2, fontSize: typography.size.sm, color: colors.mutedForeground },
  organizerContent: { gap: spacing.md, padding: spacing.lg },
  organizerPool: { gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.card },
  organizerSectionHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  organizerSectionTitle: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.foreground },
  organizerSectionMeta: { paddingTop: 2, fontSize: typography.size.xs, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  organizerMakeButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary },
  organizerMakeButtonDisabled: { opacity: 0.45 },
  organizerMakeText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  organizerUndoButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.md, backgroundColor: colors.accent },
  organizerUndoText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primary },
  organizerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  organizerPhotoWrap: { width: 92, gap: spacing.xs },
  organizerPhoto: { width: 92, height: 112, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  organizerPhotoSelected: { borderColor: colors.primary },
  organizerCheck: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  organizerRoleChip: { minHeight: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderRadius: radii.full, backgroundColor: colors.surfaceElevated },
  organizerRoleText: { fontSize: 10, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  organizerError: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: '#FBEDEA' },
  organizerErrorText: { flex: 1, fontSize: typography.size.sm, lineHeight: 20, color: colors.error },
  organizerSaveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
  organizerCancelButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  organizerCancelText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  organizerSaveButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.md, backgroundColor: colors.primary },
  organizerSaveButtonDisabled: { opacity: 0.45 },
  organizerSaveText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  detailRoot: { flex: 1, backgroundColor: colors.background },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  detailEyebrow: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1.5, color: colors.primary },
  detailTitle: { paddingTop: 2, fontFamily: typography.family.display, fontSize: typography.size.xl, color: colors.foreground },
  detailLocation: { paddingTop: 2, maxWidth: 280, fontSize: typography.size.xs, color: colors.mutedForeground },
  detailActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailIconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surfaceSubtle },
  detailOrganizeButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 20, backgroundColor: colors.surfaceSubtle },
  detailOrganizeText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.foreground },
  detailDelete: { backgroundColor: '#FBEDEA' },
  detailIconButtonDisabled: { opacity: 0.6 },
  detailContent: { gap: spacing.md, paddingHorizontal: spacing.lg },
  detailImageCarousel: { width: '100%', overflow: 'hidden', borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceSubtle },
  detailPhotoDots: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, minHeight: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  detailPhotoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.58)' },
  detailPhotoDotActive: { width: 18, backgroundColor: '#FFFFFF' },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  detailPrice: { fontFamily: typography.family.display, fontSize: typography.size.xxl, color: colors.foreground, fontVariant: ['tabular-nums'] },
  detailPriceMuted: { fontSize: typography.size.sm, color: colors.mutedForeground },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.full, backgroundColor: '#E6F1E9' },
  statusPillPending: { backgroundColor: colors.accent },
  statusPillText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.success },
  statusPillTextPending: { color: colors.primary },
  detailInfoCard: { gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.card },
  detailInfoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  detailInfoLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  detailInfoValue: { flex: 1, fontSize: typography.size.sm, textAlign: 'right', color: colors.foreground },
  captureStackCard: { gap: spacing.sm, paddingVertical: spacing.sm },
  captureStackHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  captureStackTitle: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1.4, color: colors.primary },
  captureStackCount: { fontSize: typography.size.xs, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  captureStackRow: { gap: spacing.sm, paddingRight: spacing.lg },
  captureStackThumb: { width: 72, height: 88, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  captureStackThumbActive: { borderColor: colors.primary },
  stackTagBadge: { position: 'absolute', right: 5, bottom: 5, paddingHorizontal: 5, paddingVertical: 3, borderRadius: radii.full, backgroundColor: 'rgba(24, 20, 18, 0.76)' },
  stackTagBadgeText: { fontSize: 8, fontWeight: typography.weight.bold, letterSpacing: 0.6, color: '#FFFFFF' },
  mapButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceElevated },
  mapButtonCopy: { flex: 1, paddingVertical: spacing.sm },
  mapButtonText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.foreground },
  mapButtonSubtext: { paddingTop: 1, fontSize: 10, color: colors.mutedForeground },
  ocrCard: { gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.card },
  ocrToggle: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  ocrLabel: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1.4, color: colors.primary },
  ocrText: { fontSize: typography.size.sm, lineHeight: 21, color: colors.secondaryForeground },
});
