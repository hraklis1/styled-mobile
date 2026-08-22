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
import { uploadImageToR2 } from '../../lib/uploadImage';
import { tryRequestCutout } from '../../lib/cutout';
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
import { CATEGORY_LABELS, SEASON_OPTIONS, SEASON_LABELS, type Item, type ItemCategory, type SleeveLength } from '../../types/item';
import { BrandAutocompleteInput } from '../primitives/BrandAutocompleteInput';
import { TaxonomySelector } from '../primitives/TaxonomySelector';
import { SizeProfileInput } from '../primitives/SizeProfileInput';
import type { SizeProfile } from '../../lib/sizes';
import { type Bbox } from './CropAdjustModal';
import { CutoutReviewThumb } from './CutoutReviewThumb';
import { cropImage } from '../../lib/cropImage';
import { mapWithConcurrency } from '../../lib/asyncPool';
import { track } from '../../lib/analytics';
import { resolveExtractedIdentity } from '../../lib/scan-review';
import * as Haptics from 'expo-haptics';
import {
  ScanReviewWorkspace,
  type ScanReviewPiece,
} from './scan-review-workspace';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_PHOTOS = 10;

// Cap simultaneous detail-extraction calls so a large batch doesn't fan out into
// dozens of concurrent LLM-vision requests (provider rate limits / socket timeouts).
const EXTRACTION_CONCURRENCY = 4;

// Photos scanned at once. Kept below EXTRACTION_CONCURRENCY because each photo
// fans out into its own segmentation and labelling calls, and the server-side
// scan rate limit is 20/min per user — 3 keeps a full 10-photo batch inside it.
const PHOTO_SCAN_CONCURRENCY = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'processing' | 'pre-extract' | 'extracting' | 'review' | 'saving';

type PhotoStatus = 'pending' | 'scanning' | 'done' | 'error';

type PhotoJob = {
  id: string;
  asset: ImagePicker.ImagePickerAsset;
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
  /** Background-removed thumbnail from the scan, if segmentation produced one. */
  cutoutImage: string | null;
  /** True when the user selects the cutout as the initial cover. */
  useCutout: boolean;
  targetImage: string | null;
  bbox: Bbox | null;
  previewBbox: Bbox | null;
  sourceImage: string;
  brandHint: string;
  /** Prevent detail extraction from replacing a correction the user made. */
  nameEdited: boolean;
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
  sleeveLength: SleeveLength | null;
  care: string | null;
  notableDetails: string[];
  colorPalette: string[];
  colorNormalized: string | null;
  colorTemperature: string | null;
  warmthRating: number | null;
  croppedImage: string | null;
  cutoutImage: string | null;
  /** True when the user selects the cutout as the initial cover. */
  useCutout: boolean;
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

function normalizePoseBbox(
  bbox: PoseScanItem['bbox_pct'] | PoseScanItem['targetBbox_pct'] | PoseScanItem['previewBbox_pct'] | null | undefined,
): Bbox | null {
  if (!bbox) return null;
  return {
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
  };
}

async function buildPreExtractItemFromPose(
  poseItem: PoseScanItem,
  sourceImage: string,
): Promise<PreExtractItemData> {
  const targetBbox = normalizePoseBbox(poseItem.targetBbox_pct ?? poseItem.bbox_pct);
  const previewBbox = normalizePoseBbox(poseItem.previewBbox_pct) ?? targetBbox;
  // Crop locally from the full-resolution capture rather than the server's
  // preview, which is cut from the 512px frame sent for pose detection and
  // looks soft once stretched to fill the review hero.
  const serverPreview = poseItem.croppedWebP
    ? `data:image/webp;base64,${poseItem.croppedWebP}`
    : null;
  const previewImage = (previewBbox ? await cropImage(sourceImage, previewBbox, { maxDim: 800 }) : null)
    ?? serverPreview;
  const targetImage = targetBbox
    ? await cropImage(sourceImage, targetBbox, { maxDim: 800 })
    : previewImage;

  return {
    tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: poseItem.name,
    category: poseItem.category,
    croppedImage: previewImage,
    // Arrives with the scan itself — the pipeline reuses a mask it already
    // computed, so there's no extra request and nothing to wait on here.
    cutoutImage: poseItem.cutoutWebP ? `data:image/webp;base64,${poseItem.cutoutWebP}` : null,
    useCutout: false,
    targetImage,
    bbox: targetBbox,
    previewBbox,
    sourceImage,
    brandHint: '',
    nameEdited: false,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BatchScanSheet({ visible, onClose, onItemsSaved }: BatchScanSheetProps) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [photoJobs, setPhotoJobs] = useState<PhotoJob[]>([]);
  const [preExtractItems, setPreExtractItems] = useState<PreExtractItemData[]>([]);
  const [allItems, setAllItems] = useState<EditableItem[]>([]);
  const [failedItems, setFailedItems] = useState<PreExtractItemData[]>([]);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const [extractedThumbs, setExtractedThumbs] = useState<string[]>([]);
  const sessionRef = useRef(0);
  const reviewTrackedRef = useRef(false);
  // Guards the handoff from the picker sheet to the full-screen scan
  // workspace: set right before a programmatic `.dismiss()` so `handleDismiss`
  // treats it as a no-op instead of tearing down the whole batch. Genuine user
  // dismissals never set it.
  const suppressNextDismissRef = useRef(false);
  const hasStartedRef = useRef(false);

  const { user } = useAuth();
  const createItem = useCreateItem();
  const brandSuggestions = useBrandSuggestions();

  const reset = useCallback(() => {
    sessionRef.current += 1;
    setPhase('idle');
    setPhotoJobs([]);
    setPreExtractItems([]);
    setAllItems([]);
    setFailedItems([]);
    setExtractionProgress({ current: 0, total: 0 });
    setExtractedThumbs([]);
    reviewTrackedRef.current = false;
  }, []);

  useEffect(() => {
    if (phase !== 'pre-extract' || reviewTrackedRef.current) return;
    reviewTrackedRef.current = true;
    track('closet_scan_review_started', { mode: 'batch', item_count: preExtractItems.length });
  }, [phase, preExtractItems.length]);

  const handleClose = useCallback(() => {
    if (phase === 'processing' || phase === 'saving' || phase === 'extracting') return;
    bottomSheetRef.current?.dismiss();
  }, [phase]);

  const handleDismiss = useCallback(() => {
    if (suppressNextDismissRef.current) {
      suppressNextDismissRef.current = false;
      return;
    }
    onClose();
  }, [onClose]);

  // The workspace's "Discard scan" has no sheet dismissal to ride on — the
  // picker was dismissed the moment scanning began — so it ends the batch
  // directly, cancelling anything still in flight.
  const handleWorkspaceDiscard = useCallback(() => {
    sessionRef.current += 1;
    onClose();
  }, [onClose]);

  const canClose = phase === 'idle' || phase === 'review' || phase === 'pre-extract';

  // ── BottomSheetModal ──────────────────────────────────────────────────────────
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['92%'], []);

  useEffect(() => {
    bottomSheetRef.current?.present();
  }, []);

  // If the batch bounces back to `idle` after having started (nothing
  // detected, last piece removed), re-present the picker — it was dismissed
  // when scanning began and won't come back on its own.
  useEffect(() => {
    if (phase === 'idle' && hasStartedRef.current) {
      bottomSheetRef.current?.present();
    }
  }, [phase]);

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

  // Compress + pose-scan a single photo job, updating its status as it goes.
  // Returns detected items, or null if compression/scan failed (job marked 'error').
  const scanPhotoJob = async (
    job: PhotoJob,
    session: number,
  ): Promise<PreExtractItemData[] | null> => {
    const { asset } = job;

    let compressed: { uri: string; dataUrl: string };
    try {
      compressed = await compressImageToDataUrl(
        { uri: asset.uri, width: asset.width ?? 1024, height: asset.height ?? 1024 },
        1024,
        0.8,
      );
    } catch {
      updateJob(job.id, { thumbDataUrl: asset.uri, status: 'error', errorMsg: 'Compression failed' });
      return null;
    }

    updateJob(job.id, { thumbDataUrl: compressed.dataUrl, status: 'scanning' });

    let poseItems: PoseScanItem[] = [];
    try {
      const base64 = compressed.dataUrl.includes(',')
        ? compressed.dataUrl.split(',')[1]
        : compressed.dataUrl;
      const poseResult = await scanVisionPoseDirect(base64);
      poseItems = poseResult.items ?? [];
    } catch {
      updateJob(job.id, { status: 'error', errorMsg: 'Scan failed — service may be unavailable' });
      return null;
    }

    if (sessionRef.current !== session) return null;

    const preItems = await Promise.all(
      poseItems.map((poseItem) => buildPreExtractItemFromPose(poseItem, compressed.dataUrl)),
    );

    if (sessionRef.current !== session) return null;

    updateJob(job.id, { status: 'done', itemCount: preItems.length });
    return preItems;
  };

  const processPhotos = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const session = sessionRef.current;

    const jobs: PhotoJob[] = assets.map((asset, i) => ({
      id: `photo-${Date.now()}-${i}`,
      asset,
      thumbDataUrl: '',
      status: 'pending',
      itemCount: 0,
      errorMsg: null,
    }));

    setPhotoJobs(jobs);
    hasStartedRef.current = true;
    suppressNextDismissRef.current = true;
    bottomSheetRef.current?.dismiss();
    setPhase('processing');

    // Photos used to be scanned strictly one at a time, because the Python
    // service serialised all segmentation behind a single-slot gate and
    // overlapping requests just queued (or 503'd). The hosted pipeline has no
    // such gate, so N photos no longer cost N full round trips end to end.
    const settled = await mapWithConcurrency(jobs, PHOTO_SCAN_CONCURRENCY, (job) =>
      scanPhotoJob(job, session),
    );

    if (sessionRef.current !== session) return;

    // Keep photo order regardless of completion order — the review list should
    // read in the order the user picked, not the order the network finished in.
    const accumulated: PreExtractItemData[] = settled.flatMap((r) =>
      r.status === 'fulfilled' && r.value ? r.value : [],
    );

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

  // Re-scan photos that failed during detection, merging any newly found items
  // into the existing pre-extract list. Reuses the processing screen for feedback.
  const retryFailedPhotos = async () => {
    const failed = photoJobs.filter((j) => j.status === 'error');
    if (failed.length === 0) return;
    const session = sessionRef.current;
    const failedIds = new Set(failed.map((j) => j.id));

    // Put the failed jobs back to 'pending' so the Detect hero and its counter
    // describe the retry in progress rather than a batch that already ended.
    setPhotoJobs((prev) =>
      prev.map((j) => (failedIds.has(j.id) ? { ...j, status: 'pending', errorMsg: null } : j)),
    );
    setPhase('processing');

    const settled = await mapWithConcurrency(failed, PHOTO_SCAN_CONCURRENCY, (job) =>
      scanPhotoJob(job, session),
    );

    if (sessionRef.current !== session) return;

    const accumulated: PreExtractItemData[] = settled.flatMap((r) =>
      r.status === 'fulfilled' && r.value ? r.value : [],
    );

    if (accumulated.length > 0) {
      setPreExtractItems((prev) => [...prev, ...accumulated]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setPhase('pre-extract');
  };

  const extractItems = useCallback(
    async (targets: PreExtractItemData[], mode: 'initial' | 'retry') => {
      if (targets.length === 0) return;
      const session = sessionRef.current;
      const total = targets.length;
      setPhase('extracting');
      setExtractionProgress({ current: 0, total });
      setExtractedThumbs([]);

      let completedCount = 0;

      const settled = await mapWithConcurrency(
        targets,
        EXTRACTION_CONCURRENCY,
        async (preItem) => {
          if (sessionRef.current !== session) throw new Error('session_changed');

          const imageData = preItem.targetImage ?? preItem.croppedImage ?? preItem.sourceImage;
          // Use the full detection set for outfit context, even on a retry of a subset.
          const otherItems = preExtractItems
            .filter((o) => o.tempId !== preItem.tempId)
            .map((o) => `${o.name} (${o.category})`)
            .join(', ');

          try {
            const result = await scanItemDirect({
              imageData,
              outfitContext: otherItems || undefined,
              brandHint: preItem.brandHint || undefined,
              targetName: preItem.name || undefined,
              targetCategory: preItem.category || undefined,
              idempotencyKey: preItem.tempId,
            });

            if (sessionRef.current !== session) throw new Error('session_changed');

            if (preItem.croppedImage) {
              setExtractedThumbs((prev) => [...prev, preItem.croppedImage!]);
            }

            return {
              tempId: preItem.tempId,
              initialName: preItem.name,
              nameEdited: preItem.nameEdited,
              brandHint: preItem.brandHint,
              result,
              croppedImage: preItem.croppedImage,
              cutoutImage: preItem.cutoutImage,
              useCutout: preItem.useCutout,
              bbox: preItem.bbox,
              sourceImage: preItem.sourceImage,
            };
          } finally {
            if (sessionRef.current === session) {
              completedCount += 1;
              setExtractionProgress({ current: completedCount, total });
            }
          }
        },
      );

      if (sessionRef.current !== session) return;

      const extracted: EditableItem[] = [];
      const failed: PreExtractItemData[] = [];
      settled.forEach((s, idx) => {
        if (s.status !== 'fulfilled') {
          failed.push(targets[idx]);
          return;
        }
        const {
          tempId,
          initialName,
          nameEdited,
          brandHint,
          result,
          croppedImage,
          cutoutImage,
          useCutout,
          bbox,
          sourceImage,
        } = s.value;
        const identity = resolveExtractedIdentity({
          initialName,
          nameEdited,
          brandHint,
          extractedName: result.name,
          extractedBrand: result.brand,
        });
        extracted.push({
          tempId,
          name: identity.name,
          brand: identity.brand,
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
          sleeveLength: result.sleeveLength ?? null,
          care: result.care ?? null,
          notableDetails: result.notableDetails ?? [],
          colorPalette: result.colorPalette ?? [],
          colorNormalized: result.colorNormalized ?? null,
          colorTemperature: result.colorTemperature ?? null,
          warmthRating: result.warmthRating ?? null,
          croppedImage,
          cutoutImage,
          useCutout,
          bbox,
          sourceImage,
          expanded: false,
          sizeProfile: null,
        });
      });

      setFailedItems(failed);

      // Initial run with zero successes: nothing to review — send the user back.
      if (mode === 'initial' && extracted.length === 0) {
        Alert.alert(
          'Extraction failed',
          "Couldn't extract details for any items. Please try again.",
          [{ text: 'OK', onPress: () => setPhase('pre-extract') }],
        );
        return;
      }

      if (extracted.length > 0) {
        setAllItems((prev) => (mode === 'retry' ? [...prev, ...extracted] : extracted));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Alert.alert(
          'Still unavailable',
          "Couldn't extract those items — the service may be busy. Try again in a moment.",
        );
      }

      setPhase('review');
    },
    [preExtractItems],
  );

  const runExtraction = useCallback(
    () => extractItems(preExtractItems, 'initial'),
    [extractItems, preExtractItems],
  );

  const retryFailedExtractions = useCallback(() => {
    if (failedItems.length === 0) return;
    extractItems(failedItems, 'retry');
  }, [extractItems, failedItems]);

  const updateItem = useCallback((tempId: string, patch: Partial<EditableItem>) => {
    setAllItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = useCallback((tempId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAllItems((prev) => {
      const next = prev.filter((it) => it.tempId !== tempId);
      if (next.length === 0) {
        setPhase('idle');
        setPhotoJobs([]);
      }
      return next;
    });
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

  const handleWorkspaceCropApply = useCallback(
    async (tempId: string, newBbox: Bbox) => {
      const reviewItem = allItems.find((item) => item.tempId === tempId);
      const preExtractItem = preExtractItems.find((item) => item.tempId === tempId);
      const scope = reviewItem ? 'review' : 'pre-extract';
      const sourceImage = reviewItem?.sourceImage ?? preExtractItem?.sourceImage;
      const category = reviewItem?.category ?? preExtractItem?.category ?? null;
      if (!sourceImage) return;
      const newCrop = await cropImage(sourceImage, newBbox, { maxDim: 800 });
      if (newCrop) {
        // Drop the old cutout straight away — it was masked to the previous box,
        // so keeping it would contradict the crop the user just chose.
        if (scope === 'pre-extract') {
          updatePreExtractItem(tempId, {
            croppedImage: newCrop,
            targetImage: newCrop,
            cutoutImage: null,
            bbox: newBbox,
            previewBbox: newBbox,
          });
        } else {
          updateItem(tempId, { croppedImage: newCrop, cutoutImage: null, bbox: newBbox });
        }

        // Re-cut in the background; the user carries on editing meanwhile.
        const session = sessionRef.current;
        void tryRequestCutout({ imageDataUrl: sourceImage, bbox: newBbox, category })
          .then((cutoutImage) => {
            if (!cutoutImage || sessionRef.current !== session) return;
            if (scope === 'pre-extract') updatePreExtractItem(tempId, { cutoutImage });
            else updateItem(tempId, { cutoutImage });
          });
      }
    },
    [allItems, preExtractItems, updatePreExtractItem, updateItem],
  );


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
          imageUrl = await uploadImageToR2(imageToUpload, user!.id);
        } catch {
          imageUrl = imageToUpload;
        }
      }

      // Optional companion asset (~30 KB). Dropped rather than inlined as base64
      // on failure: the original photo is what the item actually needs.
      let cutoutUrl: string | null = null;
      if (item.cutoutImage) {
        try {
          cutoutUrl = await uploadImageToR2(item.cutoutImage, user!.id);
        } catch {
          cutoutUrl = null;
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
              sleeveLength: item.sleeveLength || null,
              care: item.care || null,
              notableDetails: item.notableDetails.length > 0 ? item.notableDetails : undefined,
              colorPalette: item.colorPalette.length > 0 ? item.colorPalette : undefined,
              imageUrl,
              cutoutUrl,
              coverImageVariant: item.useCutout && cutoutUrl ? 'cutout' : 'original',
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

  const workspacePieces = useMemo<ScanReviewPiece[]>(() => {
    if (phase === 'review' || phase === 'saving') {
      return allItems.map((item) => ({
        id: item.tempId,
        name: item.name,
        brand: item.brand ?? '',
        photo: item.croppedImage,
        cutout: item.cutoutImage,
        useCutout: item.useCutout,
        canAdjustCrop: Boolean(item.sourceImage && item.bbox),
        cropSource: item.sourceImage,
        cropBbox: item.bbox,
        category: item.category,
        subcategory: item.subcategory,
        color: item.color,
        style: item.style,
        seasons: item.seasons,
        occasions: item.occasions,
        material: item.material,
        fit: item.fit,
        sizeProfile: item.sizeProfile,
        sleeveLength: item.sleeveLength,
      }));
    }
    return preExtractItems.map((item) => ({
      id: item.tempId,
      name: item.name,
      brand: item.brandHint,
      photo: item.croppedImage,
      cutout: item.cutoutImage,
      useCutout: item.useCutout,
      canAdjustCrop: Boolean(item.bbox),
      cropSource: item.sourceImage,
      cropBbox: item.bbox,
      category: item.category,
      subcategory: null,
      color: null,
      style: null,
      seasons: [],
      occasions: [],
      material: null,
      fit: null,
      sizeProfile: null,
      sleeveLength: null,
    }));
  }, [allItems, phase, preExtractItems]);

  const handleWorkspaceUpdate = useCallback((tempId: string, patch: Partial<ScanReviewPiece>) => {
    if (phase === 'pre-extract' || phase === 'extracting') {
      updatePreExtractItem(tempId, {
        ...(patch.name !== undefined ? { name: patch.name, nameEdited: true } : {}),
        ...(patch.brand !== undefined ? { brandHint: patch.brand } : {}),
      });
      return;
    }
    updateItem(tempId, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.brand !== undefined ? { brand: patch.brand || null } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.subcategory !== undefined ? { subcategory: patch.subcategory } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.style !== undefined ? { style: patch.style } : {}),
      ...(patch.seasons !== undefined ? { seasons: patch.seasons } : {}),
      ...(patch.material !== undefined ? { material: patch.material } : {}),
      ...(patch.fit !== undefined ? { fit: patch.fit } : {}),
      ...(patch.sizeProfile !== undefined ? { sizeProfile: patch.sizeProfile } : {}),
    });
  }, [phase, updateItem, updatePreExtractItem]);

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
                  ? 'Adding to closet…'
                  : allItems.length === 1
                  ? 'Add to closet'
                  : `Add all ${allItems.length} to closet`}
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

  // The Detect hero shows whichever photo the scan is looking at right now —
  // several run at once, so it's the first still-scanning job, falling back to
  // the next one queued (or the last one finished, at the very end).
  const scanningJob =
    photoJobs.find((j) => j.status === 'scanning')
    ?? photoJobs.find((j) => j.status === 'pending')
    ?? photoJobs[photoJobs.length - 1];
  const scanPreviewImage = scanningJob
    ? scanningJob.thumbDataUrl || scanningJob.asset.uri
    : null;

  const headerTitle =
    phase === 'idle' ? 'Batch Scan'
    : phase === 'processing' ? `Scanning ${doneCount}/${totalCount} photos…`
    : phase === 'pre-extract'
      ? preExtractItems.length === 1
        ? 'Verify & add details'
        : `${preExtractItems.length} items — verify & add details`
    : phase === 'extracting' ? 'Extracting details…'
    : phase === 'saving' ? 'Adding to closet…'
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

          {phase === 'extracting' && (
            <ExtractingContent
              progress={extractionProgress}
              thumbs={extractedThumbs}
            />
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

      <ScanReviewWorkspace
        visible={phase === 'processing' || phase === 'pre-extract' || phase === 'extracting' || phase === 'review' || phase === 'saving'}
        stage={phase === 'processing'
          ? 'scanning'
          : phase === 'extracting' || phase === 'review' || phase === 'saving' ? phase : 'pre-extract'}
        previewImage={scanPreviewImage}
        scanProgress={{ current: doneCount, total: totalCount }}
        pieces={workspacePieces}
        brandSuggestions={brandSuggestions}
        extractionProgress={extractionProgress}
        failure={phase === 'pre-extract' && errorCount > 0 ? {
          message: errorCount === 1 ? "1 photo couldn't be scanned." : `${errorCount} photos couldn't be scanned.`,
          onRetry: retryFailedPhotos,
        } : phase === 'review' && failedItems.length > 0 ? {
          message: failedItems.length === 1
            ? "1 piece couldn't be enriched."
            : `${failedItems.length} pieces couldn't be enriched.`,
          onRetry: retryFailedExtractions,
        } : null}
        onUpdate={handleWorkspaceUpdate}
        onToggleCutout={(tempId) => {
          if (phase === 'review' || phase === 'saving') {
            const item = allItems.find((candidate) => candidate.tempId === tempId);
            if (item) updateItem(tempId, { useCutout: !item.useCutout });
          } else {
            const item = preExtractItems.find((candidate) => candidate.tempId === tempId);
            if (item) updatePreExtractItem(tempId, { useCutout: !item.useCutout });
          }
        }}
        onApplyCrop={handleWorkspaceCropApply}
        onRemove={(tempId) => {
          if (phase === 'review' || phase === 'saving') removeItem(tempId);
          else removePreExtractItem(tempId);
        }}
        onExtract={(trigger, reviewedCount, brandCount) => {
          track('closet_scan_extraction_started', {
            mode: 'batch',
            trigger,
            reviewed_count: reviewedCount,
            item_count: preExtractItems.length,
            brand_count: brandCount,
          });
          runExtraction();
        }}
        onSave={() => { void handleSaveAll(); }}
        onClose={handleWorkspaceDiscard}
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
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    lineHeight: typography.text.bodySmall.fontSize * 1.6,
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
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  hint: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});

// ─── PreExtractList ───────────────────────────────────────────────────────────

function PreExtractList({
  items,
  failedPhotoCount,
  onRetryPhotos,
  onUpdateItem,
  onRemoveItem,
  onAdjustCrop,
}: {
  items: PreExtractItemData[];
  failedPhotoCount: number;
  onRetryPhotos: () => void;
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

      {failedPhotoCount > 0 && (
        <View style={preExtractStyles.retryBanner}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={preExtractStyles.retryText}>
            {failedPhotoCount === 1
              ? "1 photo couldn't be scanned."
              : `${failedPhotoCount} photos couldn't be scanned.`}
          </Text>
          <TouchableOpacity
            onPress={onRetryPhotos}
            style={preExtractStyles.retryBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh" size={14} color={colors.primary} />
            <Text style={preExtractStyles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
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
      <CutoutReviewThumb
        style={cardStyles.thumb}
        croppedImage={item.croppedImage}
        cutoutImage={item.cutoutImage}
        useCutout={item.useCutout}
        onToggleCutout={() => onUpdate({ useCutout: !item.useCutout })}
      >
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
      </CutoutReviewThumb>

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
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    lineHeight: typography.text.bodySmall.fontSize * 1.5,
    marginBottom: spacing.xs,
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  retryText: {
    flex: 1,
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.foreground,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  retryBtnText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
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
    fontSize: typography.text.bodySmall.fontSize,
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
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    minWidth: 32,
    textAlign: 'right',
  },
  statusMsg: {
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
  },
});

// ─── ReviewContent ────────────────────────────────────────────────────────────

function ReviewContent({
  items,
  failedCount,
  onRetryFailed,
  onUpdateItem,
  onRemoveItem,
  onAdjustCrop,
  disabled,
}: {
  items: EditableItem[];
  failedCount: number;
  onRetryFailed: () => void;
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

      {failedCount > 0 && (
        <View style={reviewStyles.retryBanner}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={reviewStyles.retryText}>
            {failedCount === 1
              ? "1 item couldn't be extracted."
              : `${failedCount} items couldn't be extracted.`}
          </Text>
          <TouchableOpacity
            onPress={onRetryFailed}
            disabled={disabled}
            style={[reviewStyles.retryBtn, disabled && reviewStyles.retryBtnDisabled]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh" size={14} color={colors.primary} />
            <Text style={reviewStyles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
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
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    lineHeight: typography.text.bodySmall.fontSize * 1.5,
    marginBottom: spacing.xs,
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  retryText: {
    flex: 1,
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.foreground,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  retryBtnDisabled: { opacity: 0.4 },
  retryBtnText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
});

// ─── ItemCard ─────────────────────────────────────────────────────────────────

// Derived from the shared vocabulary rather than restated. Named CHIPS
// because the shared export is the value list; this is its presentation.
const SEASON_CHIPS = SEASON_OPTIONS.map((value) => ({ value, label: SEASON_LABELS[value] }));

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
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.label,
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
        <CutoutReviewThumb
          style={cardStyles.thumb}
          croppedImage={item.croppedImage}
          cutoutImage={item.cutoutImage}
          useCutout={item.useCutout}
          onToggleCutout={() => !disabled && onUpdate({ useCutout: !item.useCutout })}
        >
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
        </CutoutReviewThumb>

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
                {SEASON_CHIPS.map(({ label, value }) => {
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
            formalityValues={item.occasions}
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
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  meta: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground },
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
    fontSize: typography.text.body.fontSize,
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
    fontSize: typography.text.bodySmall.fontSize,
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
    fontSize: typography.text.sectionTitle.fontSize,
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
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});
