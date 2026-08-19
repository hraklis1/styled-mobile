import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShoppingSnapOrganizerModal } from './ShoppingSnapOrganizerModal';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { useShoppingItemActions } from '../../hooks/useShoppingItemActions';
import { formatShoppingDetailLocation } from '../../lib/shoppingLocations';
import {
  formatShoppingPrice,
  garmentFriendlyContentFit,
  itemRoleSummary,
  parseShoppingTagOcr,
  SHOPPING_CATALOG_STATUS_OPTIONS,
  shoppingItemBadges,
  snapRoleLabel,
} from '../../lib/shoppingPresentation';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingFindCatalog, ShoppingFindCatalogPatch } from '../../types/shoppingSnap';

function catalogFromItem(item: ShoppingEditItem): ShoppingFindCatalog {
  return {
    category: item.category,
    sizeLabel: item.sizeLabel,
    colorLabel: item.colorLabel,
    materialLabel: item.materialLabel,
    notes: item.notes,
    isFavorite: item.isFavorite,
    catalogStatus: item.catalogStatus,
  };
}

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function cleanCatalogPatch(value: ShoppingFindCatalog): ShoppingFindCatalogPatch {
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function CatalogField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.catalogField}>
      <Text style={styles.catalogFieldLabel}>{label}</Text>
      <TextInput
        value={value ?? ''}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={colors.mutedForeground}
        style={styles.catalogFieldInput}
      />
    </View>
  );
}

/**
 * The one immersive, editorial view of a shopping find — reached whether
 * you tap an item straight from the Shortlist or from a haul's full-screen
 * gallery. Catalog, Organize, Location, and Ask Stylist all live here now,
 * so there's no separate "edit mode" to hop into.
 */
export function ShoppingItemLightbox({
  item,
  onClose,
}: {
  item: ShoppingEditItem;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showFullTag, setShowFullTag] = useState(false);
  const [displayItem, setDisplayItem] = useState(item);
  const [catalogEditing, setCatalogEditing] = useState(false);
  const [catalogDraft, setCatalogDraft] = useState<ShoppingFindCatalog>(() => catalogFromItem(item));
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [organizerOpen, setOrganizerOpen] = useState(false);

  const {
    saveCatalog,
    isSavingCatalog,
    deleteItem,
    isDeleting,
    saveOrganization,
    isSavingOrganization,
    askStylistAboutItem,
  } = useShoppingItemActions();

  useEffect(() => {
    setDisplayItem(item);
    setCatalogDraft(catalogFromItem(item));
    setCatalogEditing(false);
    setCatalogError(null);
  }, [item]);

  const photos = useMemo(
    () => [displayItem.primarySnap, ...displayItem.snaps.filter((snap) => snap.id !== displayItem.primarySnap.id)],
    [displayItem],
  );
  const heroHeight = Math.min(height * 0.55, 560);
  const currencyCode = useCurrencyCode();
  const price = formatShoppingPrice(displayItem.extractedPrice, currencyCode);
  const meta = [displayItem.sizeLabel ? `Size ${displayItem.sizeLabel}` : null, displayItem.colorLabel, displayItem.materialLabel]
    .filter(Boolean)
    .join('   ·   ');
  const badges = shoppingItemBadges(displayItem);
  const activePhoto = photos[activeIndex] ?? displayItem.primarySnap;
  const canOrganize = displayItem.snaps.length > 1 || displayItem.snaps.some((snap) => snap.captureRole === 'unknown');
  const mapCoordinate = displayItem.primarySnap.latitude !== null && displayItem.primarySnap.longitude !== null
    ? { latitude: displayItem.primarySnap.latitude, longitude: displayItem.primarySnap.longitude }
    : null;

  const tagOcrText = useMemo(
    () => displayItem.snaps
      .filter((snap) => snap.captureRole === 'tag')
      .map((snap) => snap.rawOcrText.trim())
      .filter(Boolean)
      .join('\n'),
    [displayItem],
  );
  const { fields: tagFields, sections: tagSections } = useMemo(
    () => parseShoppingTagOcr(tagOcrText),
    [tagOcrText],
  );
  const tagSpecs = tagFields.filter((field) => field.label !== 'USD');

  const jumpToPhoto = (index: number) => {
    void Haptics.selectionAsync();
    setActiveIndex(index);
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const openMap = () => {
    if (!mapCoordinate) return;
    void Haptics.selectionAsync();
    void Linking.openURL(
      `https://maps.apple.com/?q=${encodeURIComponent(`${mapCoordinate.latitude},${mapCoordinate.longitude}`)}`,
    );
  };

  const handleAskStylist = () => {
    onClose();
    setTimeout(() => askStylistAboutItem(displayItem), 300);
  };

  const handleSaveCatalog = () => {
    const patch = cleanCatalogPatch(catalogDraft);
    setCatalogError(null);
    void saveCatalog(displayItem.captureGroupId, patch)
      .then(() => {
        setDisplayItem((current) => ({ ...current, ...patch }));
        setCatalogEditing(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch((error) => {
        setCatalogError(error instanceof Error ? error.message : 'Please try again.');
      });
  };

  const handleSaveOrganization = async (updates: Parameters<typeof saveOrganization>[0]) => {
    await saveOrganization(updates);
    setOrganizerOpen(false);
    // Photos may now belong to different items — closing avoids showing a stale grouping.
    onClose();
  };

  const handleDelete = () => {
    Alert.alert('Delete this find?', 'These shopping photos will be removed from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteItem(displayItem)
            .then(onClose)
            .catch((error) => {
              Alert.alert('Could not delete', error instanceof Error ? error.message : 'Please try again.');
            });
        },
      },
    ]);
  };

  const capturedLabel = new Date(displayItem.capturedAt).toLocaleString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const locationSourceLabel = `${activePhoto.locationSource ? activePhoto.locationSource.replace('_', ' ') : 'Not captured'}${
    activePhoto.locationAccuracyMeters !== null ? ` · ~${Math.round(activePhoto.locationAccuracyMeters)} m` : ''
  }`;
  const syncLabel = displayItem.syncStatus === 'pending' ? 'Saved locally' : 'Synced';

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { height: heroHeight }]}>
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
              style={styles.topScrim}
              pointerEvents="none"
            />
            <View style={[styles.rolePill, { top: insets.top + spacing.sm }]}>
              <Text style={styles.rolePillText}>{snapRoleLabel(activePhoto.captureRole)}</Text>
            </View>
          </View>

          {photos.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filmstrip}>
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={photo.id}
                  style={[styles.filmstripThumb, index === activeIndex && styles.filmstripThumbActive]}
                  onPress={() => jumpToPhoto(index)}
                  accessibilityLabel={`View photo ${index + 1} of ${photos.length}`}
                >
                  <Image source={{ uri: photo.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={photo.id} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
            <Text style={styles.eyebrow}>{itemRoleSummary(displayItem).toUpperCase()}</Text>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{displayItem.category ?? 'Shopping find'}</Text>
              {price ? <Text style={styles.price}>{price}</Text> : <Text style={styles.priceMuted}>Price not found</Text>}
            </View>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
            <View style={styles.divider} />
            {tagSpecs.length > 0 ? (
              <Text style={styles.specs}>
                {tagSpecs.map((field) => `${field.label.toUpperCase()} ${field.value}`).join('   ·   ')}
              </Text>
            ) : null}
            {displayItem.notes && !catalogEditing ? <Text style={styles.notes}>“{displayItem.notes}”</Text> : null}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionPill, catalogEditing && styles.actionPillActive]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setCatalogDraft(catalogFromItem(displayItem));
                  setCatalogError(null);
                  setCatalogEditing((editing) => !editing);
                }}
              >
                <Ionicons name="pricetag-outline" size={14} color={catalogEditing ? colors.primaryForeground : colors.foreground} />
                <Text style={[styles.actionPillText, catalogEditing && styles.actionPillTextActive]}>
                  {catalogEditing ? 'Cancel' : 'Catalog'}
                </Text>
              </TouchableOpacity>
              {canOrganize ? (
                <TouchableOpacity
                  style={styles.actionPill}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setOrganizerOpen(true);
                  }}
                >
                  <Ionicons name="albums-outline" size={14} color={colors.foreground} />
                  <Text style={styles.actionPillText}>Organize</Text>
                </TouchableOpacity>
              ) : null}
              {mapCoordinate ? (
                <TouchableOpacity style={styles.actionPill} onPress={openMap}>
                  <Ionicons name="location-outline" size={14} color={colors.foreground} />
                  <Text style={styles.actionPillText}>Location</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {catalogEditing ? (
              <View style={styles.catalogEditor}>
                <View style={styles.catalogFieldGrid}>
                  <CatalogField label="Category" value={catalogDraft.category} onChange={(value) => setCatalogDraft((current) => ({ ...current, category: value }))} />
                  <CatalogField label="Size" value={catalogDraft.sizeLabel} onChange={(value) => setCatalogDraft((current) => ({ ...current, sizeLabel: value }))} />
                  <CatalogField label="Color" value={catalogDraft.colorLabel} onChange={(value) => setCatalogDraft((current) => ({ ...current, colorLabel: value }))} />
                  <CatalogField label="Material" value={catalogDraft.materialLabel} onChange={(value) => setCatalogDraft((current) => ({ ...current, materialLabel: value }))} />
                </View>
                <View style={styles.catalogStatusRow}>
                  {SHOPPING_CATALOG_STATUS_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.catalogStatusChip, catalogDraft.catalogStatus === option.value && styles.catalogStatusChipActive]}
                      onPress={() => setCatalogDraft((current) => ({ ...current, catalogStatus: option.value }))}
                    >
                      <Text style={[styles.catalogStatusText, catalogDraft.catalogStatus === option.value && styles.catalogStatusTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.catalogFavorite}
                    onPress={() => setCatalogDraft((current) => ({ ...current, isFavorite: !current.isFavorite }))}
                  >
                    <Ionicons name={catalogDraft.isFavorite ? 'heart' : 'heart-outline'} size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={catalogDraft.notes ?? ''}
                  onChangeText={(value) => setCatalogDraft((current) => ({ ...current, notes: value }))}
                  placeholder="Fit, styling ideas, sale context..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                  style={styles.catalogNotesInput}
                />
                {catalogError ? <Text selectable style={styles.catalogError}>{catalogError}</Text> : null}
                <TouchableOpacity
                  style={[styles.catalogSaveButton, isSavingCatalog && styles.disabled]}
                  onPress={handleSaveCatalog}
                  disabled={isSavingCatalog}
                >
                  {isSavingCatalog ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                  )}
                  <Text style={styles.catalogSaveText}>Save catalog</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity style={styles.stylistRow} onPress={handleAskStylist} accessibilityRole="button">
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text style={styles.stylistRowText}>Ask the stylist about this</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.badgeRow}>
              {badges.map((badge) => (
                <View key={badge.key} style={styles.badge}>
                  <View
                    style={[
                      styles.badgeDot,
                      badge.tone === 'attention' && styles.badgeDotAttention,
                      badge.tone === 'success' && styles.badgeDotSuccess,
                    ]}
                  />
                  <Text style={styles.badgeText}>{badge.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />
            <Text style={styles.detailsEyebrow}>DETAILS</Text>
            <View style={styles.detailRows}>
              <DetailRow label="Store" value={displayItem.storeName ?? 'Store not set'} />
              <DetailRow label="Captured" value={capturedLabel} />
              <DetailRow label="Role" value={itemRoleSummary(displayItem)} />
              <DetailRow label="Location" value={formatShoppingDetailLocation(displayItem)} />
              <DetailRow label="Location source" value={locationSourceLabel} />
              <DetailRow label="Status" value={syncLabel} />
            </View>

            {tagSections.length > 0 ? (
              <View style={styles.disclosureCard}>
                <TouchableOpacity
                  style={styles.disclosureToggle}
                  onPress={() => setShowFullTag((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel={showFullTag ? 'Hide tag text' : 'Show tag text'}
                >
                  <Text style={styles.disclosureLabel}>TAG TEXT</Text>
                  <Ionicons name={showFullTag ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
                </TouchableOpacity>
                {showFullTag ? (
                  <View style={styles.tagTextBlock}>
                    {tagSections.map((section, index) =>
                      section.type === 'header' ? (
                        <Text key={index} style={styles.tagHeader}>
                          {section.text}
                        </Text>
                      ) : section.type === 'item' ? (
                        <View key={index} style={styles.tagListRow}>
                          <Text style={styles.tagBullet}>{'•'}</Text>
                          <Text style={styles.tagItemText}>{section.text}</Text>
                        </View>
                      ) : (
                        <Text key={index} style={styles.tagText}>
                          {section.text}
                        </Text>
                      ),
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.deleteTouch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={handleDelete}
              disabled={isDeleting}
              accessibilityRole="button"
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={styles.deleteText}>Delete this find</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + spacing.sm }]}
          onPress={onClose}
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ShoppingSnapOrganizerModal
        visible={organizerOpen}
        snaps={displayItem.snaps}
        onClose={() => setOrganizerOpen(false)}
        onSave={handleSaveOrganization}
        isSaving={isSavingOrganization}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { width: '100%', backgroundColor: colors.surfaceSubtle },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 100 },
  rolePill: {
    position: 'absolute',
    left: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: 'rgba(250, 248, 245, 0.92)',
  },
  rolePillText: { ...typography.text.eyebrow, color: colors.foreground },
  filmstrip: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  filmstripThumb: {
    width: 46,
    height: 58,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceSubtle,
  },
  filmstripThumbActive: { borderColor: colors.primary },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  eyebrow: { ...typography.text.eyebrow, color: colors.primary },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  title: { flex: 1, ...typography.text.editorialTitle, color: colors.foreground },
  price: { fontSize: typography.text.sheetTitle.fontSize, color: colors.foreground, fontVariant: ['tabular-nums'] },
  priceMuted: { fontSize: typography.text.sectionTitle.fontSize, color: colors.mutedForeground },
  meta: { fontSize: typography.text.bodySmall.fontSize, letterSpacing: typography.tracking.compact, textTransform: 'uppercase', color: colors.mutedForeground },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.sm, backgroundColor: colors.hairline },
  specs: { fontSize: typography.text.caption.fontSize, letterSpacing: typography.tracking.subtle, color: colors.secondaryForeground, fontVariant: ['tabular-nums'] },
  notes: { fontSize: typography.text.body.fontSize, lineHeight: 24, fontStyle: 'italic', color: colors.secondaryForeground },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  actionPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  actionPillActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  actionPillText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  actionPillTextActive: { color: colors.primaryForeground },
  catalogEditor: { marginTop: spacing.sm, gap: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  catalogFieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  catalogField: { flexGrow: 1, flexBasis: '45%', gap: 4 },
  catalogFieldLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  catalogFieldInput: {
    paddingVertical: 6,
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.foreground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  catalogStatusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  catalogStatusChip: { minHeight: 30, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
  catalogStatusChipActive: { backgroundColor: colors.foreground },
  catalogStatusText: { ...typography.text.label, color: colors.secondaryForeground },
  catalogStatusTextActive: { color: colors.primaryForeground },
  catalogFavorite: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.surfaceSubtle },
  catalogNotesInput: {
    minHeight: 64,
    fontSize: typography.text.bodySmall.fontSize,
    lineHeight: 20,
    color: colors.foreground,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  catalogError: { fontSize: typography.text.caption.fontSize, color: colors.error },
  catalogSaveButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  disabled: { opacity: 0.6 },
  catalogSaveText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  stylistRow: {
    marginTop: spacing.xs,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stylistRowText: { flex: 1, fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.primary },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mutedForeground },
  badgeDotAttention: { backgroundColor: colors.primary },
  badgeDotSuccess: { backgroundColor: colors.success },
  badgeText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  detailsEyebrow: { ...typography.text.eyebrow, color: colors.primary },
  detailRows: { gap: spacing.sm, paddingTop: spacing.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  detailLabel: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  detailValue: { flex: 1, fontSize: typography.text.bodySmall.fontSize, textAlign: 'right', color: colors.foreground },
  disclosureCard: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  disclosureToggle: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  disclosureLabel: { ...typography.text.eyebrow, color: colors.primary },
  tagTextBlock: { gap: spacing.xs },
  tagHeader: { ...typography.text.eyebrow, color: colors.primary, marginTop: spacing.xs },
  tagListRow: { flexDirection: 'row', gap: spacing.xs },
  tagBullet: { fontSize: typography.text.bodySmall.fontSize, lineHeight: 21, color: colors.secondaryForeground },
  tagItemText: { flex: 1, fontSize: typography.text.bodySmall.fontSize, lineHeight: 21, color: colors.secondaryForeground },
  tagText: { fontSize: typography.text.bodySmall.fontSize, lineHeight: 21, color: colors.secondaryForeground },
  deleteTouch: { alignSelf: 'flex-start', marginTop: spacing.lg, paddingVertical: spacing.xs },
  deleteText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.error },
  closeButton: {
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
