import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
  Linking,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetFooter,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AnimatedProgressBar } from '../primitives/AnimatedProgressBar';
import { compressImageToDataUrl } from '../../lib/compressImage';
import {
  scanVisionPoseDirect,
  scanItemDirect,
  useCreateItem,
  useBrandSuggestions,
  type PoseScanItem,
} from '../../hooks/useItems';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS, type Item, type ItemCategory } from '../../types/item';
import { BrandAutocompleteInput } from '../primitives/BrandAutocompleteInput';
import { TaxonomySelector } from '../primitives/TaxonomySelector';
import { SizeProfileInput } from '../primitives/SizeProfileInput';
import type { SizeProfile } from '../../lib/sizes';
import { CropAdjustModal, type Bbox } from './CropAdjustModal';
import { cropImage } from '../../lib/cropImage';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_PHOTOS = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'processing' | 'pre-extract' | 'extracting' | 'review' | 'saving';

type PhotoStatus = 'pending' | 'scanning' | 'done' | 'error';

type PhotoJob = {
  id: string;
  thumbDataUrl: string;
  status: PhotoStatus;
  itemCount: number;
  errorMsg: string | null;
};

type PreExtractItemData = {
  tempId: string;
  name: string;
  category: string;
  croppedImage: string | null;
  bbox: Bbox | null;
  sourceImage: string;
  brandHint: string;
};

type EditableItem = {
  tempId: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  color: string | null;
  style: string | null;
  seasons: string[];
  occasions: string[];
  material: string | null;
  fit: string | null;
  pattern: string | null;
  neckline: string | null;
  care: string | null;
  formalityStyles: string[];
  notableDetails: string[];
  colorPalette: string[];
  colorNormalized: string | null;
  colorTemperature: string | null;
  warmthRating: number | null;
  croppedImage: string | null;
  bbox: Bbox | null;
  sourceImage: string | null;
  expanded: boolean;
  sizeProfile: SizeProfile | null;
};

interface BatchScanSheetProps {
  visible: boolean;
  onClose: () => void;
  onItemsSaved?: (items: Item[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function buildUploadImage(item: {
  sourceImage: string | null;
  bbox: Bbox | null;
  croppedImage: string | null;
}): Promise<string | null> {
  if (item.sourceImage && item.bbox) {
    const hqCrop = await cropImage(item.sourceImage, item.bbox, { maxDim: 1200, quality: 0.88 });
    if (hqCrop) return hqCrop;
  }
  return item.croppedImage;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BatchScanSheet({ visible, onClose, onItemsSaved }: BatchScanSheetProps) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [photoJobs, setPhotoJobs] = useState<PhotoJob[]>([]);
  const [preExtractItems, setPreExtractItems] = useState<PreExtractItemData[]>([]);
  const [allItems, setAllItems] = useState<EditableItem[]>([]);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const [extractedThumbs, setExtractedThumbs] = useState<string[]>([]);
  const [cropAdjustTarget, setCropAdjustTarget] = useState<{
    tempId: string;
    sourceImage: string;
    bbox: Bbox;
    itemName: string;
    scope: 'pre-extract' | 'review';
  } | null>(null);
  const sessionRef = useRef(0);

  const { user } = useAuth();
  const createItem = useCreateItem();

  const reset = useCallback(() => {
    sessionRef.current += 1;
    setPhase('idle');
    setPhotoJobs([]);
    setPreExtractItems([]);
    setAllItems([]);
    setExtractionProgress({ current: 0, total: 0 });
    setExtractedThumbs([]);
  }, []);

  const handleClose = useCallback(() => {
    if (phase === 'processing' || phase === 'saving' || phase === 'extracting') return;
    bottomSheetRef.current?.dismiss();
  }, [phase]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const canClose = phase === 'idle' || phase === 'review' || phase === 'pre-extract';

  // ── BottomSheetModal ──────────────────────────────────────────────────────────
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['92%'], []);

  useEffect(() => {
    bottomSheetRef.current?.present();
  }, []);

  const updateJob = (id: string, patch: Partial<PhotoJob>) => {
    setPhotoJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };

  const pickPhotos = async () => {
    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (status === 'denied') {
      showLibraryDeniedAlert();
      return;
    }
    if (status !== 'granted') {
      const { status: req } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (req !== 'granted') {
        showLibraryDeniedAlert();
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: MAX_PHOTOS,
    });

    if (result.canceled || !result.assets.length) return;

    await processPhotos(result.assets);
  };

  const processPhotos = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const session = sessionRef.current;

    const jobs: PhotoJob[] = assets.map((_, i) => ({
      id: `photo-${Date.now()}-${i}`,
      thumbDataUrl: '',
      status: 'pending',
      itemCount: 0,
      errorMsg: null,
    }));

    setPhotoJobs(jobs);
    setPhase('processing');

    const accumulated: PreExtractItemData[] = [];

    for (let i = 0; i < assets.length; i++) {
      if (sessionRef.current !== session) return;

      const asset = assets[i];
      const jobId = jobs[i].id;

      let compressed: { uri: string; dataUrl: string };
      try {
        compressed = await compressImageToDataUrl(
          { uri: asset.uri, width: asset.width ?? 1024, height: asset.height ?? 1024 },
          1024,
          0.8,
        );
      } catch {
        updateJob(jobId, { thumbDataUrl: asset.uri, status: 'error', errorMsg: 'Compression failed' });
        continue;
      }

      updateJob(jobId, { thumbDataUrl: compressed.dataUrl, status: 'scanning' });

      let poseItems: PoseScanItem[] = [];
      try {
        const base64 = compressed.dataUrl.includes(',')
          ? compressed.dataUrl.split(',')[1]
          : compressed.dataUrl;
        const poseResult = await scanVisionPoseDirect(base64);
        poseItems = poseResult.items ?? [];
      } catch {
        updateJob(jobId, { status: 'error', errorMsg: 'Scan failed — service may be unavailable' });
        continue;
      }

      if (sessionRef.current !== session) return;

      const preItems: PreExtractItemData[] = poseItems.map((poseItem) => ({
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: poseItem.name,
        category: poseItem.category,
        croppedImage: poseItem.croppedWebP
          ? `data:image/webp;base64,${poseItem.croppedWebP}`
          : null,
        bbox: poseItem.bbox_pct
          ? {
              x: poseItem.bbox_pct.x,
              y: poseItem.bbox_pct.y,
              width: poseItem.bbox_pct.width,
              height: poseItem.bbox_pct.height,
            }
          : null,
        sourceImage: compressed.dataUrl,
        brandHint: '',
      }));

      accumulated.push(...preItems);
      updateJob(jobId, { status: 'done', itemCount: preItems.length });
    }

    if (sessionRef.current !== session) return;

    if (accumulated.length === 0) {
      Alert.alert(
        'Nothing detected',
        'No clothing items were found in the selected photos. Try photos with better lighting or clearer clothing.',
        [{ text: 'OK', onPress: reset }],
      );
      return;
    }

    setPreExtractItems(accumulated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase('pre-extract');
  };

  const runExtraction = useCallback(async () => {
    if (preExtractItems.length === 0) return;
    const session = sessionRef.current;
    const total = preExtractItems.length;
    setPhase('extracting');
    setExtractionProgress({ current: 0, total });
    setExtractedThumbs([]);

    let completedCount = 0;

    const settled = await Promise.allSettled(
      preExtractItems.map(async (preItem, idx) => {
        if (sessionRef.current !== session) throw new Error('session_changed');

        const imageData = preItem.croppedImage ?? preItem.sourceImage;
        const otherItems = preExtractItems
          .filter((_, i) => i !== idx)
          .map((o) => `${o.name} (${o.category})`)
          .join(', ');

        const result = await scanItemDirect({
          imageData,
          outfitContext: otherItems || undefined,
          brandHint: preItem.brandHint || undefined,
        });

        if (sessionRef.current !== session) throw new Error('session_changed');

        completedCount += 1;
        setExtractionProgress({ current: completedCount, total });
        if (preItem.croppedImage) {
          setExtractedThumbs((prev) => [...prev, preItem.croppedImage!]);
        }

        return {
          result,
          croppedImage: preItem.croppedImage,
          bbox: preItem.bbox,
          sourceImage: preItem.sourceImage,
        };
      }),
    );

    if (sessionRef.current !== session) return;

    const extracted: EditableItem[] = [];
    for (const s of settled) {
      if (s.status !== 'fulfilled') continue;
      const { result, croppedImage, bbox, sourceImage } = s.value;
      extracted.push({
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: result.name || 'Unknown Item',
        brand: result.brand ?? null,
        category: result.category ?? null,
        subcategory: result.subcategory ?? null,
        color: result.color ?? null,
        style: result.style ?? null,
        seasons: result.seasons?.length ? result.seasons : [],
        occasions: result.occasions?.length ? result.occasions : [],
        material: result.material ?? null,
        fit: result.fit ?? null,
        pattern: result.pattern ?? null,
        neckline: result.neckline ?? null,
        care: result.care ?? null,
        formalityStyles: result.formalityStyles ?? [],
        notableDetails: result.notableDetails ?? [],
        colorPalette: result.colorPalette ?? [],
        colorNormalized: result.colorNormalized ?? null,
        colorTemperature: result.colorTemperature ?? null,
        warmthRating: result.warmthRating ?? null,
        croppedImage,
        bbox,
        sourceImage,
        expanded: false,
        sizeProfile: null,
      });
    }

    if (extracted.length === 0) {
      Alert.alert(
        'Extraction failed',
        "Couldn't extract details for any items. Please try again.",
        [{ text: 'OK', onPress: () => setPhase('pre-extract') }],
      );
      return;
    }

    setAllItems(extracted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('review');
  }, [preExtractItems]);

  const updateItem = useCallback((tempId: string, patch: Partial<EditableItem>) => {
    setAllItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = useCallback((tempId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAllItems((prev) => prev.filter((it) => it.tempId !== tempId));
  }, []);

  const updatePreExtractItem = useCallback((tempId: string, patch: Partial<PreExtractItemData>) => {
    setPreExtractItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)),
    );
  }, []);

  const removePreExtractItem = useCallback((tempId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPreExtractItems((prev) => {
      const next = prev.filter((it) => it.tempId !== tempId);
      if (next.length === 0) {
        setPhase('idle');
        setPhotoJobs([]);
      }
      return next;
    });
  }, []);

  const handleAdjustCrop = useCallback(
    (tempId: string) => {
      const item = allItems.find((it) => it.tempId === tempId);
      if (!item?.sourceImage || !item.bbox) return;
      setCropAdjustTarget({
        tempId,
        sourceImage: item.sourceImage,
        bbox: item.bbox,
        itemName: item.name,
        scope: 'review',
      });
    },
    [allItems],
  );

  const handlePreExtractAdjustCrop = useCallback(
    (tempId: string) => {
      const item = preExtractItems.find((it) => it.tempId === tempId);
      if (!item?.bbox) return;
      setCropAdjustTarget({
        tempId,
        sourceImage: item.sourceImage,
        bbox: item.bbox,
        itemName: item.name,
        scope: 'pre-extract',
      });
    },
    [preExtractItems],
  );

  const handleCropApply = useCallback(
    async (newBbox: Bbox) => {
      if (!cropAdjustTarget) return;
      const newCrop = await cropImage(cropAdjustTarget.sourceImage, newBbox, { maxDim: 800 });
      if (newCrop) {
        if (cropAdjustTarget.scope === 'pre-extract') {
          updatePreExtractItem(cropAdjustTarget.tempId, { croppedImage: newCrop, bbox: newBbox });
        } else {
          updateItem(cropAdjustTarget.tempId, { croppedImage: newCrop, bbox: newBbox });
        }
      }
      setCropAdjustTarget(null);
    },
    [cropAdjustTarget, updatePreExtractItem, updateItem],
  );

  const uploadImageToR2 = async (dataUrl: string): Promise<string> => {
    const commaIdx = dataUrl.indexOf(',');
    const meta = dataUrl.slice(0, commaIdx);
    const base64 = dataUrl.slice(commaIdx + 1);
    const mimeType = meta.slice(5).replace(';base64', '') || 'image/jpeg';
    const ext = mimeType.includes('webp') ? 'webp' : 'jpg';
    const fileName = `users/${user!.id}/items/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { presignedUrl, publicUrl } = await api
      .post<{ presignedUrl: string; publicUrl: string }>('/api/upload-url', {
        fileName,
        fileType: mimeType,
      })
      .then((r) => r.data);

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', mimeType);
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`R2 upload failed: ${xhr.status}`));
      xhr.onerror = () => reject(new Error('R2 upload network error'));
      xhr.send(bytes.buffer);
    });

    return publicUrl;
  };

  const handleSaveAll = useCallback(async () => {
    if (allItems.length === 0) return;
    if (!user) {
      console.error('User not authenticated');
      return;
    }
    const session = sessionRef.current;
    setPhase('saving');

    const savedItems: Item[] = [];

    for (const item of allItems) {
      const enrichmentFields = [item.brand, item.material, item.fit, item.subcategory];
      const needsDetails = enrichmentFields.filter(Boolean).length === 0;

      let imageUrl: string | null = null;
      const imageToUpload = await buildUploadImage(item);
      if (imageToUpload) {
        try {
          imageUrl = await uploadImageToR2(imageToUpload);
        } catch {
          imageUrl = imageToUpload;
        }
      }

      try {
        const created = await new Promise<Item>((resolve, reject) => {
          createItem.mutate(
            {
              name: item.name.trim() || 'Untitled',
              brand: item.brand || null,
              category: (item.category as ItemCategory) || null,
              subcategory: item.subcategory || null,
              color: item.color || null,
              style: item.style || null,
              seasons: item.seasons ?? [],
              occasions: item.occasions ?? [],
              colorNormalized: item.colorNormalized ?? null,
              colorTemperature: item.colorTemperature ?? null,
              warmthRating: item.warmthRating ?? null,
              material: item.material || null,
              fit: item.fit || null,
              pattern: item.pattern || null,
              neckline: item.neckline || null,
              care: item.care || null,
              formalityStyles: item.formalityStyles.length > 0 ? item.formalityStyles : undefined,
              notableDetails: item.notableDetails.length > 0 ? item.notableDetails : undefined,
              colorPalette: item.colorPalette.length > 0 ? item.colorPalette : undefined,
              imageUrl,
              sizeProfile: item.sizeProfile ?? null,
              needsDetails,
            },
            { onSuccess: resolve, onError: reject },
          );
        });
        if (sessionRef.current !== session) return;
        savedItems.push(created);
      } catch {
        // individual save failures are silently skipped
      }
    }

    if (sessionRef.current !== session) return;

    if (savedItems.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onItemsSaved?.(savedItems);
      onClose();
    } else {
      Alert.alert('Save failed', 'Could not save any items. Please try again.');
      setPhase('review');
    }
  }, [allItems, user, createItem, onItemsSaved, onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior={canClose ? 'close' : 'none'}
      />
    ),
    [canClose],
  );

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => {
      if (phase === 'pre-extract' && preExtractItems.length > 0) {
        return (
          <BottomSheetFooter {...props} bottomInset={insets.bottom}>
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={runExtraction}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles" size={20} color={colors.primaryForeground} />
                <Text style={styles.saveBtnText}>Extract Details</Text>
              </TouchableOpacity>
            </View>
          </BottomSheetFooter>
        );
      }

      if ((phase !== 'review' && phase !== 'saving') || allItems.length === 0) return null;
      return (
        <BottomSheetFooter {...props} bottomInset={insets.bottom}>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, phase === 'saving' && styles.saveBtnBusy]}
              onPress={handleSaveAll}
              disabled={phase === 'saving'}
              activeOpacity={0.85}
            >
              {phase === 'saving' ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Ionicons name="checkmark" size={20} color={colors.primaryForeground} />
              )}
              <Text style={styles.saveBtnText}>
                {phase === 'saving'
                  ? 'Adding to wardrobe…'
                  : allItems.length === 1
                  ? 'Add to wardrobe'
                  : `Add all ${allItems.length} to wardrobe`}
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetFooter>
      );
    },
    [phase, preExtractItems.length, allItems.length, runExtraction, handleSaveAll, insets.bottom],
  );

  const doneCount = photoJobs.filter((j) => j.status === 'done' || j.status === 'error').length;
  const totalCount = photoJobs.length;
  const errorCount = photoJobs.filter((j) => j.status === 'error').length;

  const headerTitle =
    phase === 'idle' ? 'Batch Scan'
    : phase === 'processing' ? `Scanning ${doneCount}/${totalCount} photos…`
    : phase === 'pre-extract'
      ? preExtractItems.length === 1
        ? 'Verify & add details'
        : `${preExtractItems.length} items — verify & add details`
    : phase === 'extracting' ? 'Extracting details…'
    : phase === 'saving' ? 'Adding to wardrobe…'
    : allItems.length === 1 ? '1 item detected'
    : `${allItems.length} items detected`;

  return (
    <>
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        footerComponent={renderFooter}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.sheetBackground}
        enablePanDownToClose={canClose}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.bodyContent}
          enableFooterMarginAdjustment
          stickyHeaderIndices={[0]}
        >
          {/* Sticky header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="images-outline" size={18} color={colors.primary} />
              <Text style={styles.headerTitle}>{headerTitle}</Text>
            </View>
            {canClose && (
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Body */}
          {phase === 'idle' && <IdleContent onPickPhotos={pickPhotos} />}

          {phase === 'processing' && (
            <ProcessingContent
              jobs={photoJobs}
              doneCount={doneCount}
              totalCount={totalCount}
              errorCount={errorCount}
            />
          )}

          {phase === 'pre-extract' && preExtractItems.length > 0 && (
            <PreExtractList
              items={preExtractItems}
              onUpdateItem={updatePreExtractItem}
              onRemoveItem={removePreExtractItem}
              onAdjustCrop={handlePreExtractAdjustCrop}
            />
          )}

          {phase === 'extracting' && (
            <ExtractingContent
              progress={extractionProgress}
              thumbs={extractedThumbs}
            />
          )}

          {(phase === 'review' || phase === 'saving') && allItems.length > 0 && (
            <ReviewContent
              items={allItems}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
              onAdjustCrop={handleAdjustCrop}
              disabled={phase === 'saving'}
            />
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

      <CropAdjustModal
        visible={cropAdjustTarget !== null}
        sourceImage={cropAdjustTarget?.sourceImage ?? ''}
        initialBbox={cropAdjustTarget?.bbox ?? null}
        itemName={cropAdjustTarget?.itemName ?? ''}
        onApply={handleCropApply}
        onCancel={() => setCropAdjustTarget(null)}
      />
    </>
  );
}

// ─── IdleContent ──────────────────────────────────────────────────────────────

function IdleContent({ onPickPhotos }: { onPickPhotos: () => void }) {
  return (
    <View style={idleStyles.container}>
      <Text style={idleStyles.subtitle}>
        Select up to {MAX_PHOTOS} photos from your library. AI will detect and extract every clothing item across all photos.
      </Text>
      <TouchableOpacity style={idleStyles.pickBtn} onPress={onPickPhotos} activeOpacity={0.85}>
        <Ionicons name="images-outline" size={22} color={colors.primaryForeground} />
        <Text style={idleStyles.pickBtnText}>Select Photos</Text>
      </TouchableOpacity>
      <Text style={idleStyles.hint}>
        Tip: use outfit photos or flat-lays for best results.
      </Text>
    </View>
  );
}

const idleStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.lg,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: typography.size.sm * 1.6,
    textAlign: 'center',
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  pickBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  hint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});

// ─── ProcessingContent ────────────────────────────────────────────────────────

function ProcessingContent({
  jobs,
  doneCount,
  totalCount,
  errorCount,
}: {
  jobs: PhotoJob[];
  doneCount: number;
  totalCount: number;
  errorCount: number;
}) {
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <View style={procStyles.container}>
      <View style={procStyles.progressSection}>
        <AnimatedProgressBar progress={progressPct} />
        <Text style={procStyles.progressLabel}>
          {doneCount} of {totalCount} photos
          {errorCount > 0 ? ` · ${errorCount} failed` : ''}
        </Text>
      </View>

      <View style={procStyles.photoGrid}>
        {jobs.map((job) => (
          <PhotoJobCard key={job.id} job={job} />
        ))}
      </View>
    </View>
  );
}

function PhotoJobCard({ job }: { job: PhotoJob }) {
  const statusIcon: Record<PhotoStatus, string> = {
    pending: 'ellipse-outline',
    scanning: 'search-outline',
    done: 'checkmark-circle',
    error: 'alert-circle',
  };
  const statusColor: Record<PhotoStatus, string> = {
    pending: colors.mutedForeground,
    scanning: colors.primary,
    done: colors.primary,
    error: colors.error,
  };
  const statusLabel: Record<PhotoStatus, string> = {
    pending: 'Waiting…',
    scanning: 'Scanning…',
    done: job.itemCount === 0 ? 'No items' : `${job.itemCount} item${job.itemCount === 1 ? '' : 's'}`,
    error: job.errorMsg ?? 'Failed',
  };

  return (
    <View style={procStyles.photoCard}>
      {job.thumbDataUrl ? (
        <Image source={{ uri: job.thumbDataUrl }} style={procStyles.thumb} resizeMode="cover" />
      ) : (
        <View style={[procStyles.thumb, procStyles.thumbPlaceholder]}>
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        </View>
      )}
      <View style={procStyles.photoStatus}>
        {job.status === 'scanning' ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons
            name={statusIcon[job.status] as any}
            size={16}
            color={statusColor[job.status]}
          />
        )}
        <Text style={[procStyles.statusText, { color: statusColor[job.status] }]} numberOfLines={1}>
          {statusLabel[job.status]}
        </Text>
      </View>
    </View>
  );
}

const procStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  progressSection: { gap: spacing.xs },
  progressLabel: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textAlign: 'right',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoCard: {
    width: '30%',
    gap: spacing.xs,
  },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: typography.size.xs,
    flex: 1,
  },
});

// ─── PreExtractList ───────────────────────────────────────────────────────────

function PreExtractList({
  items,
  onUpdateItem,
  onRemoveItem,
  onAdjustCrop,
}: {
  items: PreExtractItemData[];
  onUpdateItem: (id: string, patch: Partial<PreExtractItemData>) => void;
  onRemoveItem: (id: string) => void;
  onAdjustCrop: (id: string) => void;
}) {
  const brandSuggestions = useBrandSuggestions();

  return (
    <View style={preExtractStyles.container}>
      <Text style={preExtractStyles.hint}>
        Optionally enter the brand to improve AI accuracy, then tap Extract Details.
      </Text>
      {items.map((item, idx) => (
        <View key={item.tempId} style={{ zIndex: items.length - idx }}>
          <PreExtractCard
            item={item}
            brandSuggestions={brandSuggestions}
            onUpdate={(patch) => onUpdateItem(item.tempId, patch)}
            onRemove={() => onRemoveItem(item.tempId)}
            onAdjustCrop={() => onAdjustCrop(item.tempId)}
          />
        </View>
      ))}
    </View>
  );
}

function PreExtractCard({
  item,
  brandSuggestions,
  onUpdate,
  onRemove,
  onAdjustCrop,
}: {
  item: PreExtractItemData;
  brandSuggestions: string[];
  onUpdate: (patch: Partial<PreExtractItemData>) => void;
  onRemove: () => void;
  onAdjustCrop: () => void;
}) {
  return (
    <View style={preExtractCardStyles.card}>
      <View style={cardStyles.thumb}>
        {item.croppedImage ? (
          <Image source={{ uri: item.croppedImage }} style={cardStyles.thumbImg} resizeMode="cover" />
        ) : (
          <Ionicons name="shirt-outline" size={22} color={colors.mutedForeground} />
        )}
        {item.bbox && (
          <TouchableOpacity
            style={cardStyles.cropBtn}
            onPress={onAdjustCrop}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityLabel="Adjust crop"
          >
            <Ionicons name="crop-outline" size={11} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>

      <View style={preExtractCardStyles.content}>
        <Text style={preExtractCardStyles.itemName} numberOfLines={1}>{item.name}</Text>
        <BrandAutocompleteInput
          value={item.brandHint}
          onChangeText={(v) => onUpdate({ brandHint: v })}
          onSelect={(v) => onUpdate({ brandHint: v })}
          suggestions={brandSuggestions}
          placeholder="Brand (optional)"
        />
      </View>

      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Remove item"
      >
        <Ionicons name="trash-outline" size={18} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

const preExtractStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  hint: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: typography.size.sm * 1.5,
    marginBottom: spacing.xs,
  },
});

const preExtractCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  itemName: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },
});

// ─── ExtractingContent ────────────────────────────────────────────────────────

function ExtractingContent({
  progress,
  thumbs,
}: {
  progress: { current: number; total: number };
  thumbs: string[];
}) {
  const progressPct =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const statusMsg =
    progress.current === 0
      ? 'Analysing items in parallel…'
      : progress.current < progress.total
      ? 'Extracting styling details…'
      : 'Wrapping up…';

  return (
    <View style={extractStyles.container}>
      {thumbs.length > 0 ? (
        <View style={extractStyles.thumbRow}>
          {thumbs.map((uri, idx) => (
            <Image key={idx} source={{ uri }} style={extractStyles.thumb} resizeMode="cover" />
          ))}
        </View>
      ) : (
        <ActivityIndicator size="large" color={colors.primary} />
      )}

      <View style={extractStyles.progressRow}>
        <AnimatedProgressBar progress={progressPct} style={extractStyles.progressBar} />
        <Text style={extractStyles.progressCount}>
          {progress.current} / {progress.total}
        </Text>
      </View>

      <Text style={extractStyles.statusMsg}>{statusMsg}</Text>
    </View>
  );
}

const extractStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.lg,
  },
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    maxWidth: 280,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    borderWidth: 2,
    borderColor: colors.border,
  },
  progressRow: {
    width: '100%',
    maxWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBar: { flex: 1 },
  progressCount: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    minWidth: 32,
    textAlign: 'right',
  },
  statusMsg: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },
});

// ─── ReviewContent ────────────────────────────────────────────────────────────

function ReviewContent({
  items,
  onUpdateItem,
  onRemoveItem,
  onAdjustCrop,
  disabled,
}: {
  items: EditableItem[];
  onUpdateItem: (id: string, patch: Partial<EditableItem>) => void;
  onRemoveItem: (id: string) => void;
  onAdjustCrop: (id: string) => void;
  disabled: boolean;
}) {
  const brandSuggestions = useBrandSuggestions();

  return (
    <View style={reviewStyles.container}>
      <Text style={reviewStyles.hint}>
        AI has extracted clothing details — tap any item to review or add more.
      </Text>
      {items.map((item, idx) => (
        <View key={item.tempId} style={{ zIndex: items.length - idx }}>
          <ItemCard
            item={item}
            index={idx}
            disabled={disabled}
            brandSuggestions={brandSuggestions}
            onUpdate={(patch) => onUpdateItem(item.tempId, patch)}
            onRemove={() => onRemoveItem(item.tempId)}
            onAdjustCrop={() => onAdjustCrop(item.tempId)}
          />
        </View>
      ))}
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  hint: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: typography.size.sm * 1.5,
    marginBottom: spacing.xs,
  },
});

// ─── ItemCard ─────────────────────────────────────────────────────────────────

const SEASON_OPTIONS = [
  { label: 'Spring', value: 'spring' },
  { label: 'Summer', value: 'summer' },
  { label: 'Fall',   value: 'fall' },
  { label: 'Winter', value: 'winter' },
] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

function ItemCard({
  item,
  index,
  disabled,
  brandSuggestions,
  onUpdate,
  onRemove,
  onAdjustCrop,
}: {
  item: EditableItem;
  index: number;
  disabled: boolean;
  brandSuggestions: string[];
  onUpdate: (patch: Partial<EditableItem>) => void;
  onRemove: () => void;
  onAdjustCrop: () => void;
}) {
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onUpdate({ expanded: !item.expanded });
  };

  const categoryLabel = item.category
    ? (CATEGORY_LABELS[item.category as ItemCategory] ?? item.category)
    : null;
  const metaLine = [categoryLabel, item.subcategory, item.color].filter(Boolean).join(' · ');

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.row}>
        <View style={cardStyles.thumb}>
          {item.croppedImage ? (
            <Image source={{ uri: item.croppedImage }} style={cardStyles.thumbImg} resizeMode="cover" />
          ) : (
            <Ionicons name="shirt-outline" size={22} color={colors.mutedForeground} />
          )}
          {!disabled && item.sourceImage && item.bbox && (
            <TouchableOpacity
              style={cardStyles.cropBtn}
              onPress={onAdjustCrop}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityLabel="Adjust crop"
            >
              <Ionicons name="crop-outline" size={11} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={cardStyles.info} onPress={toggleExpand} activeOpacity={0.7}>
          <Text style={cardStyles.name} numberOfLines={1}>{item.name}</Text>
          {metaLine.length > 0 && (
            <Text style={cardStyles.meta} numberOfLines={1}>{metaLine}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleExpand} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={item.expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRemove}
          disabled={disabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      {item.expanded && (
        <View style={cardStyles.editForm}>
          <Field label="Name">
            <TextInput
              style={cardStyles.input}
              value={item.name}
              onChangeText={(v) => onUpdate({ name: v })}
              autoCapitalize="words"
              editable={!disabled}
            />
          </Field>

          <Field label="Brand">
            <BrandAutocompleteInput
              value={item.brand ?? ''}
              onChangeText={(v) => onUpdate({ brand: v || null })}
              onSelect={(v) => onUpdate({ brand: v || null })}
              suggestions={brandSuggestions}
              placeholder="e.g. Uniqlo"
              style={disabled ? cardStyles.inputDisabled : undefined}
            />
          </Field>

          <Field label="Colour">
            <TextInput
              style={cardStyles.input}
              value={item.color ?? ''}
              onChangeText={(v) => onUpdate({ color: v || null })}
              autoCapitalize="words"
              placeholder="e.g. Navy Blue"
              placeholderTextColor={colors.mutedForeground}
              editable={!disabled}
            />
          </Field>

          <TaxonomySelector
            category={item.category ?? null}
            subcategory={item.subcategory ?? null}
            style={item.style ?? null}
            onCategoryChange={(v) => onUpdate({ category: v || null, subcategory: null, style: null })}
            onSubcategoryChange={(v) => onUpdate({ subcategory: v || null, style: null })}
            onStyleChange={(v) => onUpdate({ style: v || null })}
            disabled={disabled}
          />

          <Field label="Season">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={cardStyles.pillRow}>
                {SEASON_OPTIONS.map(({ label, value }) => {
                  const active = (item.seasons ?? []).includes(value);
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[cardStyles.pill, active && cardStyles.pillActive]}
                      onPress={() => {
                        const cur = item.seasons ?? [];
                        onUpdate({
                          seasons: active ? cur.filter((s) => s !== value) : [...cur, value],
                        });
                      }}
                      disabled={disabled}
                    >
                      <Text style={[cardStyles.pillText, active && cardStyles.pillTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </Field>

          <View style={cardStyles.twoCol}>
            <View style={{ flex: 1 }}>
              <Field label="Fit">
                <TextInput
                  style={cardStyles.input}
                  value={item.fit ?? ''}
                  onChangeText={(v) => onUpdate({ fit: v || null })}
                  placeholder="e.g. Slim"
                  placeholderTextColor={colors.mutedForeground}
                  editable={!disabled}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Material">
                <TextInput
                  style={cardStyles.input}
                  value={item.material ?? ''}
                  onChangeText={(v) => onUpdate({ material: v || null })}
                  placeholder="e.g. Cotton"
                  placeholderTextColor={colors.mutedForeground}
                  editable={!disabled}
                />
              </Field>
            </View>
          </View>

          <SizeProfileInput
            category={item.category}
            subcategory={item.subcategory}
            style={item.style}
            formalityStyles={item.formalityStyles}
            value={item.sizeProfile}
            onChange={(p) => onUpdate({ sizeProfile: p })}
          />
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbImg: { width: '100%', height: '100%' },
  cropBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 3 },
  name: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  meta: { fontSize: typography.size.sm, color: colors.mutedForeground },
  editForm: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  inputDisabled: { opacity: 0.5 },
  pillRow: { flexDirection: 'row', gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  pillTextActive: { color: colors.primaryForeground },
  twoCol: { flexDirection: 'row', gap: spacing.md },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showLibraryDeniedAlert() {
  Alert.alert(
    'Photo library access needed',
    'Styled needs photo library access to batch scan items. Enable it in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
        },
      },
    ],
  );
}

// ─── Sheet styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.background,
  },
  handle: {
    backgroundColor: colors.border,
    width: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  bodyContent: { paddingBottom: spacing.xl },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
  },
  saveBtnBusy: { opacity: 0.7 },
  saveBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});
