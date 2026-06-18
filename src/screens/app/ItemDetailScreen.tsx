import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Modal,
  TextInput,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { compressImageToDataUrl } from '../../lib/compressImage';
import { useQueryClient } from '@tanstack/react-query';
import { useItems, useUpdateItem, useDeleteItem, useMarkItemWorn, useRefineImage } from '../../hooks/useItems';
import { OUTFITS_QUERY_KEY } from '../../hooks/useOutfits';
import type { Outfit } from '../../types/outfit';
import { api } from '../../lib/api';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { normalizeTag, dedupeTags } from '../../lib/tags';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS, SEASON_LABELS } from '../../types/item';
import type { Item, Season } from '../../types/item';
import type { ItemDetailScreenProps } from '../../navigation/types';
import * as Haptics from 'expo-haptics';
import { useTagScanner } from '../../hooks/useTagScanner';
import { EditItemModal } from '../../components/item/EditItemModal';
import { SaveToBoardSheet } from '../../components/boards/SaveToBoardSheet';
import { uploadImageToR2 } from '../../lib/uploadImage';
import { SectionCard } from '../../components/primitives/SectionCard';
import { Chip } from '../../components/primitives/Chip';
import { SLEEVE_LENGTH_LABELS } from '../../types/item';
import { ErrorState } from '../../components/primitives/ErrorState';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}


// ─── Main Screen ─────────────────────────────────────────────────────────────

export function ItemDetailScreen({ route, navigation }: ItemDetailScreenProps) {
  const { itemId, scanData, scanImageUrl } = route.params;
  const isCreateMode = !itemId && !!scanData;

  const { data: items = [], isError: itemsError, refetch: refetchItems } = useItems();
  const item = items.find((i) => i.id === itemId);

  const qc = useQueryClient();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const markWorn = useMarkItemWorn();
  const refineImage = useRefineImage();
  const { openStylist } = useGlobalAIStylist();

  const { width } = useWindowDimensions();
  const imageHeight = width * 0.85;
  const insets = useSafeAreaInsets();

  // ── Edit modal visibility ────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);

  // ── Inline tag state ─────────────────────────────────────────────────────────
  const [inlineTagActive, setInlineTagActive] = useState(false);
  const [inlineTagValue, setInlineTagValue] = useState('');
  const inlineTagRef = useRef<TextInput>(null);

  // ── Re-scan state ────────────────────────────────────────────────────────────
  const [rescanning, setRescanning] = useState(false);

  // ── Tag scanner ──────────────────────────────────────────────────────────────
  const tagScanner = useTagScanner(item ?? null);

  // ── Open edit modal after navigation transition (create mode only) ───────────
  useEffect(() => {
    if (!isCreateMode || !scanData) return;
    const t = setTimeout(() => setEditOpen(true), 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!item && !isCreateMode) {
    if (itemsError) {
      return <ErrorState message="Couldn't load this item" onRetry={refetchItems} />;
    }
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── View mode handlers ───────────────────────────────────────────────────────

  const handleToggleFavorite = () => {
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateItem.mutate({ id: item.id, isFavorite: !item.isFavorite });
  };

  const handleMarkWorn = () => {
    if (!item) return;
    markWorn.mutate(item.id);
  };

  const handleDelete = () => {
    if (!item) return;
    const outfits = qc.getQueryData<Outfit[]>(OUTFITS_QUERY_KEY) ?? [];
    const affectedCount = outfits.filter(o => o.itemIds.some(e => e.id === item.id)).length;
    const warningSuffix = affectedCount > 0
      ? `\n\nThis item appears in ${affectedCount} outfit${affectedCount === 1 ? '' : 's'}. A deleted placeholder will replace it until you clear it.`
      : '';

    Alert.alert(
      'Remove item',
      `Remove "${item.name}" from your wardrobe? This can't be undone.${warningSuffix}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteItem.mutate(item.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  // ── Inline tag handlers ──────────────────────────────────────────────────────

  const removeTagInline = (tag: string) => {
    if (!item) return;
    const newTags = (item.tags ?? []).filter((t) => t !== tag);
    updateItem.mutate({ id: item.id, tags: newTags });
  };

  const commitInlineTag = () => {
    if (!item) return;
    const next = normalizeTag(inlineTagValue);
    setInlineTagActive(false);
    setInlineTagValue('');
    if (!next || (item.tags ?? []).includes(next)) return;
    const newTags = dedupeTags([...(item.tags ?? []), next]);
    updateItem.mutate({ id: item.id, tags: newTags });
  };

  // ── Re-scan / photo handlers ─────────────────────────────────────────────────

  const handleRescan = async (overrideImageData?: string, fileUri?: string) => {
    if (!item) return;
    const imageData = overrideImageData ?? item.imageUrl;
    if (!imageData) return;
    setRescanning(true);
    try {
      let res: { data: any };
      if (fileUri) {
        const formData = new FormData();
        formData.append('image', { uri: fileUri, type: 'image/jpeg', name: 'scan.jpg' } as unknown as Blob);
        res = await api.post('/api/items/scan', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.post('/api/items/scan', { imageData });
      }
      const scanned = res.data as any;
      updateItem.mutate({
        id: item.id,
        ...(overrideImageData ? { imageUrl: overrideImageData } : {}),
        name: scanned.name || item.name,
        brand: scanned.brand || item.brand,
        category: scanned.category || item.category,
        color: scanned.color || item.color,
        subcategory: scanned.subcategory || null,
        style: scanned.style || null,
        seasons: Array.isArray(scanned.seasons) && scanned.seasons.length > 0 ? scanned.seasons : item.seasons,
        occasions: Array.isArray(scanned.occasions) && scanned.occasions.length > 0 ? scanned.occasions : item.occasions,
        colorNormalized: scanned.colorNormalized ?? item.colorNormalized,
        colorTemperature: scanned.colorTemperature ?? item.colorTemperature,
        warmthRating: scanned.warmthRating ?? item.warmthRating,
        pattern: scanned.pattern || null,
        material: scanned.material || null,
        fit: scanned.fit || null,
        neckline: scanned.neckline || null,
        sleeveLength: scanned.sleeveLength || item.sleeveLength,
        formalityStyles: Array.isArray(scanned.formalityStyles) ? scanned.formalityStyles : [],
        notableDetails: Array.isArray(scanned.notableDetails) ? scanned.notableDetails : [],
        colorPalette: Array.isArray(scanned.colorPalette) ? scanned.colorPalette : [],
      });
    } catch {
      Alert.alert('Scan failed', 'Could not analyse the item. Please try again.');
    } finally {
      setRescanning(false);
    }
  };

  const pickAndChangePhoto = async (source: 'camera' | 'library') => {
    const pickFn = source === 'camera'
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;
    const result = await pickFn({ mediaTypes: ['images'], allowsEditing: true, quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const { uri, dataUrl } = await compressImageToDataUrl(result.assets[0], 1024, 0.8);
    await handleRescan(dataUrl, uri);
  };

  const handleRefineImage = () => {
    if (!item) return;
    if (!item.category) {
      Alert.alert('Category required', 'Please set a category for this item before generating an AI image.');
      return;
    }
    refineImage.mutate(
      { name: item.name, color: item.color || 'neutral', brand: item.brand, category: item.category },
      {
        onSuccess: async ({ imageData }) => {
          try {
            // Upload the generated image to R2 and store the hosted URL — never
            // the raw base64 — so the closet payload stays small.
            const hosted = await uploadImageToR2(imageData, item.userId);
            updateItem.mutate({ id: item.id, imageUrl: hosted });
          } catch {
            Alert.alert('Save failed', 'Generated the image but could not save it. Please try again.');
          }
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? 'Could not generate image. Please try again.';
          Alert.alert('Generation failed', msg);
        },
      }
    );
  };

  const handleChangePhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library', 'Generate AI Image'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) pickAndChangePhoto('camera');
          if (idx === 2) pickAndChangePhoto('library');
          if (idx === 3) handleRefineImage();
        }
      );
    } else {
      Alert.alert('Change photo', 'Choose a source', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Camera', onPress: () => pickAndChangePhoto('camera') },
        { text: 'Photo Library', onPress: () => pickAndChangePhoto('library') },
        { text: 'Generate AI Image', onPress: handleRefineImage },
      ]);
    }
  };

  // ── Create mode early return ──────────────────────────────────────────────────
  if (isCreateMode) {
    return (
      <View style={styles.flex}>
        {scanImageUrl && (
          <View style={styles.createImageContainer}>
            <Image
              source={{ uri: scanImageUrl }}
              style={styles.createImage}
              contentFit="contain"
              transition={200}
            />
          </View>
        )}
        <EditItemModal
          visible={editOpen}
          item={null}
          isCreateMode
          scanImageUrl={scanImageUrl}
          scanData={scanData}
          onClose={() => navigation.goBack()}
          onCreateSuccess={(id) => navigation.replace('ItemDetail', { itemId: id })}
        />
      </View>
    );
  }

  // ── View mode: item is guaranteed non-null past this point ───────────────────
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const viewItem = item!;
  const imageUri = resolveImageUri(viewItem.imageUrl);
  const breadcrumb = [
    viewItem.category ? CATEGORY_LABELS[viewItem.category] : null,
    viewItem.subcategory,
    viewItem.style,
  ].filter(Boolean).join(' › ');
  const hasRichProfile = !!(
    viewItem.subcategory || viewItem.style || viewItem.pattern || viewItem.material || viewItem.fit ||
    (viewItem.formalityStyles?.length > 0) || (viewItem.notableDetails?.length > 0)
  );
  const isBusy = updateItem.isPending || markWorn.isPending || deleteItem.isPending || refineImage.isPending;

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image */}
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.imagePlaceholder, { height: imageHeight }]}>
              <Ionicons name="shirt-outline" size={64} color={colors.border} />
            </View>
          )}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + spacing.sm }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </TouchableOpacity>
          {viewItem.isFavorite && (
            <View style={[styles.favBadge, { top: insets.top + spacing.sm }]}>
              <Ionicons name="heart" size={14} color={colors.primary} />
            </View>
          )}
          <TouchableOpacity
            style={styles.changePhotoBtn}
            onPress={handleChangePhoto}
            disabled={rescanning || refineImage.isPending}
          >
            {rescanning || refineImage.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Ionicons name="camera" size={16} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.name}>{viewItem.name || 'Unnamed Item'}</Text>
            {viewItem.brand ? <Text style={styles.brand}>{viewItem.brand}</Text> : null}
            {breadcrumb ? <Text style={styles.breadcrumb}>{breadcrumb}</Text> : null}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, markWorn.isPending && styles.actionDisabled]}
            onPress={handleMarkWorn}
            disabled={isBusy}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Worn today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, updateItem.isPending && styles.actionDisabled]}
            onPress={handleToggleFavorite}
            disabled={isBusy}
          >
            <Ionicons
              name={viewItem.isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={viewItem.isFavorite ? colors.primary : colors.foreground}
            />
            <Text style={styles.actionLabel}>{viewItem.isFavorite ? 'Favourited' : 'Favourite'}</Text>
          </TouchableOpacity>
          {!isCreateMode && !!itemId && (
            <TouchableOpacity style={styles.actionButton} onPress={() => setSaveSheetOpen(true)}>
              <Ionicons name="bookmark-outline" size={20} color={colors.foreground} />
              <Text style={styles.actionLabel}>Save</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.stylistButton}
          onPress={() => openStylist({
            initialQuery: `How should I style my "${viewItem.name}"?`,
            source: 'item_detail',
          })}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Ask AI Stylist how to style ${viewItem.name}`}
        >
          <Ionicons name="sparkles" size={17} color={colors.primary} />
          <Text style={styles.stylistButtonText}>How should I style this?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.removeRow, isBusy && styles.actionDisabled]}
          onPress={handleDelete}
          disabled={isBusy}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={14} color={colors.error} />
          <Text style={styles.removeText}>Remove from wardrobe</Text>
        </TouchableOpacity>

        {/* AI Style Profile */}
        <SectionCard title="AI Style Profile">
          {!hasRichProfile ? (
            <View style={styles.rescanEmpty}>
              <Text style={styles.rescanEmptyText}>
                Detailed stylist profile not yet available.
              </Text>
              <TouchableOpacity
                style={[styles.rescanButton, (rescanning || !viewItem.imageUrl) && styles.actionDisabled]}
                onPress={() => handleRescan()}
                disabled={rescanning || !viewItem.imageUrl}
              >
                {rescanning ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                )}
                <Text style={styles.rescanButtonText}>
                  {rescanning ? 'Analysing…' : 'Re-scan item'}
                </Text>
              </TouchableOpacity>
              {!viewItem.imageUrl && (
                <Text style={styles.rescanHint}>Add a photo first to enable re-scanning.</Text>
              )}
            </View>
          ) : (
            <>
              {viewItem.imageUrl && (
                <TouchableOpacity
                  style={styles.rescanMini}
                  onPress={() => handleRescan()}
                  disabled={rescanning}
                >
                  {rescanning ? (
                    <ActivityIndicator size="small" color={colors.mutedForeground} />
                  ) : (
                    <Ionicons name="refresh-outline" size={14} color={colors.mutedForeground} />
                  )}
                  <Text style={styles.rescanMiniText}>Re-scan</Text>
                </TouchableOpacity>
              )}
              {viewItem.colorPalette?.length > 0 && (
                <View style={styles.swatchRow}>
                  {viewItem.colorPalette.map((hex, i) => (
                    <View key={i} style={[styles.swatch, { backgroundColor: hex }]} />
                  ))}
                </View>
              )}
              <View style={styles.chipRow}>
                {viewItem.pattern ? <Chip label={viewItem.pattern} /> : null}
                {viewItem.fit ? <Chip label={viewItem.fit} /> : null}
                {viewItem.neckline ? <Chip label={viewItem.neckline} /> : null}
                {viewItem.sleeveLength ? <Chip label={SLEEVE_LENGTH_LABELS[viewItem.sleeveLength]} /> : null}
                {viewItem.formalityStyles?.map((s) => <Chip key={s} label={s} />)}
                {viewItem.notableDetails?.map((d) => <Chip key={d} label={d} />)}
              </View>
            </>
          )}
        </SectionCard>

        {/* Details */}
        <SectionCard title="Details">
          <View style={styles.detailGrid}>
            {viewItem.color && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Colour</Text>
                <Text style={styles.detailValue}>{viewItem.color}</Text>
              </View>
            )}
            {viewItem.seasons?.length > 0 && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Season</Text>
                <Text style={styles.detailValue}>
                  {(viewItem.seasons ?? []).map((s) => SEASON_LABELS[s as Season] ?? (s.charAt(0).toUpperCase() + s.slice(1))).join(', ')}
                </Text>
              </View>
            )}
            {viewItem.occasions?.length > 0 && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Occasion</Text>
                <Text style={styles.detailValue}>{viewItem.occasions.map((o) => o.replace('_', ' ')).join(', ')}</Text>
              </View>
            )}
            {viewItem.condition && viewItem.condition !== 'good' && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Condition</Text>
                <Text style={styles.detailValue}>{viewItem.condition.replace('_', ' ')}</Text>
              </View>
            )}
            {viewItem.warmthRating != null && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Warmth</Text>
                <Text style={styles.detailValue}>
                  {['Very Light', 'Light', 'Medium', 'Warm', 'Very Warm'][viewItem.warmthRating - 1] ?? String(viewItem.warmthRating)}
                </Text>
              </View>
            )}
            {viewItem.purchasePrice != null && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Paid</Text>
                <Text style={styles.detailValue}>${viewItem.purchasePrice}</Text>
              </View>
            )}
            {viewItem.wearCount > 0 && viewItem.purchasePrice != null && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Cost/Wear</Text>
                <Text style={styles.detailValue}>${(viewItem.purchasePrice / viewItem.wearCount).toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Times worn</Text>
              <Text style={styles.detailValue}>{viewItem.wearCount}</Text>
            </View>
            {viewItem.lastWornAt && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Last worn</Text>
                <Text style={styles.detailValue}>{formatDate(viewItem.lastWornAt)}</Text>
              </View>
            )}
          </View>
        </SectionCard>

        {/* Tags */}
        <SectionCard title="Tags">
          {(viewItem.tags ?? []).length === 0 && !inlineTagActive ? (
            <TouchableOpacity
              style={styles.tagDropzone}
              onPress={() => {
                setInlineTagActive(true);
                setTimeout(() => inlineTagRef.current?.focus(), 50);
              }}
              activeOpacity={0.7}
              disabled={updateItem.isPending}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.mutedForeground} />
              <Text style={styles.tagDropzoneText}>No tags yet — tap to add one</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.chipRow}>
              {(viewItem.tags ?? []).map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tagChip}
                  onPress={() => removeTagInline(tag)}
                  activeOpacity={0.7}
                  disabled={updateItem.isPending}
                >
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <Ionicons name="close" size={11} color={colors.mutedForeground} style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              ))}
              {inlineTagActive ? (
                <TextInput
                  ref={inlineTagRef}
                  style={styles.inlineTagInput}
                  value={inlineTagValue}
                  onChangeText={setInlineTagValue}
                  onSubmitEditing={commitInlineTag}
                  onBlur={commitInlineTag}
                  placeholder="tag name…"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                  maxLength={40}
                  autoCapitalize="none"
                  returnKeyType="done"
                />
              ) : (
                <TouchableOpacity
                  style={styles.addTagButton}
                  onPress={() => {
                    setInlineTagActive(true);
                    setTimeout(() => inlineTagRef.current?.focus(), 50);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={13} color={colors.mutedForeground} />
                  <Text style={styles.addTagText}>Add tag</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </SectionCard>

        {/* Fabric & Care */}
        <SectionCard title="Fabric & Care">
          {viewItem.material && (
            <View style={styles.careRow}>
              <Text style={styles.detailLabel}>Material</Text>
              <Text style={[styles.detailValue, { flex: 3 }]}>{viewItem.material}</Text>
            </View>
          )}
          {viewItem.care && (
            <View style={styles.careRow}>
              <Text style={styles.detailLabel}>Care</Text>
              <Text style={[styles.detailValue, { flex: 3 }]}>{viewItem.care}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.scanLabelBtn, tagScanner.isScanning && styles.actionDisabled]}
            onPress={tagScanner.handleScanLabel}
            disabled={tagScanner.isScanning}
            activeOpacity={0.7}
          >
            {tagScanner.isScanning ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="barcode-outline" size={15} color={colors.primary} />
            )}
            <Text style={styles.scanLabelBtnText}>
              {tagScanner.isScanning ? 'Reading label…' : 'Scan clothing label'}
            </Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Notes */}
        {viewItem.notes ? (
          <SectionCard title="Notes">
            <Text style={styles.notes}>{viewItem.notes}</Text>
          </SectionCard>
        ) : null}

        {/* Edit button */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setEditOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.foreground} />
          <Text style={styles.editButtonText}>Edit details</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Label scan result sheet ─────────────────────────────────────────── */}
      <Modal
        visible={!!tagScanner.tagResult}
        transparent
        animationType="slide"
        onRequestClose={tagScanner.dismissTagResult}
      >
        <View style={lsStyles.overlay}>
          <TouchableOpacity style={lsStyles.backdrop} onPress={tagScanner.dismissTagResult} activeOpacity={1} />
          <View style={[lsStyles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={lsStyles.handle} />
            <Text style={lsStyles.sheetTitle}>Label Detected</Text>
            <Text style={lsStyles.sheetSubtitle}>Select fields to apply to this item</Text>
            {tagScanner.tagResult && (['brand', 'size', 'material', 'care'] as const).map((field) => {
              const val = tagScanner.tagResult![field];
              if (!val) return null;
              const active = tagScanner.tagSelectedFields.has(field);
              const fieldLabels: Record<string, string> = {
                brand: 'Brand', size: 'Size (as tag)', material: 'Material', care: 'Care',
              };
              return (
                <TouchableOpacity
                  key={field}
                  style={[lsStyles.row, active && lsStyles.rowActive]}
                  onPress={() => tagScanner.setTagSelectedFields((prev) => {
                    const next = new Set(prev);
                    if (next.has(field)) next.delete(field); else next.add(field);
                    return next;
                  })}
                  activeOpacity={0.7}
                >
                  <View style={lsStyles.rowLeft}>
                    <Text style={lsStyles.rowLabel}>{fieldLabels[field]}</Text>
                    <Text style={lsStyles.rowValue}>{val}</Text>
                  </View>
                  <View style={[lsStyles.checkbox, active && lsStyles.checkboxActive]}>
                    {active && <Ionicons name="checkmark" size={14} color={colors.background} />}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={lsStyles.sheetActions}>
              <TouchableOpacity
                style={[lsStyles.applyBtn, tagScanner.tagSelectedFields.size === 0 && { opacity: 0.4 }]}
                onPress={tagScanner.handleApplyTagScan}
                disabled={tagScanner.tagSelectedFields.size === 0 || tagScanner.isApplying}
                activeOpacity={0.8}
              >
                {tagScanner.isApplying ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={lsStyles.applyBtnText}>Apply selected</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={lsStyles.dismissBtn}
                onPress={tagScanner.dismissTagResult}
                activeOpacity={0.7}
              >
                <Text style={lsStyles.dismissBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      <EditItemModal
        visible={editOpen}
        item={viewItem}
        isCreateMode={false}
        onClose={() => setEditOpen(false)}
        onCreateSuccess={() => {}}
      />

      {saveSheetOpen && !!itemId && (
        <SaveToBoardSheet
          target={{ type: 'item', id: itemId }}
          onClose={() => setSaveSheetOpen(false)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: spacing.xxxl },

  createImageContainer: {
    width: '100%',
    height: 340,
    backgroundColor: colors.foreground,
  },
  createImage: {
    width: '100%',
    height: '100%',
  },

  imageContainer: {
    width: '100%',
    backgroundColor: colors.muted,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  favBadge: {
    position: 'absolute',
    right: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerText: { gap: 4 },
  name: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  brand: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
  },
  breadcrumb: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  actionRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  stylistButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  removeText: {
    fontSize: typography.size.sm,
    color: colors.error,
  },
  actionDisabled: { opacity: 0.5 },
  actionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },

  rescanEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rescanEmptyText: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rescanButtonText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
  rescanHint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  rescanMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginBottom: spacing.sm,
  },
  rescanMiniText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },

  swatchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.sm,
  },
  detailItem: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  careRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.lg,
  },
  detailLabel: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
    textTransform: 'capitalize',
  },

  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagChipText: {
    fontSize: typography.size.xs,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  inlineTagInput: {
    height: 30,
    minWidth: 100,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm + 2,
    fontSize: typography.size.xs,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  addTagText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  tagDropzone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    gap: spacing.xs,
  },
  tagDropzoneText: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },

  notes: {
    fontSize: typography.size.md,
    color: colors.foreground,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },

  scanLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  scanLabelBtnText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },

  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.md + 2,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
});

const lsStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg + 4,
    borderTopRightRadius: radii.lg + 4,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '11',
  },
  rowLeft: { flex: 1, gap: 2 },
  rowLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowValue: {
    fontSize: typography.size.md,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing.md,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sheetActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  dismissBtnText: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
  },
});
