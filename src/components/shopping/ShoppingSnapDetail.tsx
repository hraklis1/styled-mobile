import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  formatShoppingPrice,
  garmentFriendlyContentFit,
  shoppingCatalogChips,
  shoppingCatalogStatusLabel,
  SHOPPING_CATALOG_STATUS_OPTIONS,
  snapRoleLabel,
} from '../../lib/shoppingPresentation';
import { formatShoppingDetailLocation } from '../../lib/shoppingLocations';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingFindCatalog, ShoppingFindCatalogPatch, ShoppingFindCatalogStatus, ShoppingSnap } from '../../types/shoppingSnap';

export function ShoppingSnapDetail({
  snap,
  relatedSnaps,
  onSelect,
  onDelete,
  onOrganize,
  onSaveCatalog,
  isDeleting,
  isSavingCatalog,
  onClose,
}: {
  snap: ShoppingSnap | null;
  relatedSnaps: ShoppingSnap[];
  onSelect: (snap: ShoppingSnap) => void;
  onDelete: (snap: ShoppingSnap) => void;
  onOrganize: () => void;
  onSaveCatalog: (captureGroupId: string, patch: ShoppingFindCatalogPatch) => Promise<void>;
  isDeleting: boolean;
  isSavingCatalog: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const detailPhotoWidth = width - spacing.lg * 2;
  const detailPhotoHeight = Math.min(width * 1.08, 520);
  const detailPhotoScrollRef = useRef<ScrollView>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [smartExpanded, setSmartExpanded] = useState(false);
  const [catalogEditing, setCatalogEditing] = useState(false);
  const [catalogDraft, setCatalogDraft] = useState<ShoppingFindCatalog>(() => emptyCatalog());
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [activeDetailPhotoIndex, setActiveDetailPhotoIndex] = useState(0);
  const itemPrice = relatedSnaps.find((related) => related.extractedPrice !== null)?.extractedPrice ?? snap?.extractedPrice ?? null;
  const formattedPrice = formatShoppingPrice(itemPrice);
  const itemPhotoCount = relatedSnaps.length || (snap ? 1 : 0);
  const tagCount = relatedSnaps.filter((related) => related.captureRole === 'tag').length;
  const itemSyncStatus = relatedSnaps.some((related) => related.syncStatus === 'pending') ? 'pending' : snap?.syncStatus;
  const itemOcrText = relatedSnaps
    .map((related) => related.rawOcrText.trim())
    .filter(Boolean)
    .join('\n\n');
  const fullLocationLabel = snap ? formatShoppingDetailLocation(snap) : 'Location not set';
  const canOrganize = relatedSnaps.length > 1 || relatedSnaps.some((related) => related.captureRole === 'unknown');
  const catalog = snap ? catalogFromSnap(snap) : emptyCatalog();
  const catalogChips = shoppingCatalogChips(catalog);
  const detailPhotos = useMemo(
    () => (relatedSnaps.length > 0 ? relatedSnaps : snap ? [snap] : []),
    [relatedSnaps, snap],
  );

  useEffect(() => {
    setDetailsExpanded(false);
    setSmartExpanded(false);
    setCatalogEditing(false);
    setCatalogError(null);
    setCatalogDraft(snap ? catalogFromSnap(snap) : emptyCatalog());
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
    void Haptics.selectionAsync();
    void Linking.openURL(
      `https://maps.apple.com/?q=${encodeURIComponent(`${snap.latitude},${snap.longitude}`)}`,
    );
  }, [snap]);

  const saveCatalog = useCallback(() => {
    if (!snap) return;
    const patch = cleanCatalogPatch(catalogDraft);
    setCatalogError(null);
    void onSaveCatalog(snap.captureGroupId, patch)
      .then(() => {
        setCatalogEditing(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch((error) => {
        setCatalogError(error instanceof Error ? error.message : 'Please try again.');
      });
  }, [catalogDraft, onSaveCatalog, snap]);

  return (
    <Modal visible={snap !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {snap ? (
        <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>SHOPPING FIND</Text>
              <Text style={styles.title}>{snap.storeName ?? 'Store not set'}</Text>
              <Text style={styles.location} numberOfLines={1}>{fullLocationLabel}</Text>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={onClose} accessibilityLabel="Close item details">
              <Ionicons name="close" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={[styles.imageCarousel, { height: detailPhotoHeight }]}>
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
                  <View key={photo.id} style={[styles.imagePage, { width: detailPhotoWidth, height: detailPhotoHeight }]}>
                    <Image
                      source={{ uri: photo.imageUri }}
                      style={StyleSheet.absoluteFill}
                      contentFit={garmentFriendlyContentFit(photo)}
                      contentPosition="center"
                      cachePolicy="memory-disk"
                      recyclingKey={photo.id}
                      transition={240}
                    />
                    <View style={styles.rolePill}>
                      <Text style={styles.rolePillText}>{snapRoleLabel(photo.captureRole)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              {detailPhotos.length > 1 ? (
                <View style={styles.photoDots} accessibilityLabel={`Photo ${activeDetailPhotoIndex + 1} of ${detailPhotos.length}`}>
                  {detailPhotos.map((photo, index) => (
                    <View key={photo.id} style={[styles.photoDot, index === activeDetailPhotoIndex && styles.photoDotActive]} />
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.priceBlock}>
                {formattedPrice ? <Text style={styles.price}>{formattedPrice}</Text> : <Text style={styles.priceMuted}>Price not found</Text>}
                <Text style={styles.priceSubtext}>
                  {itemPhotoCount} photo{itemPhotoCount === 1 ? '' : 's'}{tagCount > 0 ? ` · ${tagCount} tag${tagCount === 1 ? '' : 's'}` : ''}
                </Text>
              </View>
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

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, catalogEditing && styles.actionButtonActive]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setCatalogDraft(catalog);
                  setCatalogEditing((editing) => !editing);
                  setCatalogError(null);
                }}
                accessibilityLabel={catalogEditing ? 'Cancel catalog editing' : 'Edit catalog details'}
              >
                <Ionicons name={catalogEditing ? 'close-circle-outline' : 'pricetags-outline'} size={18} color={colors.foreground} />
                <Text style={styles.actionText}>{catalogEditing ? 'Cancel edit' : 'Catalog'}</Text>
              </TouchableOpacity>
              {canOrganize ? (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onOrganize();
                  }}
                  accessibilityLabel="Organize shopping photos"
                >
                  <Ionicons name="albums-outline" size={18} color={colors.foreground} />
                  <Text style={styles.actionText}>Organize</Text>
                </TouchableOpacity>
              ) : null}
              {snap.latitude !== null && snap.longitude !== null ? (
                <TouchableOpacity style={styles.actionButton} onPress={openMap}>
                  <Ionicons name="location-outline" size={18} color={colors.foreground} />
                  <Text style={styles.actionText}>Location</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton, isDeleting && styles.actionButtonDisabled]}
                onPress={() => onDelete(snap)}
                disabled={isDeleting}
                accessibilityLabel="Delete shopping photo"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                )}
                <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.catalogCard}>
              <View style={styles.catalogHeader}>
                <View>
                  <Text style={styles.sectionTitle}>CATALOG</Text>
                  <Text style={styles.catalogStatusText}>
                    {catalog.isFavorite ? 'Favorite · ' : ''}{shoppingCatalogStatusLabel(catalog.catalogStatus)}
                  </Text>
                </View>
                {!catalogEditing ? (
                  <TouchableOpacity
                    style={styles.catalogEditButton}
                    onPress={() => {
                      setCatalogDraft(catalog);
                      setCatalogEditing(true);
                      setCatalogError(null);
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.primary} />
                    <Text style={styles.catalogEditText}>Edit</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {catalogEditing ? (
                <View style={styles.catalogForm}>
                  <View style={styles.statusGrid}>
                    {SHOPPING_CATALOG_STATUS_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.statusOption, catalogDraft.catalogStatus === option.value && styles.statusOptionActive]}
                        onPress={() => setCatalogDraft((current) => ({ ...current, catalogStatus: option.value }))}
                      >
                        <Text style={[styles.statusOptionText, catalogDraft.catalogStatus === option.value && styles.statusOptionTextActive]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.favoriteToggle, catalogDraft.isFavorite && styles.favoriteToggleActive]}
                    onPress={() => setCatalogDraft((current) => ({ ...current, isFavorite: !current.isFavorite }))}
                  >
                    <Ionicons name={catalogDraft.isFavorite ? 'heart' : 'heart-outline'} size={18} color={catalogDraft.isFavorite ? colors.primaryForeground : colors.primary} />
                    <Text style={[styles.favoriteToggleText, catalogDraft.isFavorite && styles.favoriteToggleTextActive]}>
                      Favorite
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.catalogInputGrid}>
                    <CatalogInput label="Category" value={catalogDraft.category} onChange={(value) => setCatalogDraft((current) => ({ ...current, category: value }))} />
                    <CatalogInput label="Size" value={catalogDraft.sizeLabel} onChange={(value) => setCatalogDraft((current) => ({ ...current, sizeLabel: value }))} />
                    <CatalogInput label="Color" value={catalogDraft.colorLabel} onChange={(value) => setCatalogDraft((current) => ({ ...current, colorLabel: value }))} />
                    <CatalogInput label="Material" value={catalogDraft.materialLabel} onChange={(value) => setCatalogDraft((current) => ({ ...current, materialLabel: value }))} />
                  </View>
                  <View style={styles.notesField}>
                    <Text style={styles.inputLabel}>Notes</Text>
                    <TextInput
                      value={catalogDraft.notes ?? ''}
                      onChangeText={(value) => setCatalogDraft((current) => ({ ...current, notes: value }))}
                      placeholder="Fit, styling ideas, sale context..."
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                      textAlignVertical="top"
                      style={styles.notesInput}
                    />
                  </View>
                  {catalogError ? (
                    <Text selectable style={styles.catalogError}>{catalogError}</Text>
                  ) : null}
                  <View style={styles.catalogFormActions}>
                    <TouchableOpacity
                      style={styles.catalogCancelButton}
                      onPress={() => {
                        setCatalogDraft(catalog);
                        setCatalogEditing(false);
                        setCatalogError(null);
                      }}
                      disabled={isSavingCatalog}
                    >
                      <Text style={styles.catalogCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.catalogSaveButton, isSavingCatalog && styles.actionButtonDisabled]}
                      onPress={saveCatalog}
                      disabled={isSavingCatalog}
                    >
                      {isSavingCatalog ? (
                        <ActivityIndicator size="small" color={colors.primaryForeground} />
                      ) : (
                        <Ionicons name="checkmark" size={17} color={colors.primaryForeground} />
                      )}
                      <Text style={styles.catalogSaveText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.catalogRead}>
                  {catalogChips.length > 0 ? (
                    <View style={styles.catalogChipRow}>
                      {catalogChips.map((chip) => (
                        <View key={chip} style={styles.catalogChip}>
                          <Text style={styles.catalogChipText}>{chip}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.catalogEmpty}>Add category, size, color, material, and notes.</Text>
                  )}
                  {catalog.notes ? <Text selectable style={styles.catalogNotes}>{catalog.notes}</Text> : null}
                </View>
              )}
            </View>

            {relatedSnaps.length > 1 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>THIS ITEM</Text>
                  <Text style={styles.sectionCount}>{relatedSnaps.length} photos</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
                  {relatedSnaps.map((related) => (
                    <TouchableOpacity
                      key={related.id}
                      style={[styles.thumb, related.id === snap.id && styles.thumbActive]}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        onSelect(related);
                      }}
                      accessibilityLabel={`View ${snapRoleLabel(related.captureRole)} photo in this item`}
                    >
                      <Image source={{ uri: related.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
                      <View style={styles.thumbBadge}>
                        <Text style={styles.thumbBadgeText}>{snapRoleLabel(related.captureRole)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.disclosureCard}>
              <TouchableOpacity
                style={styles.disclosureToggle}
                onPress={() => setDetailsExpanded((expanded) => !expanded)}
                accessibilityLabel={detailsExpanded ? 'Hide capture details' : 'Show capture details'}
              >
                <Text style={styles.disclosureLabel}>CAPTURE DETAILS</Text>
                <Ionicons name={detailsExpanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
              </TouchableOpacity>
              {detailsExpanded ? (
                <View style={styles.detailInfoRows}>
                  <DetailInfo label="Store" value={snap.storeName ?? 'Store not set'} />
                  <DetailInfo
                    label="Captured"
                    value={new Date(snap.capturedAt).toLocaleString(undefined, {
                      month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  />
                  <DetailInfo label="Role" value={snap.captureRole === 'tag' ? 'Tag photo' : snap.captureRole === 'garment' ? 'Garment photo' : 'Needs sorting'} />
                  <DetailInfo label="Location" value={fullLocationLabel} />
                  <DetailInfo
                    label="Location source"
                    value={`${snap.locationSource ? snap.locationSource.replace('_', ' ') : 'Not captured'}${snap.locationAccuracyMeters !== null ? ` · ~${Math.round(snap.locationAccuracyMeters)} m` : ''}`}
                  />
                </View>
              ) : null}
            </View>

            {itemOcrText || formattedPrice ? (
              <View style={styles.disclosureCard}>
                <TouchableOpacity
                  style={styles.disclosureToggle}
                  onPress={() => setSmartExpanded((expanded) => !expanded)}
                  accessibilityLabel={smartExpanded ? 'Hide smart details' : 'Show smart details'}
                >
                  <View>
                    <Text style={styles.disclosureLabel}>SMART DETAILS</Text>
                    {formattedPrice ? <Text style={styles.smartHint}>Detected {formattedPrice}</Text> : null}
                  </View>
                  <Ionicons name={smartExpanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
                </TouchableOpacity>
                {smartExpanded ? (
                  <View style={styles.smartBody}>
                    {formattedPrice ? <DetailInfo label="Price" value={formattedPrice} /> : null}
                    {itemOcrText ? <Text selectable style={styles.ocrText}>{itemOcrText}</Text> : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

function DetailInfo({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailInfoRow}>
      <Text style={styles.detailInfoLabel}>{label}</Text>
      <Text selectable style={styles.detailInfoValue}>{value}</Text>
    </View>
  );
}

function CatalogInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.inputField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value ?? ''}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={colors.mutedForeground}
        style={styles.textInput}
      />
    </View>
  );
}

function emptyCatalog(): ShoppingFindCatalog {
  return {
    category: null,
    sizeLabel: null,
    colorLabel: null,
    materialLabel: null,
    notes: null,
    isFavorite: false,
    catalogStatus: 'considering',
  };
}

function catalogFromSnap(snap: ShoppingSnap): ShoppingFindCatalog {
  return {
    category: snap.category,
    sizeLabel: snap.sizeLabel,
    colorLabel: snap.colorLabel,
    materialLabel: snap.materialLabel,
    notes: snap.notes,
    isFavorite: snap.isFavorite,
    catalogStatus: snap.catalogStatus,
  };
}

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function cleanCatalogPatch(value: ShoppingFindCatalog): ShoppingFindCatalog {
  return {
    category: cleanText(value.category),
    sizeLabel: cleanText(value.sizeLabel),
    colorLabel: cleanText(value.colorLabel),
    materialLabel: cleanText(value.materialLabel),
    notes: cleanText(value.notes),
    isFavorite: value.isFavorite,
    catalogStatus: value.catalogStatus,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1.5, color: colors.primary },
  title: { paddingTop: 2, fontFamily: typography.family.display, fontSize: typography.size.xl, color: colors.foreground },
  location: { paddingTop: 2, fontSize: typography.size.xs, color: colors.mutedForeground },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surfaceSubtle },
  content: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  imageCarousel: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  imagePage: { backgroundColor: colors.surfaceSubtle },
  rolePill: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: 'rgba(250, 248, 245, 0.94)',
  },
  rolePillText: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 0.8, color: colors.foreground, textTransform: 'uppercase' },
  photoDots: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, minHeight: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.58)' },
  photoDotActive: { width: 18, backgroundColor: '#FFFFFF' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  priceBlock: { flex: 1 },
  price: { fontFamily: typography.family.display, fontSize: typography.size.xxl, color: colors.foreground, fontVariant: ['tabular-nums'] },
  priceMuted: { fontFamily: typography.family.display, fontSize: typography.size.xl, color: colors.mutedForeground },
  priceSubtext: { paddingTop: 2, fontSize: typography.size.xs, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.full, backgroundColor: '#E6F1E9' },
  statusPillPending: { backgroundColor: colors.accent },
  statusPillText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.success },
  statusPillTextPending: { color: colors.primary },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  actionButtonDisabled: { opacity: 0.6 },
  actionButtonActive: { backgroundColor: colors.accent },
  actionText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.foreground },
  deleteButton: { backgroundColor: '#FBEDEA' },
  deleteText: { color: colors.error },
  catalogCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated },
  catalogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  catalogStatusText: { paddingTop: 3, fontSize: typography.size.xs, color: colors.mutedForeground },
  catalogEditButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.full, backgroundColor: colors.accent },
  catalogEditText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primary },
  catalogRead: { gap: spacing.sm },
  catalogChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  catalogChip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
  catalogChipText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  catalogEmpty: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  catalogNotes: { fontSize: typography.size.sm, lineHeight: 20, color: colors.foreground },
  catalogForm: { gap: spacing.md },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusOption: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
  statusOptionActive: { backgroundColor: colors.foreground },
  statusOptionText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  statusOptionTextActive: { color: colors.primaryForeground },
  favoriteToggle: { alignSelf: 'flex-start', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.full, backgroundColor: colors.background },
  favoriteToggleActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  favoriteToggleText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primary },
  favoriteToggleTextActive: { color: colors.primaryForeground },
  catalogInputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inputField: { flexGrow: 1, flexBasis: '47%', gap: spacing.xs },
  inputLabel: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1, color: colors.mutedForeground, textTransform: 'uppercase' },
  textInput: { minHeight: 42, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, color: colors.foreground, backgroundColor: colors.background },
  notesField: { gap: spacing.xs },
  notesInput: { minHeight: 86, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, color: colors.foreground, backgroundColor: colors.background },
  catalogError: { fontSize: typography.size.xs, color: colors.error },
  catalogFormActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  catalogCancelButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  catalogCancelText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  catalogSaveButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radii.md, backgroundColor: colors.primary },
  catalogSaveText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  section: { gap: spacing.sm, paddingTop: spacing.sm },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1.4, color: colors.primary },
  sectionCount: { fontSize: typography.size.xs, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  thumbRow: { gap: spacing.sm, paddingRight: spacing.lg },
  thumb: { width: 76, height: 94, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  thumbActive: { borderColor: colors.primary },
  thumbBadge: { position: 'absolute', right: 5, bottom: 5, paddingHorizontal: 5, paddingVertical: 3, borderRadius: radii.full, backgroundColor: 'rgba(24, 20, 18, 0.76)' },
  thumbBadgeText: { fontSize: 8, fontWeight: typography.weight.bold, letterSpacing: 0.6, color: '#FFFFFF', textTransform: 'uppercase' },
  disclosureCard: { gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.card },
  disclosureToggle: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  disclosureLabel: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1.4, color: colors.primary },
  detailInfoRows: { gap: spacing.sm, paddingTop: spacing.xs },
  detailInfoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  detailInfoLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  detailInfoValue: { flex: 1, fontSize: typography.size.sm, textAlign: 'right', color: colors.foreground },
  smartHint: { paddingTop: 3, fontSize: typography.size.xs, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  smartBody: { gap: spacing.md, paddingTop: spacing.xs },
  ocrText: { fontSize: typography.size.sm, lineHeight: 21, color: colors.secondaryForeground },
});
