import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { compressImageToDataUrl } from '../../lib/compressImage';
import { useQueryClient } from '@tanstack/react-query';
import {
  useItems, useUpdateItem, useDeleteItem, useMarkItemWorn, usePolishItem,
} from '../../hooks/useItems';
import { OUTFITS_QUERY_KEY } from '../../hooks/useOutfits';
import type { Outfit } from '../../types/outfit';
import { api, apiErrorCode, apiErrorMessage } from '../../lib/api';
import {
  coverImageVariantLabel,
  hasCutout,
  hasPolished,
  itemCoverPresentation,
} from '../../lib/itemImage';
import { normalizeTag, dedupeTags } from '../../lib/tags';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS, SEASON_LABELS } from '../../types/item';
import type { CoverImageVariant, Item, Season } from '../../types/item';
import type { ItemDetailScreenProps } from '../../navigation/types';
import * as Haptics from 'expo-haptics';
import { useTagScanner } from '../../hooks/useTagScanner';
import { EditItemModal } from '../../components/item/EditItemModal';
import { SaveToBoardSheet } from '../../components/boards/SaveToBoardSheet';
import { generateCutoutForItem } from '../../lib/cutout';
import { SLEEVE_LENGTH_LABELS } from '../../types/item';
import { ErrorState } from '../../components/primitives/ErrorState';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import {
  TabQuickMenuSheet,
  type TabQuickMenuOption,
} from '../../components/navigation/TabQuickMenuSheet';
import { CoverImageSheet } from '../../components/item/cover-image-sheet';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

type EditorialDetailRow = {
  label: string;
  value: string;
  numeric?: boolean;
};

function EditorialSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.editorialSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function EditorialDetailList({ rows }: { rows: EditorialDetailRow[] }) {
  return (
    <View>
      {rows.map((row, index) => (
        <View
          key={row.label}
          style={[styles.editorialDetailRow, index < rows.length - 1 && styles.editorialDetailRowBorder]}
        >
          <Text style={styles.detailLabel}>{row.label}</Text>
          <Text
            selectable
            style={[styles.detailValue, row.numeric && styles.numericValue]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
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
  const { openStylist } = useGlobalAIStylist();

  const { width } = useWindowDimensions();
  const imageHeight = width * 0.92;
  const insets = useSafeAreaInsets();
  const heroHeight = imageHeight + insets.top;

  // ── Edit modal visibility ────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [itemMenuOpen, setItemMenuOpen] = useState(false);

  // ── Inline tag state ─────────────────────────────────────────────────────────
  const [inlineTagActive, setInlineTagActive] = useState(false);
  const [inlineTagValue, setInlineTagValue] = useState('');
  const inlineTagRef = useRef<TextInput>(null);

  // ── Re-scan state ────────────────────────────────────────────────────────────
  const [rescanning, setRescanning] = useState(false);

  // ── Cover image selection ────────────────────────────────────────────────────
  const [coverSheetOpen, setCoverSheetOpen] = useState(false);
  const [cuttingOut, setCuttingOut] = useState(false);

  // Handlers run before the `viewItem` narrowing below, so read the cutout flags
  // off the possibly-null item here.
  const viewHasCutout = hasCutout(item);
  const viewIsPolished = hasPolished(item);

  const polishItem = usePolishItem();

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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      await updateItem.mutateAsync({
        id: item.id,
        ...(overrideImageData ? {
          imageUrl: overrideImageData,
          cutoutUrl: null,
          polishedUrl: null,
          coverImageVariant: 'original' as const,
        } : {}),
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
        // Takes the scan's answer including null, like pattern/fit/neckline
        // above. Falling back to the stored value made a rescan able to add a
        // sleeve length but never to correct a wrong one — the one operation a
        // user reaches for after seeing the wrong sleeves.
        sleeveLength: scanned.sleeveLength || null,
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
    if (item) void refreshCutout(dataUrl);
  };

  /**
   * Regenerate this item's cutout in the background.
   *
   * Deliberately detached from the save: the new photo is already on screen,
   * and a cutout is an enhancement to it rather than a precondition. Silent on
   * failure — the item simply keeps its plain photo.
   */
  const refreshCutout = async (imageDataUrl?: string) => {
    if (!item) return;
    try {
      const cutoutUrl = await generateCutoutForItem({
        item: {
          id: item.id,
          imageUrl: item.imageUrl,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          style: item.style,
          color: item.color,
        },
        userId: item.userId,
        imageDataUrl,
      });
      if (cutoutUrl) updateItem.mutate({ id: item.id, cutoutUrl });
    } catch {
      // Busy or unavailable — leave the item on its original photo.
    }
  };

  /**
   * Regenerate this item as a studio catalog shot.
   *
   * Foregrounded rather than fire-and-forget like the cutout: it costs real
   * money per tap, takes several seconds, and visibly changes the garment, so
   * the user waits and sees the result.
   */
  const handlePolish = () => {
    if (!item || polishItem.isPending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    polishItem.mutate(item.id, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCoverSheetOpen(false);
      },
      onError: (err) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const code = apiErrorCode(err);
        if (code === 'INSUFFICIENT_CREDITS') {
          Alert.alert('Not enough credits', apiErrorMessage(err, 'You need more credits to polish this item.'));
          return;
        }
        if (code === 'FREE_LIMIT_REACHED') {
          Alert.alert('Free limit reached', apiErrorMessage(err, 'Upgrade to Premium to keep going.'));
          return;
        }
        Alert.alert('Polish failed', 'Could not generate a catalog image. Your photo is unchanged.');
      },
    });
  };

  /** Re-run background removal against the item's current photo. */
  const handleCreateCutout = async () => {
    if (!item) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCuttingOut(true);
    try {
      const cutoutUrl = await generateCutoutForItem({
        item: {
          id: item.id,
          imageUrl: item.imageUrl,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          style: item.style,
          color: item.color,
        },
        userId: item.userId,
      });
      if (cutoutUrl) {
        await updateItem.mutateAsync({ id: item.id, cutoutUrl });
        setCoverSheetOpen(true);
      } else {
        Alert.alert(
          "Couldn't isolate this item",
          'The background here is too close to the garment to separate cleanly. The original photo is unchanged.',
        );
      }
    } catch {
      Alert.alert('Busy', 'Background removal is busy right now. Please try again in a moment.');
    } finally {
      setCuttingOut(false);
    }
  };

  const handleChangePhoto = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhotoMenuOpen(true);
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
  const cover = itemCoverPresentation(viewItem);
  const imageUri = cover.uri;
  const catalogTopInset = cover.variant === 'cutout'
    ? spacing.xxxl
    : spacing.xxl + spacing.sm;
  const catalogBottomInset = spacing.xl;
  const catalogImageHeight = imageHeight - catalogTopInset - catalogBottomInset;
  const breadcrumb = [
    viewItem.category ? CATEGORY_LABELS[viewItem.category] : null,
    viewItem.subcategory,
    viewItem.style,
  ].filter(Boolean).join(' › ');
  const warmthLabel = viewItem.warmthRating != null
    ? ['Very Light', 'Light', 'Medium', 'Warm', 'Very Warm'][viewItem.warmthRating - 1]
    : null;
  const essentialFacts = [
    viewItem.color,
    viewItem.material,
    warmthLabel ? `${warmthLabel} warmth` : null,
  ].filter((value): value is string => !!value);
  const styleDescriptors = [
    viewItem.pattern,
    viewItem.fit,
    viewItem.neckline,
    viewItem.sleeveLength ? SLEEVE_LENGTH_LABELS[viewItem.sleeveLength] : null,
    ...(viewItem.notableDetails ?? []),
  ]
    .filter((value): value is string => !!value)
    .map(titleCase);
  const hasStyleProfile = styleDescriptors.length > 0 || (viewItem.colorPalette?.length ?? 0) > 0;

  const atAGlanceRows: EditorialDetailRow[] = [];
  if (viewItem.color) atAGlanceRows.push({ label: 'Colour', value: viewItem.color });
  if (viewItem.material) atAGlanceRows.push({ label: 'Material', value: viewItem.material });
  if (warmthLabel) atAGlanceRows.push({ label: 'Warmth', value: warmthLabel });
  if (viewItem.seasons?.length > 0) {
    atAGlanceRows.push({
      label: 'Seasons',
      value: viewItem.seasons
        .map((season) => SEASON_LABELS[season as Season] ?? titleCase(season))
        .join(', '),
    });
  }
  if (viewItem.occasions?.length > 0) {
    atAGlanceRows.push({
      label: 'Occasions',
      value: viewItem.occasions.map(titleCase).join(', '),
    });
  }
  if (viewItem.condition && viewItem.condition !== 'good') {
    atAGlanceRows.push({ label: 'Condition', value: titleCase(viewItem.condition) });
  }

  const wearHistoryRows: EditorialDetailRow[] = [
    { label: 'Times worn', value: String(viewItem.wearCount), numeric: true },
  ];
  if (viewItem.lastWornAt) {
    wearHistoryRows.push({ label: 'Last worn', value: formatDate(viewItem.lastWornAt) });
  }
  if (viewItem.purchasePrice != null) {
    wearHistoryRows.push({ label: 'Paid', value: `$${viewItem.purchasePrice.toFixed(2)}`, numeric: true });
  }
  if (viewItem.wearCount > 0 && viewItem.purchasePrice != null) {
    wearHistoryRows.push({
      label: 'Cost per wear',
      value: `$${(viewItem.purchasePrice / viewItem.wearCount).toFixed(2)}`,
      numeric: true,
    });
  }
  if (viewItem.purchaseLocation) {
    wearHistoryRows.push({ label: 'Purchased in', value: viewItem.purchaseLocation });
  }

  const isBusy = updateItem.isPending || markWorn.isPending || deleteItem.isPending
    || cuttingOut || polishItem.isPending;
  const itemMenuOptions: TabQuickMenuOption[] = [
    {
      key: 'edit',
      label: 'Edit details',
      icon: 'pencil-outline',
      onPress: () => setEditOpen(true),
    },
    {
      key: 'photo',
      label: 'Photo options',
      icon: 'camera-outline',
      onPress: handleChangePhoto,
    },
    ...(viewItem.imageUrl ? [{
      key: 'rescan',
      label: 'Re-scan style profile',
      icon: 'refresh-outline' as const,
      onPress: () => { void handleRescan(); },
    }] : []),
    {
      key: 'remove',
      label: 'Remove from wardrobe',
      icon: 'trash-outline',
      tone: 'destructive',
      onPress: handleDelete,
    },
  ];
  const photoMenuOptions: TabQuickMenuOption[] = [
    {
      key: 'camera',
      label: 'Take a New Photo',
      icon: 'camera-outline',
      onPress: () => { void pickAndChangePhoto('camera'); },
    },
    {
      key: 'library',
      label: 'Choose from Library',
      icon: 'images-outline',
      iconColor: colors.foreground,
      iconBg: colors.secondary,
      onPress: () => { void pickAndChangePhoto('library'); },
    },
    {
      key: 'cutout',
      label: viewHasCutout ? 'Recreate Cutout' : 'Remove Background',
      icon: 'cut-outline',
      iconColor: colors.foreground,
      iconBg: colors.secondary,
      onPress: () => { void handleCreateCutout(); },
    },
    ...(viewIsPolished ? [{
      key: 'polish',
      label: 'Regenerate catalog cover',
      icon: 'sparkles-outline' as const,
      iconBg: colors.accent,
      onPress: handlePolish,
    }] : []),
  ];

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="always"
        onTouchStart={() => inlineTagRef.current?.blur()}
      >
        {/* Image */}
        <View style={[styles.imageContainer, { height: heroHeight }]}>
          <View style={[styles.imageFrame, { height: imageHeight, marginTop: insets.top }]}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={cover.isCatalogStyle
                  ? [
                    styles.heroCatalogImage,
                    {
                      height: catalogImageHeight,
                      marginTop: catalogTopInset,
                      marginBottom: catalogBottomInset,
                    },
                  ]
                  : styles.image}
                contentFit={cover.variant === 'original' ? 'contain' : cover.contentFit}
                transition={200}
                accessible
                accessibilityLabel={`${viewItem.name || 'Wardrobe item'} cover image`}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="shirt-outline" size={64} color={colors.border} />
              </View>
            )}
          </View>

          {polishItem.isPending && (
            <View
              style={styles.polishOverlay}
              pointerEvents="none"
              accessibilityRole="progressbar"
              accessibilityLiveRegion="polite"
              accessibilityLabel="Polishing your piece. Creating a clean catalog image."
            >
              <View style={styles.polishStatusCard}>
                <ActivityIndicator size="small" color={colors.primary} />
                <View style={styles.polishStatusCopy}>
                  <Text style={styles.polishStatusTitle}>Polishing your piece</Text>
                  <Text style={styles.polishStatusText}>
                    Creating a clean catalog image… This usually takes 10–20 seconds.
                  </Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.coverPickerButton,
              { top: insets.top + spacing.sm },
              polishItem.isPending && styles.actionDisabled,
            ]}
            onPress={() => setCoverSheetOpen(true)}
            disabled={polishItem.isPending}
            accessibilityRole="button"
            accessibilityState={{ expanded: coverSheetOpen, disabled: polishItem.isPending }}
            accessibilityLabel={`Cover image: ${coverImageVariantLabel(cover.variant)}. Choose a different cover image.`}
          >
            <Ionicons
              name={cover.variant === 'original'
                ? 'image-outline'
                : cover.variant === 'cutout'
                  ? 'cut-outline'
                  : 'sparkles-outline'}
              size={14}
              color={colors.foreground}
            />
            <Text style={styles.coverPickerText}>{coverImageVariantLabel(cover.variant)}</Text>
            <Ionicons name="chevron-down" size={13} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + spacing.sm }]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to closet"
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.itemOptionsButton,
              { top: insets.top + spacing.sm },
              isBusy && styles.actionDisabled,
            ]}
            onPress={() => setItemMenuOpen(true)}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Item options"
            accessibilityState={{ expanded: itemMenuOpen, disabled: isBusy }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {!viewIsPolished && viewItem.imageUrl && (
          <TouchableOpacity
            style={[styles.coverEnhancement, polishItem.isPending && styles.actionDisabled]}
            onPress={handlePolish}
            disabled={isBusy}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="Create a catalog cover with AI using a Polish credit"
            accessibilityState={{ disabled: isBusy, busy: polishItem.isPending }}
          >
            <View style={styles.coverEnhancementIcon}>
              {polishItem.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="sparkles-outline" size={17} color={colors.primary} />
              )}
            </View>
            <View style={styles.coverEnhancementCopy}>
              <Text style={styles.coverEnhancementTitle}>
                {polishItem.isPending ? 'Creating catalog cover' : 'Create a catalog cover'}
              </Text>
              <Text style={styles.coverEnhancementText}>
                {polishItem.isPending
                  ? 'A clean studio-style image is on its way.'
                  : 'A clean studio-style image for your closet'}
              </Text>
            </View>
            {!polishItem.isPending && (
              <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text selectable style={styles.name}>{viewItem.name || 'Unnamed Item'}</Text>
            {viewItem.brand ? <Text selectable style={styles.brand}>{viewItem.brand}</Text> : null}
            {breadcrumb ? <Text selectable style={styles.breadcrumb}>{breadcrumb}</Text> : null}
            {essentialFacts.length > 0 ? (
              <Text selectable style={styles.essentialFacts}>{essentialFacts.join(' · ')}</Text>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          style={styles.stylistButton}
          onPress={() => openStylist({
            initialQuery: `How should I style my "${viewItem.name}"?`,
            source: 'item_detail',
            onNavigateToCloset: (outfitId) => navigation.navigate('OutfitDetail', { outfitId }),
            context: {
              kind: 'item',
              itemId: viewItem.id,
              itemName: viewItem.name,
              category: viewItem.category ?? null,
              brand: viewItem.brand ?? null,
              color: viewItem.color ?? null,
            },
          })}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Ask AI Stylist how to style ${viewItem.name}`}
        >
          <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
          <Text style={styles.stylistButtonText}>Style this item</Text>
        </TouchableOpacity>

        {/* Wardrobe actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, markWorn.isPending && styles.actionDisabled]}
            onPress={handleMarkWorn}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${viewItem.name} as worn today`}
            accessibilityState={{ disabled: isBusy }}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Worn today</Text>
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <TouchableOpacity
            style={[styles.actionButton, updateItem.isPending && styles.actionDisabled]}
            onPress={handleToggleFavorite}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={viewItem.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
            accessibilityState={{ selected: viewItem.isFavorite, disabled: isBusy }}
          >
            <Ionicons
              name={viewItem.isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={viewItem.isFavorite ? colors.primary : colors.foreground}
            />
            <Text style={styles.actionLabel}>{viewItem.isFavorite ? 'Favourited' : 'Favourite'}</Text>
          </TouchableOpacity>
          {!isCreateMode && !!itemId && (
            <>
              <View style={styles.actionDivider} />
              <TouchableOpacity
                style={[styles.actionButton, isBusy && styles.actionDisabled]}
                onPress={() => setSaveSheetOpen(true)}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel={`Add ${viewItem.name} to a board`}
                accessibilityState={{ disabled: isBusy }}
              >
                <Ionicons name="bookmark-outline" size={20} color={colors.foreground} />
                <Text style={styles.actionLabel}>Board</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Style Profile */}
        <EditorialSection title="Style profile">
          {!hasStyleProfile ? (
            <View style={styles.profileEmptyRow}>
              <View style={styles.profileEmptyCopy}>
                <Text style={styles.profileEmptyTitle}>No style profile yet</Text>
                <Text style={styles.profileEmptyText}>
                  {viewItem.imageUrl
                    ? 'Analyse the photo for silhouette and design details.'
                    : 'Add a photo to analyse silhouette and design details.'}
                </Text>
              </View>
              {viewItem.imageUrl ? (
                <TouchableOpacity
                  style={[styles.analyseButton, rescanning && styles.actionDisabled]}
                  onPress={() => { void handleRescan(); }}
                  disabled={rescanning}
                  accessibilityRole="button"
                  accessibilityLabel="Analyse item style profile"
                  accessibilityState={{ disabled: rescanning }}
                >
                  {rescanning ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                  )}
                  <Text style={styles.analyseButtonText}>{rescanning ? 'Analysing' : 'Analyse'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={styles.profileBody}>
              {viewItem.colorPalette?.length > 0 && (
                <View
                  style={styles.swatchRow}
                  accessible
                  accessibilityLabel={`Colour palette: ${viewItem.colorPalette.join(', ')}`}
                >
                  {viewItem.colorPalette.map((hex, index) => (
                    <View key={`${hex}-${index}`} style={[styles.swatch, { backgroundColor: hex }]} />
                  ))}
                </View>
              )}
              {styleDescriptors.length > 0 ? (
                <Text selectable style={styles.profileDescriptors}>
                  {styleDescriptors.join(' · ')}
                </Text>
              ) : null}
            </View>
          )}
        </EditorialSection>

        {atAGlanceRows.length > 0 ? (
          <EditorialSection title="At a glance">
            <EditorialDetailList rows={atAGlanceRows} />
          </EditorialSection>
        ) : null}

        <EditorialSection title="Wear history">
          <EditorialDetailList rows={wearHistoryRows} />
        </EditorialSection>

        {/* Tags */}
        <EditorialSection title="Tags">
          <View style={styles.chipRow}>
            {(viewItem.tags ?? []).map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.tagChip}
                onPress={() => removeTagInline(tag)}
                activeOpacity={0.7}
                disabled={updateItem.isPending}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove tag ${tag}`}
                accessibilityState={{ disabled: updateItem.isPending }}
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
                placeholder="Tag name"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                maxLength={40}
                autoCapitalize="none"
                returnKeyType="done"
                accessibilityLabel="New tag name"
                onTouchStart={(event) => event.stopPropagation()}
              />
            ) : (
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={() => {
                  setInlineTagActive(true);
                  setTimeout(() => inlineTagRef.current?.focus(), 50);
                }}
                activeOpacity={0.7}
                disabled={updateItem.isPending}
                accessibilityRole="button"
                accessibilityLabel="Add tag"
                accessibilityState={{ disabled: updateItem.isPending }}
              >
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={styles.addTagText}>Add tag</Text>
              </TouchableOpacity>
            )}
          </View>
        </EditorialSection>

        {/* Fabric & Care */}
        <EditorialSection title="Fabric & care">
          {viewItem.care ? (
            <EditorialDetailList rows={[{ label: 'Care', value: viewItem.care }]} />
          ) : null}
          <TouchableOpacity
            style={[styles.scanLabelBtn, tagScanner.isScanning && styles.actionDisabled]}
            onPress={tagScanner.handleScanLabel}
            disabled={tagScanner.isScanning}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Scan clothing label"
            accessibilityState={{ disabled: tagScanner.isScanning }}
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
        </EditorialSection>

        {/* Notes */}
        {viewItem.notes ? (
          <EditorialSection title="Notes">
            <Text selectable style={styles.notes}>{viewItem.notes}</Text>
          </EditorialSection>
        ) : null}
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

      <TabQuickMenuSheet
        visible={itemMenuOpen}
        title="Item options"
        subtitle={viewItem.name || 'Wardrobe item'}
        options={itemMenuOptions}
        onClose={() => setItemMenuOpen(false)}
      />

      <TabQuickMenuSheet
        visible={photoMenuOpen}
        title="Photo options"
        subtitle={viewItem.name || 'Wardrobe item'}
        options={photoMenuOptions}
        onClose={() => setPhotoMenuOpen(false)}
      />

      <CoverImageSheet
        item={viewItem}
        visible={coverSheetOpen}
        isUpdating={updateItem.isPending}
        onClose={() => setCoverSheetOpen(false)}
        onSelect={(variant: CoverImageVariant) => {
          updateItem.mutate(
            { id: viewItem.id, coverImageVariant: variant },
            { onSuccess: () => setCoverSheetOpen(false) },
          );
        }}
      />
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
  // Keep the hero surface edge-to-edge, but begin the actual garment below
  // system UI so the status bar and Dynamic Island never cover the item.
  imageFrame: { width: '100%', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  // Catalog variants receive an explicit bounded height so the native image
  // view cannot consume the reserved top and bottom whitespace.
  heroCatalogImage: { width: '100%' },
  polishOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(246,243,238,0.72)',
  },
  polishStatusCard: {
    width: '100%',
    maxWidth: 330,
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: 'rgba(255,252,247,0.96)',
  },
  polishStatusCopy: { flex: 1, gap: 3 },
  polishStatusTitle: {
    color: colors.foreground,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  polishStatusText: {
    color: colors.mutedForeground,
    fontSize: typography.size.xs,
    lineHeight: 17,
  },
  coverEnhancement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 66,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.card,
  },
  coverEnhancementIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: colors.accent,
  },
  coverEnhancementCopy: { flex: 1, gap: 2 },
  coverEnhancementTitle: {
    color: colors.foreground,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  coverEnhancementText: {
    color: colors.mutedForeground,
    fontSize: typography.size.xs,
    lineHeight: 17,
  },
  coverPickerButton: {
    position: 'absolute',
    zIndex: 2,
    right: spacing.lg + 44 + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    maxWidth: '54%',
    backgroundColor: 'rgba(255,252,247,0.94)',
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.sm + 2,
    borderCurve: 'continuous',
  },
  coverPickerText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  backButton: {
    position: 'absolute',
    zIndex: 2,
    left: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    boxShadow: '0 2px 8px rgba(29,27,24,0.12)',
  },
  itemOptionsButton: {
    position: 'absolute',
    zIndex: 2,
    right: spacing.lg,
    backgroundColor: 'rgba(255,252,247,0.94)',
    borderRadius: radii.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    boxShadow: '0 2px 8px rgba(29,27,24,0.10)',
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerText: { gap: 5 },
  name: {
    fontFamily: typography.family.display,
    fontSize: typography.size.xxl,
    lineHeight: 34,
    fontWeight: typography.weight.regular,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  brand: {
    fontSize: typography.size.md,
    lineHeight: 21,
    fontWeight: typography.weight.medium,
    color: colors.inkSubtle,
  },
  breadcrumb: {
    fontSize: typography.size.sm,
    lineHeight: 19,
    color: colors.mutedForeground,
  },
  essentialFacts: {
    marginTop: spacing.xs,
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.inkSubtle,
  },

  stylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
  },
  stylistButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: 68,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  actionButton: {
    flex: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: colors.border,
  },
  actionDisabled: { opacity: 0.5 },
  actionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },

  editorialSection: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    lineHeight: 18,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  profileEmptyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  profileEmptyCopy: { flex: 1, gap: 3 },
  profileEmptyTitle: {
    fontSize: typography.size.md,
    lineHeight: 21,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  profileEmptyText: {
    fontSize: typography.size.sm,
    lineHeight: 19,
    color: colors.mutedForeground,
  },
  analyseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  analyseButtonText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  profileBody: { gap: spacing.md },
  swatchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileDescriptors: {
    fontSize: typography.size.md,
    lineHeight: 23,
    color: colors.foreground,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },

  editorialDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    minHeight: 44,
    paddingVertical: 10,
  },
  editorialDetailRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  detailLabel: {
    flexBasis: 104,
    flexShrink: 0,
    fontSize: typography.size.sm,
    lineHeight: 21,
    color: colors.mutedForeground,
  },
  detailValue: {
    flex: 1,
    fontSize: typography.size.md,
    lineHeight: 22,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
    textAlign: 'right',
  },
  numericValue: { fontVariant: ['tabular-nums'] },

  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
  },
  tagChipText: {
    fontSize: typography.size.xs,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  inlineTagInput: {
    minHeight: 44,
    minWidth: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  addTagText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },

  notes: {
    fontSize: typography.size.md,
    color: colors.foreground,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },

  scanLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 0,
  },
  scanLabelBtnText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
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
