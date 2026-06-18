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
  AppState,
  type AppStateStatus,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetFooter,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useCameraLaunch, useLibraryLaunch } from '../../hooks/useCameraLaunch';
import {
  useScanVisionPose,
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
import { uploadImageToR2 } from '../../lib/uploadImage';
import { AnimatedProgressBar } from '../primitives/AnimatedProgressBar';
import { track } from '../../lib/analytics';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'scanning' | 'pre-extract' | 'extracting' | 'review' | 'saving';

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
  expanded: boolean;
  sizeProfile: SizeProfile | null;
  bbox: Bbox | null;
  sourceImage: string | null;
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

interface ScanItemSheetProps {
  visible: boolean;
  onClose: () => void;
  onItemsSaved?: (items: Item[]) => void;
  autoLaunch?: 'camera' | 'library';
}

const SCAN_DRAFT_KEY = 'scan_review_draft';

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

export function ScanItemSheet({ visible, onClose, onItemsSaved, autoLaunch }: ScanItemSheetProps) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<EditableItem[]>([]);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const [extractedThumbs, setExtractedThumbs] = useState<string[]>([]);
  const sessionRef = useRef(0);
  const [preExtractItems, setPreExtractItems] = useState<PreExtractItemData[]>([]);
  const [cropAdjustTarget, setCropAdjustTarget] = useState<{
    tempId: string;
    sourceImage: string;
    bbox: Bbox;
    itemName: string;
    scope: 'pre-extract' | 'review';
  } | null>(null);

  const { user } = useAuth();
  const poseScan = useScanVisionPose();
  const createItem = useCreateItem();
  const launchCamera = useCameraLaunch();
  const launchLibrary = useLibraryLaunch();
  const brandSuggestions = useBrandSuggestions();

  // ── Draft persistence ────────────────────────────────────────────────────────

  // On mount: offer to restore a saved draft if one exists
  useEffect(() => {
    AsyncStorage.getItem(SCAN_DRAFT_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved: EditableItem[] = JSON.parse(raw);
        if (!saved.length) return;
        Alert.alert(
          'Resume previous scan?',
          `You have ${saved.length} item${saved.length !== 1 ? 's' : ''} from a previous scan. Continue editing?`,
          [
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => AsyncStorage.removeItem(SCAN_DRAFT_KEY),
            },
            {
              text: 'Resume',
              onPress: () => {
                setDetectedItems(saved);
                setPhase('review');
              },
            },
          ],
        );
      } catch { AsyncStorage.removeItem(SCAN_DRAFT_KEY); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save review state to AsyncStorage whenever the app backgrounds during review
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const detectedItemsRef = useRef(detectedItems);
  detectedItemsRef.current = detectedItems;

  useEffect(() => {
    const handler = (nextState: AppStateStatus) => {
      if (nextState === 'background' && phaseRef.current === 'review' && detectedItemsRef.current.length > 0) {
        // Persist metadata only — skip croppedImage to avoid large writes
        const slim = detectedItemsRef.current.map(({ croppedImage: _img, ...rest }) => rest);
        AsyncStorage.setItem(SCAN_DRAFT_KEY, JSON.stringify(slim));
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, []);

  // ── BottomSheetModal ──────────────────────────────────────────────────────────
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['90%'], []);

  useEffect(() => {
    if (!autoLaunch) {
      bottomSheetRef.current?.present();
      return;
    }
    let active = true;
    (async () => {
      const captured =
        autoLaunch === 'camera'
          ? await launchCamera({ maxDim: 1600, compress: 0.85 })
          : await launchLibrary({ maxDim: 1600, compress: 0.85 });
      if (!active) return;
      if (!captured) { onClose(); return; }
      setImageDataUrl(captured.dataUrl);
      setPhase('scanning');
      bottomSheetRef.current?.present();
      await runPoseScan(captured.uri, captured.dataUrl);
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canClose = phase === 'idle' || phase === 'review' || phase === 'pre-extract';

  const headerTitle =
    phase === 'idle' ? 'Add to Wardrobe'
    : phase === 'scanning' ? 'Scanning outfit…'
    : phase === 'pre-extract'
      ? preExtractItems.length === 1
        ? 'Verify & add details'
        : `${preExtractItems.length} items — verify & add details`
    : phase === 'extracting' ? 'Extracting details…'
    : phase === 'saving' ? 'Adding to wardrobe…'
    : detectedItems.length === 1 ? '1 item detected'
    : `${detectedItems.length} items detected`;

  const handleClose = useCallback(() => {
    if (phase === 'saving' || phase === 'extracting') return;
    bottomSheetRef.current?.dismiss();
  }, [phase]);

  const handleDismiss = useCallback(() => {
    AsyncStorage.removeItem(SCAN_DRAFT_KEY);
    poseScan.reset();
    setPreExtractItems([]);
    onClose();
  }, [poseScan, onClose]);


  const handleSaveAll = async () => {
    if (detectedItems.length === 0) return;
    if (!user) {
      console.error('User not authenticated');
      return;
    }
    const session = sessionRef.current;
    setPhase('saving');

    const savedItems: Item[] = [];

    for (const item of detectedItems) {
      // Progressive profiling: flag items whose enrichment fields are sparse so
      // the backend (and future UI prompts) know to ask for more details later.
      const enrichmentFields = [item.brand, item.material, item.fit, item.subcategory];
      const needsDetails = enrichmentFields.filter(Boolean).length === 0;

      let imageUrl: string | null = null;
      const imageToUpload = await buildUploadImage(item);
      if (imageToUpload) {
        try {
          imageUrl = await uploadImageToR2(imageToUpload, user!.id);
        } catch {
          // R2 upload failed — fall back to storing the base64 data URL directly
          // so the item always has a photo even if cloud storage is unavailable.
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
              seasons: item.seasons.length > 0 ? item.seasons : [],
              occasions: item.occasions.length > 0 ? item.occasions : [],
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
        // individual failures are silently skipped
      }
    }

    if (sessionRef.current !== session) return;

    if (savedItems.length > 0) {
      AsyncStorage.removeItem(SCAN_DRAFT_KEY);
      track('wardrobe_items_added', { item_count: savedItems.length });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onItemsSaved?.(savedItems);
      onClose();
    } else {
      Alert.alert('Save failed', 'Could not save any items. Please try again.');
      setPhase('review');
    }
  };

  const runExtraction = async (
    preItems: PreExtractItemData[],
    fullImageDataUrl: string,
    session: number,
  ) => {
    const total = preItems.length;
    setPhase('extracting');
    setExtractionProgress({ current: 0, total });
    setExtractedThumbs([]);

    let completedCount = 0;

    const settled = await Promise.allSettled(
      preItems.map(async (preItem, idx) => {
        if (sessionRef.current !== session) throw new Error('session_changed');

        const imageData = preItem.croppedImage ?? fullImageDataUrl;
        const otherItems = preItems
          .filter((_, i) => i !== idx)
          .map((other) => `${other.name} (${other.category})`)
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

        return { result, croppedImage: preItem.croppedImage, bbox: preItem.bbox };
      }),
    );

    if (sessionRef.current !== session) return;

    const extracted: EditableItem[] = [];
    for (const s of settled) {
      if (s.status !== 'fulfilled') continue;
      const { result, croppedImage, bbox } = s.value;
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
        expanded: false,
        sizeProfile: null,
        bbox,
        sourceImage: fullImageDataUrl,
      });
    }

    if (extracted.length === 0) {
      Alert.alert(
        'Extraction failed',
        "Couldn't extract details for any items. Please try again.",
        [{ text: 'OK', onPress: () => { setPhase('idle'); setImageDataUrl(null); } }],
      );
      return;
    }

    setDetectedItems(extracted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('review');
  };

  const handleStartExtraction = useCallback(async () => {
    if (preExtractItems.length === 0 || !imageDataUrl) return;
    const session = sessionRef.current;
    await runExtraction(preExtractItems, imageDataUrl, session);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preExtractItems, imageDataUrl]);

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
                onPress={handleStartExtraction}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles" size={20} color={colors.primaryForeground} />
                <Text style={styles.saveBtnText}>Extract Details</Text>
              </TouchableOpacity>
            </View>
          </BottomSheetFooter>
        );
      }

      if ((phase !== 'review' && phase !== 'saving') || detectedItems.length === 0) return null;
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
                  : detectedItems.length === 1
                  ? 'Add to wardrobe'
                  : `Add all ${detectedItems.length} to wardrobe`}
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetFooter>
      );
    },
    [phase, preExtractItems.length, detectedItems.length, handleStartExtraction, handleSaveAll, insets.bottom],
  );

  const pickImage = async (source: 'camera' | 'library') => {
    // Both hooks handle permission checks, denial alerts, and compression internally
    const captured =
      source === 'camera'
        ? await launchCamera({ maxDim: 1600, compress: 0.85 })
        : await launchLibrary({ maxDim: 1600, compress: 0.85 });

    if (!captured) return;
    track('item_scan_started', { source });

    setImageDataUrl(captured.dataUrl);
    // Pass the local file URI so runPoseScan can downscale without re-encoding the data URL
    await runPoseScan(captured.uri, captured.dataUrl);
  };

  const runPoseScan = async (sourceUri: string, displayDataUrl: string) => {
    const session = sessionRef.current;
    setPhase('scanning');

    // Downscale to 512 px for pose detection — bounding boxes don't benefit from higher res
    // and this roughly halves token cost at the OpenAI Vision "low" detail tier.
    const poseFrame = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 512 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    const base64 = poseFrame.base64!;

    try {
      const result = await poseScan.mutateAsync({ imageBase64: base64 });
      if (sessionRef.current !== session) return;

      if (!result.items || result.items.length === 0) {
        Alert.alert(
          'No clothing detected',
          'Try a full-body photo with better lighting, or add items manually.',
          [{ text: 'OK', onPress: () => { setPhase('idle'); setImageDataUrl(null); } }],
        );
        return;
      }

      // Build per-item pre-extract data and let the user verify crops + add brand hints
      const preItems: PreExtractItemData[] = result.items.map((poseItem) => ({
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: poseItem.name,
        category: poseItem.category,
        croppedImage: poseItem.croppedWebP
          ? `data:image/webp;base64,${poseItem.croppedWebP}`
          : null,
        bbox: poseItem.bbox_pct
          ? { x: poseItem.bbox_pct.x, y: poseItem.bbox_pct.y, width: poseItem.bbox_pct.width, height: poseItem.bbox_pct.height }
          : null,
        sourceImage: displayDataUrl,
        brandHint: '',
      }));

      setPreExtractItems(preItems);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhase('pre-extract');
    } catch (err: any) {
      if (sessionRef.current !== session) return;
      Alert.alert(
        'Scan failed',
        err?.message || 'Something went wrong. Please try again.',
        [{ text: 'OK', onPress: () => { setPhase('idle'); setImageDataUrl(null); } }],
      );
    }
  };

  const updateItem = useCallback((tempId: string, patch: Partial<EditableItem>) => {
    setDetectedItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)),
    );
  }, []);

  const removeItem = useCallback((tempId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDetectedItems((prev) => prev.filter((it) => it.tempId !== tempId));
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
        setImageDataUrl(null);
      }
      return next;
    });
  }, []);

  const handleAdjustCrop = useCallback((tempId: string) => {
    const item = detectedItems.find((it) => it.tempId === tempId);
    if (!item?.sourceImage || !item.bbox) return;
    setCropAdjustTarget({ tempId, sourceImage: item.sourceImage, bbox: item.bbox, itemName: item.name, scope: 'review' });
  }, [detectedItems]);

  const handlePreExtractAdjustCrop = useCallback((tempId: string) => {
    const item = preExtractItems.find((it) => it.tempId === tempId);
    if (!item?.bbox) return;
    setCropAdjustTarget({ tempId, sourceImage: item.sourceImage, bbox: item.bbox, itemName: item.name, scope: 'pre-extract' });
  }, [preExtractItems]);

  const handleCropApply = useCallback(async (newBbox: Bbox) => {
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
  }, [cropAdjustTarget, updatePreExtractItem, updateItem]);

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
              <Ionicons name="sparkles" size={18} color={colors.primary} />
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
          {phase === 'idle' && <IdleContent onPickImage={pickImage} />}

          {(phase === 'scanning' || phase === 'extracting') && (
            <ScanProgress
              phase={phase}
              imageDataUrl={imageDataUrl}
              extractionProgress={extractionProgress}
              extractedThumbs={extractedThumbs}
            />
          )}

          {phase === 'pre-extract' && preExtractItems.length > 0 && (
            <PreExtractList
              items={preExtractItems}
              brandSuggestions={brandSuggestions}
              onUpdateItem={updatePreExtractItem}
              onRemoveItem={removePreExtractItem}
              onAdjustCrop={handlePreExtractAdjustCrop}
            />
          )}

          {(phase === 'review' || phase === 'saving') && detectedItems.length > 0 && (
            <ReviewList
              items={detectedItems}
              brandSuggestions={brandSuggestions}
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

function IdleContent({ onPickImage }: { onPickImage: (src: 'camera' | 'library') => void }) {
  return (
    <View style={idleStyles.container}>
      <Text style={idleStyles.subtitle}>
        Snap your outfit — AI detects every item you're wearing, including accessories.
      </Text>
      <TouchableOpacity style={idleStyles.option} onPress={() => onPickImage('camera')}>
        <View style={idleStyles.iconBox}>
          <Ionicons name="camera-outline" size={22} color={colors.primary} />
        </View>
        <View style={idleStyles.optionText}>
          <Text style={idleStyles.optionTitle}>Take Photo</Text>
          <Text style={idleStyles.optionSub}>Snap your outfit or items</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>
      <TouchableOpacity style={idleStyles.option} onPress={() => onPickImage('library')}>
        <View style={idleStyles.iconBox}>
          <Ionicons name="image-outline" size={22} color={colors.primary} />
        </View>
        <View style={idleStyles.optionText}>
          <Text style={idleStyles.optionTitle}>Choose from Library</Text>
          <Text style={idleStyles.optionSub}>Select from camera roll</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>
    </View>
  );
}

const idleStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: typography.size.sm * 1.5,
    marginBottom: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1 },
  optionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  optionSub: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});

// ─── ScanProgress ─────────────────────────────────────────────────────────────

const SCAN_MESSAGES = [
  'Analyzing your outfit…',
  'Identifying clothing items…',
  'Detecting colors & patterns…',
  'Reading style details…',
  'Almost there…',
];

function useCyclingScanStatus(active: boolean): string {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) { setIdx(0); return; }
    const id = setInterval(() => setIdx((i) => (i + 1) % SCAN_MESSAGES.length), 2500);
    return () => clearInterval(id);
  }, [active]);
  return SCAN_MESSAGES[idx];
}

function ScanProgress({
  phase,
  imageDataUrl,
  extractionProgress,
  extractedThumbs,
}: {
  phase: 'scanning' | 'extracting';
  imageDataUrl: string | null;
  extractionProgress: { current: number; total: number };
  extractedThumbs: string[];
}) {
  const statusMsg = useCyclingScanStatus(phase === 'scanning');
  const progressNum =
    extractionProgress.total > 0
      ? Math.round((extractionProgress.current / extractionProgress.total) * 100)
      : 0;

  return (
    <View style={scanStyles.container}>
      {imageDataUrl && (
        <View style={scanStyles.previewBox}>
          <Image
            source={{ uri: imageDataUrl }}
            style={scanStyles.preview}
            resizeMode="cover"
          />
          <View style={scanStyles.previewDim} />
        </View>
      )}

      {phase === 'scanning' && (
        <View style={scanStyles.statusBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={scanStyles.statusTitle}>Detecting items…</Text>
          <Text style={scanStyles.statusSub}>{statusMsg}</Text>
          <View style={scanStyles.stepRow}>
            <View style={[scanStyles.stepDot, scanStyles.stepDotActive]} />
            <View style={scanStyles.stepLine} />
            <View style={scanStyles.stepDot} />
          </View>
          <View style={scanStyles.stepLabels}>
            <Text style={[scanStyles.stepLabel, scanStyles.stepLabelActive]}>Detect</Text>
            <Text style={scanStyles.stepLabel}>Extract</Text>
          </View>
        </View>
      )}

      {phase === 'extracting' && (
        <View style={scanStyles.statusBox}>
          {extractedThumbs.length > 0 ? (
            <View style={scanStyles.thumbRow}>
              {extractedThumbs.map((uri, idx) => (
                <Image key={idx} source={{ uri }} style={scanStyles.thumb} resizeMode="cover" />
              ))}
            </View>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}

          <View style={scanStyles.progressContainer}>
            <AnimatedProgressBar progress={progressNum} style={scanStyles.progressTrackFlex} />
            <Text style={scanStyles.progressText}>
              {extractionProgress.current} / {extractionProgress.total}
            </Text>
          </View>
          <Text style={scanStyles.statusSub}>
            {extractionProgress.current === 0
              ? 'Analysing items in parallel…'
              : extractionProgress.current < extractionProgress.total
              ? 'Extracting styling details…'
              : 'Wrapping up…'}
          </Text>

          <View style={scanStyles.stepRow}>
            <View style={[scanStyles.stepDot, scanStyles.stepDotDone]}>
              <Ionicons name="checkmark" size={10} color={colors.primaryForeground} />
            </View>
            <View style={[scanStyles.stepLine, scanStyles.stepLineDone]} />
            <View style={[scanStyles.stepDot, scanStyles.stepDotActive]} />
          </View>
          <View style={scanStyles.stepLabels}>
            <Text style={scanStyles.stepLabel}>Detect</Text>
            <Text style={[scanStyles.stepLabel, scanStyles.stepLabelActive]}>Extract</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const scanStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
  previewBox: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    height: 160,
    backgroundColor: colors.muted,
  },
  preview: { width: '100%', height: '100%' },
  previewDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  statusBox: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md },
  statusTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  statusSub: { fontSize: typography.size.sm, color: colors.mutedForeground },
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
  progressContainer: {
    width: '100%',
    maxWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrackFlex: {
    flex: 1,
  },
  progressText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    minWidth: 32,
    textAlign: 'right',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { borderColor: colors.primary, backgroundColor: colors.accent },
  stepDotDone: { borderColor: colors.primary, backgroundColor: colors.primary },
  stepLine: { width: 40, height: 2, backgroundColor: colors.border, borderRadius: 1 },
  stepLineDone: { backgroundColor: colors.primary },
  stepLabels: {
    flexDirection: 'row',
    gap: spacing.sm + 40 + spacing.sm,
  },
  stepLabel: { fontSize: typography.size.xs, color: colors.mutedForeground },
  stepLabelActive: { color: colors.primary, fontWeight: typography.weight.semibold },
});

// ─── PreExtractList ───────────────────────────────────────────────────────────

function PreExtractList({
  items,
  brandSuggestions,
  onUpdateItem,
  onRemoveItem,
  onAdjustCrop,
}: {
  items: PreExtractItemData[];
  brandSuggestions: string[];
  onUpdateItem: (id: string, patch: Partial<PreExtractItemData>) => void;
  onRemoveItem: (id: string) => void;
  onAdjustCrop: (id: string) => void;
}) {
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
      {/* Thumbnail with optional crop-adjust button */}
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

      {/* Right column: detected name + brand input */}
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

      {/* Remove button */}
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

// ─── ReviewList ───────────────────────────────────────────────────────────────

function ReviewList({
  items,
  brandSuggestions,
  onUpdateItem,
  onRemoveItem,
  onAdjustCrop,
  disabled,
}: {
  items: EditableItem[];
  brandSuggestions: string[];
  onUpdateItem: (id: string, patch: Partial<EditableItem>) => void;
  onRemoveItem: (id: string) => void;
  onAdjustCrop: (id: string) => void;
  disabled: boolean;
}) {
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
      {/* Collapsed row */}
      <View style={cardStyles.row}>
        {/* Thumbnail */}
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

        {/* Info — tappable to toggle expand */}
        <TouchableOpacity style={cardStyles.info} onPress={toggleExpand} activeOpacity={0.7}>
          <Text style={cardStyles.name} numberOfLines={1}>{item.name}</Text>
          {metaLine.length > 0 && (
            <Text style={cardStyles.meta} numberOfLines={1}>{metaLine}</Text>
          )}
        </TouchableOpacity>

        {/* Actions */}
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

      {/* Expanded edit form */}
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

          <View style={cardStyles.fieldRow}>
            <View style={{ flex: 1 }}>
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
                            onUpdate({ seasons: active ? cur.filter((s) => s !== value) : [...cur, value] });
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
            </View>
          </View>

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
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  twoCol: { flexDirection: 'row', gap: spacing.md },
});

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
