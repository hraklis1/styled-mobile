import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
import * as Crypto from 'expo-crypto';
import { useCameraLaunch, useLibraryLaunch } from '../../hooks/useCameraLaunch';
import {
  useScanVisionPose,
  scanItemDirect,
  createItemsBatch,
  applySavedItems,
  useBrandSuggestions,
  type BatchCreateItemInput,
  type PoseScanItem,
} from '../../hooks/useItems';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { api, apiErrorMessage } from '../../lib/api';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS, SEASON_OPTIONS, SEASON_LABELS, type Item, type ItemCategory, type SleeveLength } from '../../types/item';
import { BrandAutocompleteInput } from '../primitives/BrandAutocompleteInput';
import { TaxonomySelector } from '../primitives/TaxonomySelector';
import { SizeProfileInput } from '../primitives/SizeProfileInput';
import type { SizeProfile } from '../../lib/sizes';
import { type Bbox } from './CropAdjustModal';
import { CutoutReviewThumb } from './CutoutReviewThumb';
import { cropImage } from '../../lib/cropImage';
import { tryRequestCutout } from '../../lib/cutout';
import { mapWithConcurrency } from '../../lib/asyncPool';
import {
  createExtractionCache,
  extractionKey,
  type ExtractionCache,
  type ExtractionRequest,
} from '../../lib/extractionPrefetch';
import { isDataUri, uploadDataUrlsToR2 } from '../../lib/uploadImage';
import { capturePhotoLocation } from '../../lib/photoLocation';
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
  sleeveLength: SleeveLength | null;
  care: string | null;
  notableDetails: string[];
  colorPalette: string[];
  colorNormalized: string | null;
  colorTemperature: string | null;
  warmthRating: number | null;
  croppedImage: string | null;
  /** Background-removed thumbnail from the scan, if segmentation produced one. */
  cutoutImage: string | null;
  /** True when the user selects the cutout as the initial cover. */
  useCutout: boolean;
  expanded: boolean;
  sizeProfile: SizeProfile | null;
  bbox: Bbox | null;
  sourceImage: string | null;
  purchaseLocation: string | null;
};

type PreExtractItemData = {
  tempId: string;
  name: string;
  category: string;
  croppedImage: string | null;
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
  /** Scene the server routed this photo to — decides the cutout mask model. */
  scene: string | null;
};

interface ScanItemSheetProps {
  visible: boolean;
  onClose: () => void;
  onItemsSaved?: (items: Item[]) => void;
  autoLaunch?: 'camera' | 'library';
}

const SCAN_DRAFT_KEY = 'scan_review_draft';
const EXTRACTION_CONCURRENCY = 4;
/** Long edge of the frame sent to /api/scan-vision-pose; matches batch import. */
const POSE_FRAME_MAX_DIM = 1024;
// How long the pre-extract review has to sit still before extraction starts
// in the background, so typing a name doesn't send a request per keystroke.
const PREFETCH_DEBOUNCE_MS = 900;

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

/** The attribute-extraction request for one piece, keyed on everything the user can edit about it. */
function extractionRequestFor(
  preItem: PreExtractItemData,
  preItems: PreExtractItemData[],
  fullImageDataUrl: string,
): ExtractionRequest {
  const otherItems = preItems
    .filter((other) => other.tempId !== preItem.tempId)
    .map((other) => `${other.name} (${other.category})`)
    .join(', ');
  return {
    imageData: preItem.targetImage ?? preItem.croppedImage ?? fullImageDataUrl,
    outfitContext: otherItems || undefined,
    brandHint: preItem.brandHint || undefined,
    targetName: preItem.name || undefined,
    targetCategory: preItem.category || undefined,
    // Hashes the name, category, brand hint and crop, so an edit made during
    // review gets a fresh extraction instead of the server's cached answer
    // for the old inputs. A manual retry reuses the key and can join the
    // original server work or its cached result.
    idempotencyKey: extractionKey(preItem.tempId, {
      targetName: preItem.name,
      targetCategory: preItem.category,
      brandHint: preItem.brandHint,
      bbox: preItem.bbox,
    }),
  };
}

function toBatchCreateInput(
  item: EditableItem,
  imageUrl: string | null,
  cutoutUrl: string | null,
): BatchCreateItemInput {
  // Progressive profiling: flag items whose enrichment fields are sparse so
  // the backend (and future UI prompts) know to ask for more details later.
  const needsDetails = [item.brand, item.material, item.fit, item.subcategory].filter(Boolean).length === 0;
  return {
    clientImportId: item.tempId,
    name: item.name.trim() || 'Untitled',
    brand: item.brand || null,
    category: (item.category as ItemCategory) || null,
    subcategory: item.subcategory || null,
    // The server requires a colour; the scan always names one.
    color: item.color || '',
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
    sleeveLength: item.sleeveLength || null,
    care: item.care || null,
    notableDetails: item.notableDetails.length > 0 ? item.notableDetails : undefined,
    colorPalette: item.colorPalette.length > 0 ? item.colorPalette : undefined,
    imageUrl,
    cutoutUrl,
    coverImageVariant: item.useCutout && cutoutUrl ? 'cutout' : 'original',
    sizeProfile: item.sizeProfile ?? null,
    purchaseLocation: item.purchaseLocation ?? null,
    needsDetails,
  };
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
  // preview, which is cut from the smaller frame sent for pose detection and
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
    // Comes back with the scan itself — the pipeline reuses a mask it already
    // computed, so there's no extra request and nothing to wait on here.
    cutoutImage: poseItem.cutoutUrl
      ?? (poseItem.cutoutWebP ? `data:image/webp;base64,${poseItem.cutoutWebP}` : null),
    useCutout: false,
    targetImage,
    bbox: targetBbox,
    previewBbox,
    sourceImage,
    brandHint: '',
    nameEdited: false,
    scene: poseItem.scene ?? null,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScanItemSheet({ visible, onClose, onItemsSaved, autoLaunch }: ScanItemSheetProps) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<EditableItem[]>([]);
  const [failedItems, setFailedItems] = useState<PreExtractItemData[]>([]);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  // Bumped when a scan starts or is discarded, so work still in flight from
  // an earlier scan can recognise that it no longer applies.
  const sessionRef = useRef(0);
  // Extractions started during pre-extract review, shared with runExtraction.
  // Reset with the session.
  const extractionCacheRef = useRef<ExtractionCache | null>(null);
  const extractionCache = () => {
    extractionCacheRef.current ??= createExtractionCache(scanItemDirect, EXTRACTION_CONCURRENCY);
    return extractionCacheRef.current;
  };
  const reviewTrackedRef = useRef(false);
  // Guards the handoff from the idle picker sheet to the full-screen scan
  // workspace: set right before a programmatic `.dismiss()` so `handleDismiss`
  // (BottomSheetModal's onDismiss) treats it as a no-op instead of tearing
  // down the whole scan. Genuine user dismissals never set this.
  const suppressNextDismissRef = useRef(false);
  // Once a scan has actually started, a mid-flow bounce back to `idle` (no
  // items detected, scan failed, last piece removed) should re-show the
  // picker sheet rather than leave a blank screen.
  const hasStartedRef = useRef(false);
  // Location derived from photo EXIF GPS (or device position as fallback).
  // Captured in parallel with scanning; applied to every item saved in the session.
  const photoLocationRef = useRef<string | null>(null);
  const [preExtractItems, setPreExtractItems] = useState<PreExtractItemData[]>([]);
  const { user } = useAuth();
  const poseScan = useScanVisionPose();
  const queryClient = useQueryClient();
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

  useEffect(() => {
    if (phase === 'idle') reviewTrackedRef.current = false;
    if (phase !== 'pre-extract' || reviewTrackedRef.current) return;
    reviewTrackedRef.current = true;
    track('closet_scan_review_started', { mode: 'single', item_count: preExtractItems.length });
  }, [phase, preExtractItems.length]);

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
          ? await launchCamera({ maxDim: 1600, compress: 0.85, captureExif: true })
          : await launchLibrary({ maxDim: 1600, compress: 0.85, captureExif: true });
      if (!active) return;
      if (!captured) { onClose(); return; }
      photoLocationRef.current = null;
      capturePhotoLocation(captured.exif, autoLaunch === 'camera').then((loc) => {
        photoLocationRef.current = loc;
      });
      setImageDataUrl(captured.dataUrl);
      await runPoseScan(captured.uri, captured.dataUrl, captured);
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canClose = phase === 'idle' || phase === 'review' || phase === 'pre-extract';

  const headerTitle =
    phase === 'idle' ? 'Add to My Closet'
    : phase === 'scanning' ? 'Scanning outfit…'
    : phase === 'pre-extract'
      ? preExtractItems.length === 1
        ? 'Verify & add details'
        : `${preExtractItems.length} items — verify & add details`
    : phase === 'extracting' ? 'Extracting details…'
    : phase === 'saving' ? 'Adding to closet…'
    : detectedItems.length === 1 ? '1 item detected'
    : `${detectedItems.length} items detected`;

  const handleClose = useCallback(() => {
    if (phase === 'saving' || phase === 'extracting') return;
    bottomSheetRef.current?.dismiss();
  }, [phase]);

  // Shared teardown for actually ending the scan — used both when the idle
  // picker sheet is dismissed (via handleDismiss below) and when the
  // full-screen workspace's "Discard scan" is confirmed, where there's no
  // bottom sheet dismiss animation to wait on since the sheet was already
  // dismissed (or never presented) by the time scanning started.
  const finishClose = useCallback(() => {
    sessionRef.current += 1;
    extractionCacheRef.current?.clear();
    AsyncStorage.removeItem(SCAN_DRAFT_KEY);
    poseScan.reset();
    setPreExtractItems([]);
    setFailedItems([]);
    onClose();
  }, [poseScan, onClose]);

  const handleDismiss = useCallback(() => {
    if (suppressNextDismissRef.current) {
      suppressNextDismissRef.current = false;
      return;
    }
    finishClose();
  }, [finishClose]);

  const handleWorkspaceDiscard = useCallback(() => {
    finishClose();
  }, [finishClose]);

  // If the flow bounces back to `idle` after having started (no items
  // detected, scan failed, last piece removed), re-present the picker sheet
  // — it was dismissed when scanning began and won't come back on its own.
  //
  // An auto-launched scan (camera/library picked from AddActionSheet) never
  // had a picker sheet, so there is nothing to go back to: end the scan
  // instead. Re-presenting left this component mounted but invisible, and
  // since GlobalScanContext still counted it as open, every later "Choose
  // from Photos" did nothing until the app was restarted.
  useEffect(() => {
    if (phase !== 'idle' || !hasStartedRef.current) return;
    if (autoLaunch) finishClose();
    else bottomSheetRef.current?.present();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);


  const handleSaveAll = async () => {
    if (detectedItems.length === 0) return;
    if (!user) {
      console.error('User not authenticated');
      return;
    }
    const session = sessionRef.current;
    const items = detectedItems;
    setPhase('saving');

    // Pieces that didn't make it, with why. They stay in review so "Add"
    // retries exactly those; the create is idempotent on tempId, so a retry
    // after a lost response can't duplicate the ones that did.
    const failures = new Map<string, string>();

    // ── Uploads: one presign round trip, then native PUTs four at a time ──
    const photos = await Promise.all(items.map((item) => buildUploadImage(item)));
    const imageUrls = new Map<string, string>();
    const cutoutUrls = new Map<string, string>();
    const uploads: { tempId: string; kind: 'image' | 'cutout'; dataUrl: string }[] = [];
    items.forEach((item, index) => {
      const photo = photos[index];
      if (photo && isDataUri(photo)) uploads.push({ tempId: item.tempId, kind: 'image', dataUrl: photo });
      else if (photo) imageUrls.set(item.tempId, photo);
      if (item.cutoutImage && isDataUri(item.cutoutImage)) {
        uploads.push({ tempId: item.tempId, kind: 'cutout', dataUrl: item.cutoutImage });
      } else if (item.cutoutImage) {
        cutoutUrls.set(item.tempId, item.cutoutImage);
      }
    });

    let uploaded: PromiseSettledResult<string>[];
    try {
      uploaded = await uploadDataUrlsToR2(uploads.map((u) => u.dataUrl));
    } catch (reason) {
      uploaded = uploads.map(() => ({ status: 'rejected' as const, reason }));
    }
    if (sessionRef.current !== session) return;
    uploads.forEach((upload, index) => {
      const result = uploaded[index];
      if (result.status === 'fulfilled') {
        (upload.kind === 'image' ? imageUrls : cutoutUrls).set(upload.tempId, result.value);
      } else if (upload.kind === 'image') {
        // Never fall back to storing the data URL: base64 in Postgres ships
        // with every closet payload.
        failures.set(upload.tempId, "Couldn't upload this photo.");
      }
      // A failed cutout is dropped rather than failing the piece: it's an
      // optional companion (~30 KB) and the photo stays authoritative.
    });

    // ── Create: every uploaded piece in one idempotent request ───────────
    const ready = items.filter((item) => !failures.has(item.tempId));
    let savedItems: Item[] = [];
    if (ready.length > 0) {
      try {
        const result = await createItemsBatch(ready.map((item) => toBatchCreateInput(
          item,
          imageUrls.get(item.tempId) ?? null,
          cutoutUrls.get(item.tempId) ?? null,
        )));
        // Applied even if the session moved on: the rows exist either way.
        applySavedItems(queryClient, result.items);
        savedItems = result.items;
        for (const rejected of result.rejected) {
          if (rejected.clientImportId) failures.set(rejected.clientImportId, rejected.message);
        }
      } catch (err) {
        // 402s (credits, free cap) are already surfaced by the api interceptor.
        const message = apiErrorMessage(err, "Couldn't add this piece.");
        for (const item of ready) failures.set(item.tempId, message);
      }
    }
    if (sessionRef.current !== session) return;

    const savedIds = new Set(savedItems.map((item) => item.clientImportId));
    for (const item of ready) {
      if (!savedIds.has(item.tempId) && !failures.has(item.tempId)) {
        failures.set(item.tempId, "Couldn't add this piece.");
      }
    }
    for (const item of savedItems) track('item_added', { category: item.category });

    if (failures.size > 0) {
      setDetectedItems((current) => current.filter((it) => !savedIds.has(it.tempId)));
      if (savedItems.length > 0) onItemsSaved?.(savedItems);
      const [firstMessage] = failures.values();
      Alert.alert(
        savedItems.length > 0 ? 'Some pieces weren\'t added' : 'Save failed',
        failures.size === 1
          ? `${firstMessage} Tap Add to try again.`
          : `${failures.size} pieces couldn't be added. Tap Add to try again.`,
      );
      setPhase('review');
      return;
    }

    AsyncStorage.removeItem(SCAN_DRAFT_KEY);
    track('wardrobe_items_added', { item_count: savedItems.length });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onItemsSaved?.(savedItems);
    onClose();
  };

  const runExtraction = async (
    preItems: PreExtractItemData[],
    fullImageDataUrl: string,
    session: number,
    mode: 'initial' | 'retry' = 'initial',
  ) => {
    const total = preItems.length;
    setPhase('extracting');
    setExtractionProgress({ current: 0, total });

    let completedCount = 0;

    const settled = await mapWithConcurrency(
      preItems,
      EXTRACTION_CONCURRENCY,
      async (preItem) => {
        if (sessionRef.current !== session) throw new Error('session_changed');

        try {
          // Usually already running (or done) — started in the background
          // while the user reviewed this piece.
          const result = await extractionCache().get(
            extractionRequestFor(preItem, preItems, fullImageDataUrl),
          );

          if (sessionRef.current !== session) throw new Error('session_changed');

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
        failed.push(preItems[idx]);
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
        expanded: false,
        sizeProfile: null,
        bbox,
        sourceImage: fullImageDataUrl,
        purchaseLocation: photoLocationRef.current,
      });
    });

    setFailedItems(failed);

    if (mode === 'initial' && extracted.length === 0) {
      Alert.alert(
        'Extraction failed',
        "Couldn't extract details for any items. Please try again.",
        [{ text: 'OK', onPress: () => setPhase('pre-extract') }],
      );
      return;
    }

    if (extracted.length > 0) {
      setDetectedItems((current) => mode === 'retry' ? [...current, ...extracted] : extracted);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Alert.alert(
        'Still unavailable',
        "Couldn't extract those items — the service may be busy. Try again in a moment.",
      );
    }
    setPhase('review');
  };

  // Start extraction in the background while the user reviews detections.
  // Pieces whose inputs haven't changed since keep their earlier request (the
  // cache is keyed on name, category, brand hint and crop), so each pause in
  // editing only starts work for what was actually edited.
  useEffect(() => {
    if (phase !== 'pre-extract' || !imageDataUrl || preExtractItems.length === 0) return;
    const timer = setTimeout(() => {
      for (const item of preExtractItems) {
        // Failures are retried when the user continues; nothing to show here.
        extractionCache().get(extractionRequestFor(item, preExtractItems, imageDataUrl)).catch(() => {});
      }
    }, PREFETCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, preExtractItems, imageDataUrl]);

  const handleStartExtraction = useCallback(async () => {
    if (preExtractItems.length === 0 || !imageDataUrl) return;
    const session = sessionRef.current;
    await runExtraction(preExtractItems, imageDataUrl, session);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preExtractItems, imageDataUrl]);

  const retryFailedExtractions = useCallback(async () => {
    if (failedItems.length === 0 || !imageDataUrl) return;
    await runExtraction(failedItems, imageDataUrl, sessionRef.current, 'retry');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedItems, imageDataUrl]);

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
                  ? 'Adding to closet…'
                  : detectedItems.length === 1
                  ? 'Add to closet'
                  : `Add all ${detectedItems.length} to closet`}
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
        ? await launchCamera({ maxDim: 1600, compress: 0.85, captureExif: true })
        : await launchLibrary({ maxDim: 1600, compress: 0.85, captureExif: true });

    if (!captured) return;
    track('item_scan_started', { source });

    // Capture location in parallel — EXIF GPS preferred, current position as
    // fallback for camera shots (where the user is physically at the location).
    photoLocationRef.current = null;
    capturePhotoLocation(captured.exif, source === 'camera').then((loc) => {
      photoLocationRef.current = loc;
    });

    setImageDataUrl(captured.dataUrl);
    // Pass the local file URI so runPoseScan can downscale without re-encoding the data URL
    await runPoseScan(captured.uri, captured.dataUrl, captured);
  };

  const runPoseScan = async (
    sourceUri: string,
    displayDataUrl: string,
    size: { width: number; height: number },
  ) => {
    sessionRef.current += 1;
    const session = sessionRef.current;
    extractionCacheRef.current?.clear();
    setDetectedItems([]);
    setFailedItems([]);
    hasStartedRef.current = true;
    suppressNextDismissRef.current = true;
    bottomSheetRef.current?.dismiss();
    setPhase('scanning');

    // Long edge 1024 px, the same frame batch import sends (SCAN_MAX_DIM), so
    // both entry points get the same detections. SAM 3 is priced per request,
    // so the size costs nothing extra; the cutouts are cut from this frame, so
    // it sets their resolution too. Benched 2026-09-29 on the 25-case set:
    // recall 0.965 at width 512 vs 0.976 here, +~0.3s median.
    const poseFrame = await ImageManipulator.manipulateAsync(
      sourceUri,
      Math.max(size.width, size.height) > POSE_FRAME_MAX_DIM
        ? [size.width >= size.height
          ? { resize: { width: POSE_FRAME_MAX_DIM } }
          : { resize: { height: POSE_FRAME_MAX_DIM } }]
        : [],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    const base64 = poseFrame.base64!;

    try {
      const result = await poseScan.mutateAsync({
        imageBase64: base64,
        // React Query reuses the mutation variables for network retries, so the
        // server can return the first successful paid result instead of billing
        // for the same scan again after a lost response.
        idempotencyKey: Crypto.randomUUID(),
      });
      if (sessionRef.current !== session) return;

      if (!result.items || result.items.length === 0) {
        Alert.alert(
          'No clothing detected',
          'Try a full-body photo with better lighting, or add items manually.',
          [{ text: 'OK', onPress: () => { setPhase('idle'); setImageDataUrl(null); } }],
        );
        return;
      }

      // Build per-item pre-extract data with native-backed target/preview crops.
      const preItems = await Promise.all(
        result.items.map((poseItem) => buildPreExtractItemFromPose(poseItem, displayDataUrl)),
      );
      if (sessionRef.current !== session) return;

      setPreExtractItems(preItems);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhase('pre-extract');
    } catch (err: any) {
      if (sessionRef.current !== session) return;
      Alert.alert(
        'Scan failed',
        // The server's own message when it sent one — a 503 LABEL_UNAVAILABLE
        // says the photo couldn't be read and that no credits were taken.
        apiErrorMessage(err, err?.message || 'Something went wrong. Please try again.'),
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
    setDetectedItems((prev) => {
      const next = prev.filter((it) => it.tempId !== tempId);
      if (next.length === 0) {
        setPhase('idle');
        setImageDataUrl(null);
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
        setImageDataUrl(null);
      }
      return next;
    });
  }, []);

  const handleWorkspaceCropApply = useCallback(async (tempId: string, newBbox: Bbox) => {
    const reviewItem = detectedItems.find((item) => item.tempId === tempId);
    const preExtractItem = preExtractItems.find((item) => item.tempId === tempId);
    const scope = reviewItem ? 'review' : 'pre-extract';
    const sourceImage = reviewItem?.sourceImage ?? preExtractItem?.sourceImage;
    const category = reviewItem?.category ?? preExtractItem?.category ?? null;
    const scene = preExtractItem?.scene ?? null;
    if (!sourceImage) return;
    const newCrop = await cropImage(sourceImage, newBbox, { maxDim: 800 });
    if (newCrop) {
      // Drop the old cutout straight away — it was masked to the previous box,
      // so keeping it visible would contradict the crop the user just chose.
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

      // Re-cut in the background against the new box. The user carries on
      // editing; if it never lands, the item simply keeps its plain crop.
      const session = sessionRef.current;
      void tryRequestCutout({
        imageDataUrl: sourceImage,
        bbox: newBbox,
        category,
        scene,
      }).then((cutoutImage) => {
        if (!cutoutImage || sessionRef.current !== session) return;
        if (scope === 'pre-extract') updatePreExtractItem(tempId, { cutoutImage });
        else updateItem(tempId, { cutoutImage });
      });
    }
  }, [detectedItems, preExtractItems, updatePreExtractItem, updateItem]);

  const workspacePieces = useMemo<ScanReviewPiece[]>(() => {
    if (phase === 'review' || phase === 'saving') {
      return detectedItems.map((item) => ({
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
  }, [detectedItems, phase, preExtractItems]);

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
        </BottomSheetScrollView>
      </BottomSheetModal>

      <ScanReviewWorkspace
        visible={phase === 'scanning' || phase === 'pre-extract' || phase === 'extracting' || phase === 'review' || phase === 'saving'}
        stage={phase === 'scanning' || phase === 'extracting' || phase === 'review' || phase === 'saving' ? phase : 'pre-extract'}
        previewImage={imageDataUrl}
        pieces={workspacePieces}
        brandSuggestions={brandSuggestions}
        extractionProgress={extractionProgress}
        failure={phase === 'review' && failedItems.length > 0 ? {
          message: failedItems.length === 1
            ? "1 piece couldn't be enriched."
            : `${failedItems.length} pieces couldn't be enriched.`,
          onRetry: retryFailedExtractions,
        } : null}
        onUpdate={handleWorkspaceUpdate}
        onToggleCutout={(tempId) => {
          if (phase === 'review' || phase === 'saving') {
            const item = detectedItems.find((candidate) => candidate.tempId === tempId);
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
            mode: 'single',
            trigger,
            reviewed_count: reviewedCount,
            item_count: preExtractItems.length,
            brand_count: brandCount,
          });
          void handleStartExtraction();
        }}
        onSave={() => { void handleSaveAll(); }}
        onClose={handleWorkspaceDiscard}
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
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      <TouchableOpacity style={idleStyles.option} onPress={() => onPickImage('library')}>
        <View style={idleStyles.iconBox}>
          <Ionicons name="image-outline" size={22} color={colors.primary} />
        </View>
        <View style={idleStyles.optionText}>
          <Text style={idleStyles.optionTitle}>Choose from Library</Text>
          <Text style={idleStyles.optionSub}>Select from camera roll</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

const idleStyles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  subtitle: {
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    lineHeight: typography.text.bodySmall.fontSize * 1.5,
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
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  optionSub: {
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
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
      {/* Thumbnail with cutout toggle and optional crop-adjust button */}
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
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    lineHeight: typography.text.bodySmall.fontSize * 1.5,
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
    fontSize: typography.text.bodySmall.fontSize,
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
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    lineHeight: typography.text.bodySmall.fontSize * 1.5,
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
        {/* Thumbnail with cutout toggle */}
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
                    {SEASON_CHIPS.map(({ label, value }) => {
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
            formalityValues={item.occasions}
            value={item.sizeProfile}
            onChange={(p) => onUpdate({ sizeProfile: p })}
          />
        </View>
      )}
    </View>
  );
}

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
