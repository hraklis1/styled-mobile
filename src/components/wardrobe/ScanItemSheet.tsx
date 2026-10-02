import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
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
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { useCameraLaunch, useLibraryLaunch, type CapturedImage } from '../../hooks/useCameraLaunch';
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
import { apiErrorMessage } from '../../lib/api';
import { colors, spacing, typography, radii } from '../../theme';
import { type Item, type ItemCategory, type SleeveLength } from '../../types/item';
import type { SizeProfile } from '../../lib/sizes';
import { type Bbox } from './CropAdjustModal';
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
import { applyInclusionChanges } from '../../lib/extraction-review';
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
  included?: boolean;
  basicDetails?: boolean;
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
  sizeProfile: SizeProfile | null;
  bbox: Bbox | null;
  sourceImage: string | null;
  purchaseLocation: string | null;
  /** Fields the extraction was unsure of; dropped one by one as the user edits them. */
  lowConfidenceFields?: string[];
};

type PreExtractItemData = {
  included?: boolean;
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
  /**
   * A library photo the caller already picked (and compressed); used in place
   * of opening the picker when `autoLaunch` is 'library'.
   */
  initialImage?: CapturedImage;
}

const SCAN_DRAFT_KEY = 'scan_review_draft';
const EXTRACTION_CONCURRENCY = 4;
/** Long edge of the frame sent to /api/scan-vision-pose; matches batch import. */
const POSE_FRAME_MAX_DIM = 1024;

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
  const needsDetails = Boolean(item.basicDetails) || [item.brand, item.material, item.fit, item.subcategory].filter(Boolean).length === 0;
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

export function ScanItemSheet({ visible, onClose, onItemsSaved, autoLaunch, initialImage }: ScanItemSheetProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<EditableItem[]>([]);
  const [failedItems, setFailedItems] = useState<PreExtractItemData[]>([]);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  // Bumped when a scan starts or is discarded, so work still in flight from
  // an earlier scan can recognise that it no longer applies.
  const sessionRef = useRef(0);
  const operationRef = useRef(false);
  const approvedIds = useRef<string[]>([]);
  const draftClosed = useRef(false);
  const [draftChoice, setDraftChoice] = useState<'loading' | 'new' | 'resumed'>('loading');
  const [resumeIds, setResumeIds] = useState<string[] | null>(null);
  // Cache only explicitly approved extraction requests; reset with the session.
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
      if (!raw) { setDraftChoice('new'); return; }
      try {
        const parsed = JSON.parse(raw);
        const draft = Array.isArray(parsed) ? { ready: parsed as EditableItem[], pending: [] as PreExtractItemData[], image: null as string | null, failedIds: [] as string[], approvedIds: [] as string[] } : parsed;
        if (!draft || !Array.isArray(draft.ready) || !Array.isArray(draft.pending)) { setDraftChoice('new'); return; }
        const count = new Set([...draft.ready, ...draft.pending].map((p: { tempId: string }) => p.tempId)).size;
        if (!count) { setDraftChoice('new'); return; }
        Alert.alert(
          'Resume previous scan?',
          `You have ${count} pieces from a previous scan. Continue editing?`,
          [
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => { void AsyncStorage.removeItem(SCAN_DRAFT_KEY); setDraftChoice('new'); },
            },
            {
              text: 'Resume',
              onPress: () => {
                setDraftChoice('resumed');
                const pending = draft.pending.map((p: PreExtractItemData) => ({ ...p, sourceImage: draft.image ?? p.sourceImage }));
                setDetectedItems(draft.ready.map((p: EditableItem) => ({ ...p, sourceImage: draft.image ?? p.sourceImage })));
                setPreExtractItems(pending);
                setFailedItems(pending.filter((p: PreExtractItemData) => draft.failedIds?.includes(p.tempId)));
                setImageDataUrl(draft.image);
                setPhase(draft.ready.length ? 'review' : 'pre-extract');
                if (draft.approvedIds?.length && draft.image) setResumeIds(draft.approvedIds);
              },
            },
          ],
        );
      } catch { void AsyncStorage.removeItem(SCAN_DRAFT_KEY); setDraftChoice('new'); }
    }).catch(() => setDraftChoice('new'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'idle') reviewTrackedRef.current = false;
    if (phase !== 'pre-extract' || reviewTrackedRef.current) return;
    reviewTrackedRef.current = true;
    track('closet_scan_review_started', { mode: 'single', item_count: preExtractItems.length });
  }, [phase, preExtractItems.length]);

  // Retain source photo once, plus edits, inclusion and approved targets.
  const draftRef = useRef({ phase, image: imageDataUrl, ready: detectedItems, pending: preExtractItems, failedIds: failedItems.map(p => p.tempId) });
  draftRef.current = { phase, image: imageDataUrl, ready: detectedItems, pending: preExtractItems, failedIds: failedItems.map(p => p.tempId) };
  const persistDraft = useCallback(() => {
    const draft = draftRef.current;
    if (draftClosed.current || draft.phase === 'idle' || draft.phase === 'scanning') return;
    const withoutSource = <T extends { sourceImage: string | null }>(items: T[]) => items.map(({ sourceImage: _source, ...item }) => item);
    void AsyncStorage.setItem(SCAN_DRAFT_KEY, JSON.stringify({ version: 2, ...draft,
      ready: draft.image ? withoutSource(draft.ready) : draft.ready, pending: draft.image ? withoutSource(draft.pending) : draft.pending, approvedIds: approvedIds.current,
    })).catch(() => { /* A failed local draft write does not block review. */ });
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => { if (state === 'background') persistDraft(); });
    return () => sub.remove();
  }, [persistDraft]);
  useEffect(() => { persistDraft(); }, [phase, detectedItems, preExtractItems, failedItems, persistDraft]);

  // ── BottomSheetModal ──────────────────────────────────────────────────────────
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['90%'], []);

  useEffect(() => {
    if (draftChoice !== 'new') return;
    if (!autoLaunch) {
      bottomSheetRef.current?.present();
      return;
    }
    let active = true;
    (async () => {
      const captured =
        autoLaunch === 'camera'
          ? await launchCamera({ maxDim: 1600, compress: 0.85, captureExif: true })
          : initialImage ?? await launchLibrary({ maxDim: 1600, compress: 0.85, captureExif: true });
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
  }, [draftChoice]);

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
    draftClosed.current = true;
    operationRef.current = false;
    approvedIds.current = [];
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


  const handleSaveAll = async (ids: string[]) => {
    const items = detectedItems.filter(item => ids.includes(item.tempId));
    if (items.length === 0 || operationRef.current) return;
    if (!user) {
      console.error('User not authenticated');
      return;
    }
    const session = sessionRef.current;
    operationRef.current = true;
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
      setPreExtractItems(current => current.filter(item => !savedIds.has(item.tempId)));
      operationRef.current = false;
      setPhase('review');
      return;
    }

    operationRef.current = false;
    draftClosed.current = true;
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
          // Reuse a successful approved request when retrying unchanged inputs.
          const result = await extractionCache().get(
            extractionRequestFor(preItem, preItems, fullImageDataUrl),
          );

          if (sessionRef.current !== session) throw new Error('session_changed');

          return {
            included: preItem.included,
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
        included,
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
        included,
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
        lowConfidenceFields: result.lowConfidenceFields ?? [],
        croppedImage,
        cutoutImage,
        useCutout,
        sizeProfile: null,
        bbox,
        sourceImage: fullImageDataUrl,
        purchaseLocation: photoLocationRef.current,
      });
    });

    const attempted = new Set(preItems.map(p => p.tempId));
    setFailedItems(current => [...current.filter(p => !attempted.has(p.tempId)), ...failed]);
    setDetectedItems(current => [...current.filter(p => !attempted.has(p.tempId)), ...extracted]);
    operationRef.current = false;
    approvedIds.current = [];
    setPhase('review');
  };

  const handleStartExtraction = async (ids: string[]) => {
    if (operationRef.current || !imageDataUrl) return;
    const targets = preExtractItems.filter(item => ids.includes(item.tempId) && !detectedItems.some(done => done.tempId === item.tempId)).map(item => ({ ...item, included: true }));
    if (!targets.length) return;
    operationRef.current = true;
    approvedIds.current = targets.map(item => item.tempId);
    await runExtraction(targets, imageDataUrl, sessionRef.current);
  };
  const retryFailedExtractions = () => {
    void handleStartExtraction(failedItems.filter(item => item.included !== false).map(item => item.tempId));
  };

  useEffect(() => {
    if (!resumeIds || !imageDataUrl || operationRef.current) return;
    setResumeIds(null);
    void handleStartExtraction(resumeIds);
  // Approved snapshots alone may resume; inclusion changes never trigger work.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeIds, imageDataUrl]);

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
    operationRef.current = false;
    approvedIds.current = [];
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

  const updatePreExtractItem = useCallback((tempId: string, patch: Partial<PreExtractItemData>) => {
    setPreExtractItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)),
    );
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
    const readyPieces: ScanReviewPiece[] = detectedItems.map((item) => ({
        id: item.tempId,
        included: item.included !== false,
        extraction: 'ready',
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
        colorNormalized: item.colorNormalized,
        style: item.style,
        seasons: item.seasons,
        occasions: item.occasions,
        material: item.material,
        fit: item.fit,
        sizeProfile: item.sizeProfile,
        sleeveLength: item.sleeveLength,
        lowConfidenceFields: item.lowConfidenceFields,
      }));
    const pendingPieces: ScanReviewPiece[] = preExtractItems.map((item) => ({
      id: item.tempId,
      included: item.included !== false,
      extraction: failedItems.some(f => f.tempId === item.tempId) ? 'failed' : 'not-started',
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
    const byId = new Map([...pendingPieces, ...readyPieces].map(p => [p.id, p]));
    const order = [...new Set([...preExtractItems.map(p => p.tempId), ...detectedItems.map(p => p.tempId)])];
    return order.map(id => byId.get(id)!);
  }, [detectedItems, failedItems, preExtractItems]);

  const handleWorkspaceUpdate = useCallback((tempId: string, patch: Partial<ScanReviewPiece>) => {
    if (!detectedItems.some(item => item.tempId === tempId)) {
      updatePreExtractItem(tempId, {
        ...(patch.name !== undefined ? { name: patch.name, nameEdited: true } : {}),
        ...(patch.brand !== undefined ? { brandHint: patch.brand } : {}),
      });
      return;
    }
    const item = detectedItems.find((candidate) => candidate.tempId === tempId);
    const lowConfidenceFields = item?.lowConfidenceFields?.filter((field) => !(field in patch));
    updateItem(tempId, {
      ...(lowConfidenceFields ? { lowConfidenceFields } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.brand !== undefined ? { brand: patch.brand || null } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.subcategory !== undefined ? { subcategory: patch.subcategory } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.colorNormalized !== undefined ? { colorNormalized: patch.colorNormalized ?? null } : {}),
      ...(patch.style !== undefined ? { style: patch.style } : {}),
      ...(patch.seasons !== undefined ? { seasons: patch.seasons } : {}),
      ...(patch.material !== undefined ? { material: patch.material } : {}),
      ...(patch.fit !== undefined ? { fit: patch.fit } : {}),
      ...(patch.sizeProfile !== undefined ? { sizeProfile: patch.sizeProfile } : {}),
    });
  }, [detectedItems, updateItem, updatePreExtractItem]);

  return (
    <>
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
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
          if (detectedItems.some(candidate => candidate.tempId === tempId)) {
            const item = detectedItems.find((candidate) => candidate.tempId === tempId);
            if (item) updateItem(tempId, { useCutout: !item.useCutout });
          } else {
            const item = preExtractItems.find((candidate) => candidate.tempId === tempId);
            if (item) updatePreExtractItem(tempId, { useCutout: !item.useCutout });
          }
        }}
        onApplyCrop={handleWorkspaceCropApply}
        onInclusionChange={changes => {
          const apply = <T extends { tempId: string; included?: boolean }>(items: T[]) =>
            applyInclusionChanges(items.map(item => ({ ...item, id: item.tempId })), changes);
          setPreExtractItems(apply);
          setDetectedItems(apply);
          setFailedItems(apply);
        }}
        onKeepBasic={ids => {
          const basics: EditableItem[] = preExtractItems.filter(item => ids.includes(item.tempId)).map(item => ({
            ...item, basicDetails: true, brand: item.brandHint || null, subcategory: null, color: '', style: null, seasons: [], occasions: [], material: null,
            fit: null, pattern: null, neckline: null, sleeveLength: null, care: null, notableDetails: [], colorPalette: [],
            colorNormalized: null, colorTemperature: null, warmthRating: null, sizeProfile: null, purchaseLocation: photoLocationRef.current,
          }));
          setDetectedItems(current => [...current.filter(item => !ids.includes(item.tempId)), ...basics]);
          setFailedItems(current => current.filter(item => !ids.includes(item.tempId)));
        }}
        onExtract={(ids, trigger, reviewedCount, brandCount) => {
          track('closet_scan_extraction_started', {
            mode: 'single',
            trigger,
            reviewed_count: reviewedCount,
            item_count: ids.length,
            brand_count: brandCount,
          });
          void handleStartExtraction(ids);
        }}
        onSave={ids => { void handleSaveAll(ids).catch(() => {
          operationRef.current = false;
          setPhase('review');
          Alert.alert('Couldn’t add these pieces', 'Your edits are safe. Please try again.');
        }); }}
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
});
