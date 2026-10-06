import { confirmSheet } from '../../components/primitives/ConfirmSheet';
import { resolveShoppingPrice, shoppingPriceCandidates } from '../../lib/shoppingPrices';
import { captureItemPrice } from '../../lib/shoppingCapturePrice';
import { formatShoppingPrice, formatShoppingPriceForHome } from '../../lib/shoppingPresentation';
import { PriceCandidateChips, type PriceChoice } from '../../components/shopping/PriceCandidateChips';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { useShoppingItemActions } from '../../hooks/useShoppingItemActions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
  AppState,
  FlatList,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import * as Haptics from '../../lib/haptics';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { ZoomIn, useReducedMotion, useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';

import { useShoppingStoreLocations } from '../../hooks/useShoppingStoreLocations';
import { CaptureStackRail, buildCaptureStacks } from '../../components/shopping/CaptureStackRail';
import { AiActionCoachmark } from '../../components/primitives/AiActionCoachmark';
import { hasSeenAiActionCoach, markAiActionCoachSeen } from '../../lib/aiActionCoach';
import { DraggableCapturePhoto } from '../../components/shopping/DraggableCapturePhoto';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import type { ShoppingCameraScreenProps } from '../../navigation/types';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { processLocalOCR } from '../../lib/processLocalOCR';
import { classifyShoppingCapture } from '../../lib/classifyShoppingCapture';
import { capturePhotoLocationData, resolveShoppingSessionLocation } from '../../lib/photoLocation';
import { createShoppingPreview, deleteShoppingPreview } from '../../lib/shoppingPreviews';
import { evaluateShoppingVisitResume } from '../../lib/shoppingVisit';
import { deleteShoppingSnaps } from '../../lib/deleteShoppingSnaps';
import { discardShoppingVisit } from '../../lib/discardShoppingVisit';
import { useAuth } from '../../contexts/AuthContext';
import type { ShoppingSnap } from '../../types/shoppingSnap';
import {
  buildShoppingStoreSuggestions,
  formatShoppingPlaceLabel,
  nearestVisitedStore,
  type ShoppingStoreSuggestion,
} from '../../lib/shoppingLocations';
import type { ShoppingSessionContext } from '../../stores/useShoppingSessionStore';
import { cameraColors, colors, radii, spacing, typography } from '../../theme';

const CAPTURE_DIRECTORY = new Directory(Paths.document, 'shopping-snaps');

const MAX_GALLERY_IMPORTS = 20;

function sessionPlaceLabel(session: ShoppingSessionContext | null): string | null {
  if (!session) return null;
  if (session.locationStatus === 'resolving') return 'Locating nearby branch…';
  if (session.locationStatus === 'unavailable') return 'Store optional';
  if (!session.storeName && session.locationHint) return session.locationHint;
  return [session.branchLabel, session.locality, session.region]
    .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
    .slice(0, 2)
    .join(' · ') || 'Location attached';
}

function createVisit(now = Date.now()): ShoppingSessionContext {
  return {
    id: Crypto.randomUUID(),
    storeLocationId: null,
    storeName: null,
    branchLabel: null,
    latitude: null,
    longitude: null,
    locationAccuracyMeters: null,
    locality: null,
    region: null,
    countryCode: null,
    locationHint: null,
    locationSource: 'unavailable',
    locationStatus: 'resolving',
    locationCapturedAt: null,
    startedAt: now,
    lastActivityAt: now,
    pausedAt: null,
    endedAt: null,
    lifecycleStatus: 'active',
  };
}

const SHOPPING_PHOTO_MAX_DIM = 1600;
const SHOPPING_PHOTO_COMPRESS = 0.85;

/**
 * Resizes to at most SHOPPING_PHOTO_MAX_DIM on the long edge and re-encodes as
 * JPEG — camera captures and gallery imports otherwise land here byte-for-byte
 * (HEIC/ProRAW originals can be 10-40+ MB). Matches the cap already used for
 * the scan pipeline elsewhere in the app. Output is always JPEG regardless of
 * source format, so the destination is always named `.jpg`.
 */
async function persistShoppingPhoto(
  temporaryUri: string,
  id: string,
  dimensions?: { width: number; height: number },
  crop?: { originX: number; originY: number; width: number; height: number },
): Promise<string> {
  CAPTURE_DIRECTORY.create({ intermediates: true, idempotent: true });

  const actions: ImageManipulator.Action[] = [];
  if (crop) actions.push({ crop });
  if (dimensions && (dimensions.width > SHOPPING_PHOTO_MAX_DIM || dimensions.height > SHOPPING_PHOTO_MAX_DIM)) {
    actions.push(
      dimensions.width >= dimensions.height
        ? { resize: { width: SHOPPING_PHOTO_MAX_DIM } }
        : { resize: { height: SHOPPING_PHOTO_MAX_DIM } },
    );
  }

  const manipulated = await ImageManipulator.manipulateAsync(temporaryUri, actions, {
    compress: SHOPPING_PHOTO_COMPRESS,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const destination = new File(CAPTURE_DIRECTORY, `${id}.jpg`);
  await new File(manipulated.uri).copy(destination);
  return destination.uri;
}

type GuideRect = { x: number; y: number; width: number; height: number };

/**
 * Maps the on-screen framing guide to source pixels. The preview fills the
 * window ("cover"), so the photo is scaled by the larger axis ratio and
 * centred; anything the guide covers is the same region in the capture.
 */
function guideToCrop(
  guide: GuideRect,
  window: { width: number; height: number },
  photo: { width: number; height: number },
) {
  const scale = Math.max(window.width / photo.width, window.height / photo.height);
  const offsetX = (photo.width * scale - window.width) / 2;
  const offsetY = (photo.height * scale - window.height) / 2;
  const originX = Math.max(0, Math.round((guide.x + offsetX) / scale));
  const originY = Math.max(0, Math.round((guide.y + offsetY) / scale));
  return {
    originX,
    originY,
    width: Math.min(photo.width - originX, Math.round(guide.width / scale)),
    height: Math.min(photo.height - originY, Math.round(guide.height / scale)),
  };
}


/** The price read off one photo, short enough for a 52pt thumbnail. */
function photoPriceLabel(photo: { price?: { amount: number | null; currencyCode: string | null; status: string } | null }, homeCurrency: string | null): string | null {
  if (!photo.price || photo.price.status !== 'resolved' || photo.price.amount === null) return null;
  return shortPriceLabel(photo.price.amount, photo.price.currencyCode, homeCurrency);
}

/** Formatted when the currency is known; otherwise just the number, since
 *  "148 · Confirm currency" does not fit anywhere in the camera. */
function shortPriceLabel(amount: number, currencyCode: string | null, homeCurrency: string | null): string {
  return currencyCode ? formatShoppingPriceForHome(amount, currencyCode, homeCurrency) ?? String(amount) : amount.toLocaleString();
}

type TourRect = { x: number; y: number; width: number; height: number };
type CameraTourTarget = 'shutter' | 'newItem' | 'store' | 'library' | 'review';

const CAMERA_TOUR_STEPS: { target: CameraTourTarget; title: string; body: string }[] = [
  {
    target: 'shutter',
    title: 'Shoot the piece, then its tag',
    body: 'Each photo joins the highlighted item. Snap the price tag and Styled reads the price for you.',
  },
  {
    target: 'newItem',
    title: 'One item per piece',
    body: 'Tap + to start the next piece, or tap an item to add to it. Hold a photo and drag it to move it.',
  },
  {
    target: 'store',
    title: 'Note the store',
    body: "Add where you're shopping so you can compare later. Stores you've visited are suggested.",
  },
  {
    target: 'library',
    title: 'Already took photos?',
    body: 'Bring them in from your library. They join the highlighted item.',
  },
  {
    target: 'review',
    title: 'Review when you’re done',
    body: 'Check prices, regroup photos and save the visit to your shortlist.',
  },
];

const TOUR_CALLOUT_WIDTH = 260;
const TOUR_EDGE = 16;
const TOUR_GAP = 14;

/** Controls in the lower half get their tip above them, so it stays on screen. */
function tourCalloutAbove(rect: TourRect, screenHeight: number): boolean {
  return rect.y + rect.height / 2 > screenHeight / 2;
}
function tourCalloutLeft(rect: TourRect, screenWidth: number): number {
  const centre = rect.x + rect.width / 2;
  return Math.min(Math.max(TOUR_EDGE, centre - TOUR_CALLOUT_WIDTH / 2), screenWidth - TOUR_EDGE - TOUR_CALLOUT_WIDTH);
}
function tourCalloutPosition(rect: TourRect, screenWidth: number, screenHeight: number) {
  const left = tourCalloutLeft(rect, screenWidth);
  // Clears the spotlight ring, which sits 6pt outside the control.
  return tourCalloutAbove(rect, screenHeight)
    ? { bottom: screenHeight - rect.y + 6 + TOUR_GAP, left, width: TOUR_CALLOUT_WIDTH }
    : { top: rect.y + rect.height + 6 + TOUR_GAP, left, width: TOUR_CALLOUT_WIDTH };
}
function tourCaretLeft(rect: TourRect, screenWidth: number): number {
  return rect.x + rect.width / 2 - tourCalloutLeft(rect, screenWidth) - 5;
}

export function ShoppingCameraScreen({ navigation }: ShoppingCameraScreenProps) {
  const cameraRef = useRef<CameraView>(null);
  const storeSheetRef = useRef<BottomSheetModal>(null);
  const locationResolutionRef = useRef(new Set<string>());
  const galleryPickerInFlightRef = useRef(false);
  const galleryImportQueueRef = useRef<Promise<void>>(Promise.resolve());
  const ocrQueueRef = useRef<Promise<void>>(Promise.resolve());
  const photoRailRef = useRef<GestureScrollView>(null);
  const reducedMotion = useReducedMotion();
  const deletingRef = useRef(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [galleryImportProgress, setGalleryImportProgress] = useState<{
    imported: number;
    total: number;
  } | null>(null);
  const [storeDraft, setStoreDraft] = useState('');
  const [resumePromptVisible, setResumePromptVisible] = useState(false);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const attachGroupId = useShoppingSessionStore((state) => state.captureAttachmentGroupId);
  const setAttachGroupId = useCallback((value: string | null) => useShoppingSessionStore.setState({ captureAttachmentGroupId: value }), []);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [dockHeight, setDockHeight] = useState(0);
  const flashOpacity = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  useEffect(() => {
    void CameraView.isAvailableAsync().then((available) => {
      if (!available) setCameraError('Camera unavailable. Use Library to add photos.');
    }).catch(() => setCameraError('Camera unavailable. Use Library to add photos.'));
  }, []);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const { data: visitedStoreLocations = [] } = useShoppingStoreLocations();
  const homeCurrency = useCurrencyCode();
  const { saveCatalog, saveOrganization } = useShoppingItemActions();

  const currentStoreName = useShoppingSessionStore((state) => state.currentStoreName);
  const currentSession = useShoppingSessionStore((state) => state.currentSession);
  const recentStores = useShoppingSessionStore((state) => state.recentStores);
  const recentSessions = useShoppingSessionStore((state) => state.recentSessions);
  const resumeVisit = useShoppingSessionStore((state) => state.resumeVisit);
  const pauseVisit = useShoppingSessionStore((state) => state.pauseVisit);
  const assignVisitStore = useShoppingSessionStore((state) => state.assignVisitStore);
  const updateShoppingSessionLocation = useShoppingSessionStore(
    (state) => state.updateShoppingSessionLocation,
  );
  const addPendingUpload = useShoppingSessionStore((state) => state.addPendingUpload);
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const allVisitPreviews = useShoppingSessionStore((state) => state.visitPreviews);
  const recordVisitPreview = useShoppingSessionStore((state) => state.recordVisitPreview);
  const updateVisitPreview = useShoppingSessionStore((state) => state.updateVisitPreview);
  const removeVisitPreview = useShoppingSessionStore((state) => state.removeVisitPreview);
  const assignCaptureGroup = useShoppingSessionStore((state) => state.assignCaptureGroup);
  const visitPreviews = useMemo(
    () => allVisitPreviews
      .filter((preview) => preview.shoppingSessionId === currentSession?.id)
      .sort((a, b) => a.timestamp - b.timestamp || a.captureSequence - b.captureSequence),
    [allVisitPreviews, currentSession?.id],
  );
  const captureStacks = useMemo(() => buildCaptureStacks(visitPreviews), [visitPreviews]);
  const activeItemIndex = captureStacks.findIndex((stack) => stack.groupId === attachGroupId);
  const activeItemNumber = activeItemIndex < 0 ? captureStacks.length + 1 : activeItemIndex + 1;
  const activePhotoCount = activeItemIndex < 0 ? 0 : captureStacks[activeItemIndex].previews.length;
  const activePhotos = activeItemIndex < 0 ? [] : captureStacks[activeItemIndex].previews;
  // A price the shopper already tapped lives on the pending uploads' group
  // catalog (and in the offline mutation queue once they have synced).
  const groupOverrides = useMemo(() => {
    const overrides = new Map<string, PriceChoice>();
    for (const upload of pendingUploads) {
      if (upload.priceOverride != null && !overrides.has(upload.captureGroupId)) {
        overrides.set(upload.captureGroupId, { amount: upload.priceOverride, currencyCode: upload.currencyCode ?? null });
      }
    }
    return overrides;
  }, [pendingUploads]);
  const [pickedPrices, setPickedPrices] = useState<Record<string, PriceChoice>>({});
  const stackPrices = useMemo(() => new Map(captureStacks.map((stack) => [
    stack.groupId,
    captureItemPrice(stack.previews, pickedPrices[stack.groupId] ?? groupOverrides.get(stack.groupId) ?? null),
  ])), [captureStacks, groupOverrides, pickedPrices]);
  const stackPriceLabels = useMemo(() => new Map([...stackPrices].map(([groupId, price]) => [
    groupId,
    price.status === 'resolved' && price.amount !== null ? shortPriceLabel(price.amount, price.currencyCode, homeCurrency) : price.status === 'ambiguous' ? '?' : null,
  ])), [homeCurrency, stackPrices]);
  // A tap of feedback the moment OCR reads a price, since it lands in the
  // background a beat after the shutter. Seeded on mount so resuming a visit
  // doesn't buzz for prices read earlier.
  const announcedPricesRef = useRef<Map<string, string | null> | null>(null);
  useEffect(() => {
    const previous = announcedPricesRef.current;
    announcedPricesRef.current = new Map(stackPriceLabels);
    if (!previous) return;
    for (const [groupId, label] of stackPriceLabels) {
      if (label && label !== '?' && !previous.get(groupId)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      }
    }
  }, [stackPriceLabels]);
  const activePrice = attachGroupId ? stackPrices.get(attachGroupId) ?? null : null;
  const [priceSaveError, setPriceSaveError] = useState<string | null>(null);
  const pickPrice = useCallback((groupId: string, choice: PriceChoice) => {
    setPickedPrices((current) => ({ ...current, [groupId]: choice }));
    setPriceSaveError(null);
    saveCatalog(groupId, { priceOverride: choice.amount, currencyCode: choice.currencyCode })
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        AccessibilityInfo.announceForAccessibility(`Price set to ${formatShoppingPrice(choice.amount, choice.currencyCode) ?? choice.amount}`);
      })
      .catch((error: unknown) => {
        setPickedPrices((current) => { const next = { ...current }; delete next[groupId]; return next; });
        setPriceSaveError(error instanceof Error ? error.message : 'Could not save the price.');
      });
  }, [saveCatalog]);
  const captureBusy = isCapturing || isImporting || isClosing || isDiscarding || isDeleting;
  const exitAllowedRef = useRef(false);
  useEffect(() => {
    if (isFocused) setStatusBarStyle('light');
    return () => setStatusBarStyle('dark');
  }, [isFocused]);
  const selectedPreview = activePhotos.find((preview) => preview.id === selectedPreviewId) ?? null;
  const snapPoints = useMemo(() => ['62%'], []);
  const storeSuggestions = useMemo(
    () => buildShoppingStoreSuggestions({
      query: storeDraft,
      visitedLocations: visitedStoreLocations,
      recentSessions,
      recentStores,
      currentLocation: currentSession,
    }),
    [currentSession, recentSessions, recentStores, storeDraft, visitedStoreLocations],
  );

  // With location on and no store set, offer the visited store we're standing
  // in as a one-tap confirm instead of making the shopper type it.
  const [dismissedNearbyStoreId, setDismissedNearbyStoreId] = useState<string | null>(null);
  const nearbyStore = useMemo(() => {
    if (currentStoreName || currentSession?.locationStatus !== 'resolved') return null;
    const nearest = nearestVisitedStore(buildShoppingStoreSuggestions({
      query: '',
      visitedLocations: visitedStoreLocations,
      recentSessions,
      recentStores,
      currentLocation: currentSession,
    }), currentSession);
    return nearest && nearest.id !== dismissedNearbyStoreId ? nearest : null;
  }, [currentSession, currentStoreName, dismissedNearbyStoreId, recentSessions, recentStores, visitedStoreLocations]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => photoRailRef.current?.scrollToEnd({ animated: !reducedMotion }));
    return () => cancelAnimationFrame(frame);
  }, [activePhotoCount, attachGroupId, reducedMotion]);


  const startBackgroundOCR = useCallback((id: string, localFileUri: string) => {
    // Apple Vision/CoreML can be unstable when many large library photos are
    // submitted concurrently. Keep capture non-blocking, but process OCR one
    // image at a time in the background.
    ocrQueueRef.current = ocrQueueRef.current.then(async () => {
      try {
        const result = await processLocalOCR(localFileUri);
        const pending = useShoppingSessionStore.getState().pendingUploads.find((upload) => upload.id === id);
        const candidates = shoppingPriceCandidates(result.rawOcrText, pending?.countryCode, homeCurrency);
        const price = resolveShoppingPrice(candidates, pending?.countryCode, undefined, homeCurrency);
        const captureRole = classifyShoppingCapture(result.rawOcrText, price.amount, candidates.length > 0);
        useShoppingSessionStore.getState().updatePendingUploadOCR(id, {
          ...result,
          extractedPrice: price.amount,
          captureRole,
          ocrStatus: 'complete',
        });
        useShoppingSessionStore.getState().updateVisitPreview(id, {
          captureRole,
          ocrStatus: 'complete',
          price: { amount: price.amount, currencyCode: price.currencyCode, status: price.status, inferred: price.inferred, candidates: price.candidates },
        });
      } catch (ocrError: unknown) {
        console.warn('Shopping photo OCR failed', ocrError);
        useShoppingSessionStore.getState().updatePendingUploadOCR(id, {
          extractedPrice: null,
          rawOcrText: '',
          captureRole: 'unknown',
          ocrStatus: 'failed',
        });
        useShoppingSessionStore.getState().updateVisitPreview(id, {
          captureRole: 'unknown',
          ocrStatus: 'failed',
          price: null,
        });
      }
    });
  }, [homeCurrency]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const reconcileVisit = useCallback((now = Date.now()) => {
    const state = useShoppingSessionStore.getState();
    if (!state.currentSession) {
      state.ensureActiveVisit(createVisit(now));
      setResumePromptVisible(false);
      return;
    }
    const count = state.visitPreviews.filter(
      (preview) => preview.shoppingSessionId === state.currentSession?.id,
    ).length;
    const decision = evaluateShoppingVisitResume(state.currentSession, count, now);
    if (decision === 'expire') {
      state.visitPreviews.forEach((preview) => deleteShoppingPreview(preview.previewUri));
      state.endVisit(now);
      useShoppingSessionStore.getState().ensureActiveVisit(createVisit(now));
      setResumePromptVisible(false);
    } else if (decision === 'resume') {
      state.resumeVisit(now);
      setResumePromptVisible(false);
    } else {
      setResumePromptVisible(decision === 'prompt');
    }
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    // Closing is a one-way latch while the screen animates out; coming back
    // has to clear it, or the camera returns from the visit review with its
    // shutter and Review button permanently disabled.
    exitAllowedRef.current = false;
    setIsClosing(false);
    setIsDiscarding(false);
    reconcileVisit();
  }, [isFocused, reconcileVisit]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        setResumePromptVisible(false);
        return;
      }
      if (isFocused) reconcileVisit();
    });
    return () => subscription.remove();
  }, [isFocused, reconcileVisit]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  const openStoreSheet = useCallback(() => {
    setStoreDraft(currentStoreName ?? '');
    storeSheetRef.current?.present();
  }, [currentStoreName]);

  const closeStoreSheet = useCallback(() => {
    Keyboard.dismiss();
    storeSheetRef.current?.dismiss();
  }, []);

  const resolveSessionLocation = useCallback((sessionId: string, requestPermissionForLocation = false) => {
    if (locationResolutionRef.current.has(sessionId)) return;
    locationResolutionRef.current.add(sessionId);
    void resolveShoppingSessionLocation({ requestPermission: requestPermissionForLocation }).then((location) => {
      if (!location) {
        updateShoppingSessionLocation(sessionId, {
          locationStatus: 'unavailable',
          locationSource: 'unavailable',
        });
        return;
      }
      updateShoppingSessionLocation(sessionId, {
        latitude: location.latitude,
        longitude: location.longitude,
        locationAccuracyMeters: location.accuracyMeters ?? null,
        branchLabel: location.branchLabel ?? null,
        locality: location.locality ?? null,
        region: location.region ?? null,
        countryCode: location.countryCode ?? null,
        locationHint: location.locationHint ?? null,
        locationCapturedAt: location.capturedAt ?? Date.now(),
        locationSource: 'device',
        locationStatus: 'resolved',
      });
    }).finally(() => {
      locationResolutionRef.current.delete(sessionId);
    });
  }, [updateShoppingSessionLocation]);

  useEffect(() => {
    if (currentSession?.locationStatus === 'resolving') {
      resolveSessionLocation(currentSession.id);
    }
  }, [currentSession, resolveSessionLocation]);

  const chooseStore = useCallback((name: string, suggestion?: ShoppingStoreSuggestion) => {
    const trimmedName = name.trim();
    if (!trimmedName || !currentSession) return;
    const hasResolvedSuggestion = suggestion?.source === 'recent'
      && Boolean(suggestion.locality || suggestion.branchLabel || suggestion.latitude !== null);
    assignVisitStore(currentSession.id, trimmedName, {
      branchLabel: hasResolvedSuggestion ? suggestion?.branchLabel ?? null : currentSession.branchLabel,
      latitude: hasResolvedSuggestion ? suggestion?.latitude ?? null : currentSession.latitude,
      longitude: hasResolvedSuggestion ? suggestion?.longitude ?? null : currentSession.longitude,
      locationAccuracyMeters: hasResolvedSuggestion ? null : currentSession.locationAccuracyMeters,
      locality: hasResolvedSuggestion ? suggestion?.locality ?? null : currentSession.locality,
      region: hasResolvedSuggestion ? suggestion?.region ?? null : currentSession.region,
      countryCode: hasResolvedSuggestion ? suggestion?.countryCode ?? null : currentSession.countryCode,
      locationHint: hasResolvedSuggestion
        ? formatShoppingPlaceLabel(suggestion, { fallback: currentSession.locationHint ?? 'Location captured' })
        : currentSession.locationHint,
      locationSource: hasResolvedSuggestion ? 'recent' : currentSession.locationSource,
      locationStatus: hasResolvedSuggestion ? 'resolved' : currentSession.locationStatus,
      locationCapturedAt: hasResolvedSuggestion ? Date.now() : currentSession.locationCapturedAt,
    });
    if (!hasResolvedSuggestion && currentSession.locationStatus !== 'resolved') {
      resolveSessionLocation(currentSession.id, true);
    }
    closeStoreSheet();
  }, [assignVisitStore, closeStoreSheet, currentSession, resolveSessionLocation]);

  const clearStore = useCallback(() => {
    // "Keep store unset" also turns down the nearby-store suggestion.
    if (nearbyStore) setDismissedNearbyStoreId(nearbyStore.id);
    closeStoreSheet();
  }, [closeStoreSheet, nearbyStore]);

  const importGalleryAssets = useCallback(async (
    session: ShoppingSessionContext | null,
    assets: ImagePicker.ImagePickerAsset[],
    groupId: string,
  ) => {
    let importedCount = 0;
    setGalleryImportProgress({ imported: 0, total: assets.length });

    try {
      const importSessionId = session?.id ?? null;
      for (const asset of assets) {
        try {
          const id = Crypto.randomUUID();
          const photoLocation = await capturePhotoLocationData(asset.exif, false);
          const coordinates = photoLocation
            ? { latitude: photoLocation.latitude, longitude: photoLocation.longitude }
            : null;
          const localFileUri = await persistShoppingPhoto(
            asset.uri,
            id,
            asset.width && asset.height ? { width: asset.width, height: asset.height } : undefined,
          );
          const timestamp = Date.now();
          const captureGroup = assignCaptureGroup(importSessionId, groupId, timestamp);

          addPendingUpload({
            id,
            groupingExplicit: true,
            localFileUri,
            previewUri: null,
            storeName: session?.storeName ?? null,
            storeLocationId: coordinates ? null : session?.storeLocationId ?? null,
            // An EXIF-tagged library photo gets its own location session so
            // imports from different cities never overwrite one another.
            shoppingSessionId: importSessionId,
            sessionStartedAt: coordinates ? Date.now() : session?.startedAt ?? null,
            latitude: photoLocation?.latitude ?? session?.latitude ?? null,
            longitude: photoLocation?.longitude ?? session?.longitude ?? null,
            locationAccuracyMeters: photoLocation?.accuracyMeters ?? (coordinates ? null : session?.locationAccuracyMeters ?? null),
            locality: photoLocation?.locality ?? (coordinates ? null : session?.locality ?? null),
            region: photoLocation?.region ?? (coordinates ? null : session?.region ?? null),
            countryCode: photoLocation?.countryCode ?? (coordinates ? null : session?.countryCode ?? null),
            branchLabel: photoLocation?.branchLabel ?? (coordinates ? null : session?.branchLabel ?? null),
            locationHint: photoLocation?.locationHint ?? (coordinates ? null : session?.locationHint ?? null),
            locationSource: photoLocation ? 'photo_exif' : session?.locationSource ?? 'unavailable',
            locationStatus: photoLocation?.countryCode || photoLocation?.locality ? 'resolved' : session?.locationStatus ?? 'unavailable',
            locationCapturedAt: photoLocation?.capturedAt ?? (coordinates ? Date.now() : session?.locationCapturedAt ?? null),
            captureGroupId: captureGroup.groupId,
            captureGroupStartedAt: captureGroup.groupStartedAt,
            captureSequence: captureGroup.sequence,
            captureRole: 'unknown',
            extractedPrice: null,
            rawOcrText: '',
            ocrStatus: 'processing',
            timestamp,
          });
          if (session) {
            recordVisitPreview({
              id,
              groupingExplicit: true,
              shoppingSessionId: session.id,
              captureGroupId: captureGroup.groupId,
              captureSequence: captureGroup.sequence,
              localFileUri,
              previewUri: null,
              captureRole: 'unknown',
              ocrStatus: 'processing',
              syncStatus: 'pending',
              storagePath: null,
              timestamp,
            });
            void createShoppingPreview(localFileUri, id)
              .then((previewUri) => updateVisitPreview(id, { previewUri }))
              .catch(() => undefined);
          }
          setAttachGroupId(captureGroup.groupId);
          startBackgroundOCR(id, localFileUri);
          importedCount += 1;
          setGalleryImportProgress({ imported: importedCount, total: assets.length });
        } catch (assetError) {
          console.warn('Gallery photo import failed', assetError);
        }
      }

      if (importedCount > 0) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (importedCount < assets.length) {
        Alert.alert(
          'Some photos were not imported',
          `${importedCount} of ${assets.length} photos were saved.`,
        );
      }
    } finally {
      setTimeout(() => {
        setGalleryImportProgress(null);
      }, importedCount > 0 ? 900 : 0);
    }
  }, [addPendingUpload, assignCaptureGroup, recordVisitPreview, setAttachGroupId, startBackgroundOCR, updateVisitPreview]);

  const enqueueGalleryImport = useCallback((
    session: ShoppingSessionContext | null,
    assets: ImagePicker.ImagePickerAsset[],
  ) => {
    const groupId = attachGroupId ?? Crypto.randomUUID();
    galleryImportQueueRef.current = galleryImportQueueRef.current
      .catch((error) => {
        console.warn('Previous gallery import failed', error);
      })
      .then(() => importGalleryAssets(session, assets, groupId))
      .catch((error) => {
        console.warn('Gallery import failed', error);
        Alert.alert(
          'Photos not imported',
          error instanceof Error ? error.message : 'Please try again.',
        );
      });
    return galleryImportQueueRef.current;
  }, [attachGroupId, importGalleryAssets]);

  const resumeCameraPreview = useCallback(() => {
    if (isFocused && !isClosing) {
      requestAnimationFrame(() => {
        void cameraRef.current?.resumePreview().catch(() => undefined);
      });
    }
  }, [isClosing, isFocused]);

  const releaseCamera = useCallback(() => {
    exitAllowedRef.current = true;
    setIsClosing(true);
    setCameraReady(false);
    storeSheetRef.current?.dismiss();
    void cameraRef.current?.pausePreview().catch(() => undefined);
  }, []);

  // Review keeps the visit available so shoppers can return for more photos.
  const closeCamera = useCallback(() => {
    if (captureBusy) return;
    const sessionId = currentSession?.id ?? null;
    const hasCaptures = visitPreviews.length > 0;
    pauseVisit();
    releaseCamera();
    requestAnimationFrame(() => {
      if (sessionId && hasCaptures) navigation.navigate('ShoppingVisitReview', { sessionId });
      else navigation.goBack();
    });
  }, [captureBusy, currentSession?.id, navigation, pauseVisit, releaseCamera, visitPreviews.length]);

  const confirmResumeVisit = useCallback(() => {
    resumeVisit();
    setResumePromptVisible(false);
  }, [resumeVisit]);

  const startFreshVisit = useCallback(() => {
    const state = useShoppingSessionStore.getState();
    state.visitPreviews.forEach((preview) => deleteShoppingPreview(preview.previewUri));
    state.endVisit();
    useShoppingSessionStore.getState().ensureActiveVisit(createVisit());
    setResumePromptVisible(false);
  }, []);

  const importFromGallery = useCallback(async (session: ShoppingSessionContext | null) => {
    if (galleryPickerInFlightRef.current) return;
    galleryPickerInFlightRef.current = true;
    setIsImporting(true);

    try {
      void Haptics.selectionAsync();
      // Fully stop the live capture session before presenting PHPicker. State
      // updates alone are not committed synchronously on the tap event.
      await cameraRef.current?.pausePreview().catch(() => undefined);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: MAX_GALLERY_IMPORTS,
        quality: 1,
        exif: true,
      });
      if (result.canceled || !result.assets.length) return;

      await enqueueGalleryImport(session, result.assets);
    } catch (error) {
      Alert.alert(
        'Photos not imported',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      galleryPickerInFlightRef.current = false;
      setIsImporting(false);
      resumeCameraPreview();
    }
  }, [enqueueGalleryImport, resumeCameraPreview]);

  // The library button always opens the system picker. A store is optional
  // here, exactly as it is for a shutter capture — the pill above stays the
  // one place to attach one.
  const openGallery = useCallback(() => {
    void importFromGallery(currentSession);
  }, [currentSession, importFromGallery]);

  const cameraActive = isFocused && !isImporting && !isClosing && !resumePromptVisible && !selectedPreview;
  // iOS drops the torch whenever the session pauses; keep the toggle honest.
  useEffect(() => {
    if (!cameraActive) setTorchOn(false);
  }, [cameraActive]);

  // 3:4 framing guide, centred in the strip of viewfinder that no chrome
  // covers. Measured from layout so it tracks the photo rail appearing.
  const guideRect = useMemo<GuideRect | null>(() => {
    if (cameraError || !topBarHeight || !dockHeight) return null;
    const freeTop = topBarHeight + spacing.sm;
    const freeBottom = windowHeight - dockHeight - spacing.sm;
    const width = Math.floor(Math.min(windowWidth - spacing.xxl * 2, (freeBottom - freeTop) * 3 / 4));
    if (width < 120) return null;
    const height = Math.round(width * 4 / 3);
    return { x: Math.round((windowWidth - width) / 2), y: Math.round(freeTop + (freeBottom - freeTop - height) / 2), width, height };
  }, [cameraError, dockHeight, topBarHeight, windowHeight, windowWidth]);

  const toggleTorch = useCallback(() => {
    void Haptics.selectionAsync();
    setTorchOn((value) => !value);
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || isCapturing) return;

    setIsCapturing(true);
    const id = Crypto.randomUUID();
    const capturedSession = currentSession;

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        shutterSound: false,
      });
      if (!reducedMotion) {
        flashOpacity.value = withSequence(withTiming(0.85, { duration: 40 }), withTiming(0, { duration: 140 }));
      }
      const crop = guideRect
        ? guideToCrop(guideRect, { width: windowWidth, height: windowHeight }, { width: photo.width, height: photo.height })
        : undefined;
      const localFileUri = await persistShoppingPhoto(
        photo.uri, id, crop ? { width: crop.width, height: crop.height } : { width: photo.width, height: photo.height }, crop,
      );
      const timestamp = Date.now();
      const captureGroup = assignCaptureGroup(
        capturedSession?.id ?? null,
        attachGroupId ?? Crypto.randomUUID(),
        timestamp,
      );

      // Queueing immediately keeps the saved photo visible and durable before
      // background OCR begins.
      addPendingUpload({
        id,
        groupingExplicit: true,
        localFileUri,
        previewUri: null,
            storeName: capturedSession?.storeName ?? null,
            storeLocationId: capturedSession?.storeLocationId ?? null,
        shoppingSessionId: capturedSession?.id ?? null,
        sessionStartedAt: capturedSession?.startedAt ?? null,
        latitude: capturedSession?.latitude ?? null,
        longitude: capturedSession?.longitude ?? null,
        locationAccuracyMeters: capturedSession?.locationAccuracyMeters ?? null,
        locality: capturedSession?.locality ?? null,
        region: capturedSession?.region ?? null,
        countryCode: capturedSession?.countryCode ?? null,
        branchLabel: capturedSession?.branchLabel ?? null,
        locationHint: capturedSession?.locationHint ?? null,
        locationSource: capturedSession?.locationSource ?? 'unavailable',
        locationStatus: capturedSession?.locationStatus ?? 'unavailable',
        locationCapturedAt: capturedSession?.locationCapturedAt ?? null,
        captureGroupId: captureGroup.groupId,
        captureGroupStartedAt: captureGroup.groupStartedAt,
        captureSequence: captureGroup.sequence,
        captureRole: 'unknown',
        extractedPrice: null,
        rawOcrText: '',
        ocrStatus: 'processing',
        timestamp,
      });
      if (capturedSession) {
        recordVisitPreview({
          id,
          groupingExplicit: true,
          shoppingSessionId: capturedSession.id,
          captureGroupId: captureGroup.groupId,
          captureSequence: captureGroup.sequence,
          localFileUri,
          previewUri: null,
          captureRole: 'unknown',
          ocrStatus: 'processing',
          syncStatus: 'pending',
          storagePath: null,
          timestamp,
        });
        void createShoppingPreview(localFileUri, id)
          .then((previewUri) => updateVisitPreview(id, { previewUri }))
          .catch(() => undefined);
      }

      setAttachGroupId(captureGroup.groupId);

      // Do not await OCR: the camera is released as soon as the durable local
      // file and queue record exist.
      startBackgroundOCR(id, localFileUri);
    } catch (error) {
      Alert.alert(
        'Photo not saved',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsCapturing(false);
    }
  }, [attachGroupId, addPendingUpload, assignCaptureGroup, cameraReady, currentSession, flashOpacity, guideRect, isCapturing, recordVisitPreview, reducedMotion, setAttachGroupId, startBackgroundOCR, updateVisitPreview, windowHeight, windowWidth]);

  const startNextItem = useCallback(() => {
    if (captureBusy) return;
    setAttachGroupId(null);
    void Haptics.selectionAsync();
    AccessibilityInfo.announceForAccessibility('New item. Add your first photo.');
  }, [captureBusy, setAttachGroupId]);

  const selectStack = useCallback((groupId: string | null) => {
    if (captureBusy || deletingRef.current) return;
    if (groupId === null) {
      startNextItem();
      return;
    }
    setAttachGroupId(groupId);
    void Haptics.selectionAsync();
    const index = captureStacks.findIndex((stack) => stack.groupId === groupId);
    AccessibilityInfo.announceForAccessibility(`Item ${index < 0 ? captureStacks.length + 1 : index + 1} selected`);
  }, [captureBusy, captureStacks, setAttachGroupId, startNextItem]);

  // ── Drag a photo from the active strip onto another item ─────────────────
  const rootRef = useRef<View>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const rootX = useSharedValue(0);
  const rootY = useSharedValue(0);
  const [draggingPhotoId, setDraggingPhotoId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const dropTargetKeyRef = useRef<string | null>(null);
  // The gesture callbacks read the drag through a ref so they stay stable —
  // rebuilding the gesture mid-drag would cancel it.
  const draggingPhotoIdRef = useRef<string | null>(null);
  const dropTargetViews = useRef(new Map<string, View>());
  const dropTargetRects = useRef(new Map<string, { x: number; y: number; width: number; height: number }>());
  const draggingPhoto = draggingPhotoId ? visitPreviews.find((preview) => preview.id === draggingPhotoId) ?? null : null;

  const registerDropTarget = useCallback((key: string, view: View | null) => {
    if (view) dropTargetViews.current.set(key, view);
    else dropTargetViews.current.delete(key);
  }, []);

  // ── First-run tour ──────────────────────────────────────────────────────
  // The camera packs several ideas (items, tags, store, review) into icons and
  // a rail, so a first visit walks through them once, pointing at each control.
  const shutterRef = useRef<View>(null);
  const storePillRef = useRef<View>(null);
  const libraryRef = useRef<View>(null);
  const reviewRef = useRef<View>(null);
  const [tour, setTour] = useState<{ step: number; rect: TourRect } | null>(null);
  const tourTargets = useMemo<Record<CameraTourTarget, () => View | null | undefined>>(() => ({
    shutter: () => shutterRef.current,
    newItem: () => dropTargetViews.current.get('empty'),
    store: () => storePillRef.current,
    library: () => libraryRef.current,
    review: () => reviewRef.current,
  }), []);

  const endTour = useCallback(() => {
    const userId = user?.id;
    setTour(null);
    if (userId) void markAiActionCoachSeen('shopping_camera_tour', userId);
  }, [user?.id]);

  // A control that isn't on screen yet (the item rail before the first photo)
  // is skipped rather than ending the tour, so the tour always finishes and
  // is marked seen.
  const showTourStep = useCallback((step: number) => {
    if (step >= CAMERA_TOUR_STEPS.length) { endTour(); return; }
    const view = tourTargets[CAMERA_TOUR_STEPS[step].target]();
    if (!view) { showTourStep(step + 1); return; }
    view.measureInWindow((x, y, width, height) => {
      if (!width || !height) showTourStep(step + 1);
      else setTour({ step, rect: { x, y, width, height } });
    });
  }, [endTour, tourTargets]);

  const tourBlocked = !isFocused || !user?.id || !permission?.granted && !cameraError
    || resumePromptVisible || Boolean(selectedPreview) || captureBusy;
  useEffect(() => {
    const userId = user?.id;
    if (tourBlocked || tour || !userId) return undefined;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    hasSeenAiActionCoach('shopping_camera_tour', userId)
      .then((seen) => {
        if (!active || seen) return;
        // Lets the dock lay out and the camera settle before anything dims it.
        timer = setTimeout(() => { if (active) showTourStep(0); }, 700);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [showTourStep, tour, tourBlocked, user?.id]);

  const advanceTour = useCallback(() => {
    if (tour) showTourStep(tour.step + 1);
  }, [showTourStep, tour]);

  /** Which tile a finger at window point (x, y) would drop on. A photo's own
   *  item never is, nor is "+" when the photo is already alone. */
  const hitDropTarget = useCallback((x: number, y: number, photoId: string): string | null => {
    const photo = useShoppingSessionStore.getState().visitPreviews.find((preview) => preview.id === photoId);
    if (!photo) return null;
    const alone = useShoppingSessionStore.getState().visitPreviews.filter((preview) => preview.captureGroupId === photo.captureGroupId).length === 1;
    const slop = 10;
    for (const [key, rect] of dropTargetRects.current) {
      if (key === photo.captureGroupId || (key === 'empty' && alone)) continue;
      if (x >= rect.x - slop && x <= rect.x + rect.width + slop && y >= rect.y - slop && y <= rect.y + rect.height + slop) return key;
    }
    return null;
  }, []);

  const movePhotoToItem = useCallback((photoId: string, targetKey: string) => {
    const state = useShoppingSessionStore.getState();
    const photo = state.visitPreviews.find((preview) => preview.id === photoId);
    if (!photo || targetKey === photo.captureGroupId) return;
    const sourceCount = state.visitPreviews.filter((preview) => preview.captureGroupId === photo.captureGroupId).length;
    if (targetKey === 'empty' && sourceCount === 1) return;
    const destGroupId = targetKey === 'empty' ? Crypto.randomUUID() : targetKey;
    const destPreviews = state.visitPreviews.filter((preview) => preview.captureGroupId === destGroupId);
    const destUpload = state.pendingUploads.find((upload) => upload.captureGroupId === destGroupId);
    void saveOrganization([{
      snapId: photo.id,
      captureGroupId: destGroupId,
      captureGroupStartedAt: destUpload?.captureGroupStartedAt
        ?? (destPreviews.length ? Math.min(...destPreviews.map((preview) => preview.timestamp)) : photo.timestamp),
      captureRole: photo.captureRole,
      captureSequence: destPreviews.reduce((max, preview) => Math.max(max, preview.captureSequence), -1) + 1,
    }]).then(() => {
      useShoppingSessionStore.setState((current) => {
        const moved = current.visitPreviews.find((preview) => preview.id === photoId);
        if (!moved) return {};
        // Stacks are numbered by first appearance, so the photo goes after its
        // new item's last photo (or to the end for a new item) — that keeps the
        // existing items' numbers where the shopper left them.
        const rest = current.visitPreviews.filter((preview) => preview.id !== photoId);
        let insertAt = rest.length;
        rest.forEach((preview, index) => { if (preview.captureGroupId === destGroupId) insertAt = index + 1; });
        rest.splice(insertAt, 0, moved);
        // A price the shopper tapped belongs to the item, not the photo — the
        // moved upload takes its new item's choice (or none) instead.
        const destOverride = current.pendingUploads.find((upload) => upload.id !== photoId
          && upload.captureGroupId === destGroupId && upload.priceOverride != null);
        return {
          visitPreviews: rest,
          pendingUploads: current.pendingUploads.map((upload) => upload.id === photoId && upload.priceOverride != null
            ? { ...upload, priceOverride: destOverride?.priceOverride ?? null, currencyCode: destOverride ? destOverride.currencyCode : upload.currencyCode }
            : upload),
        };
      });
      if (sourceCount === 1) setAttachGroupId(destGroupId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const stacks = buildCaptureStacks(useShoppingSessionStore.getState().visitPreviews);
      const number = stacks.findIndex((stack) => stack.groupId === destGroupId) + 1;
      AccessibilityInfo.announceForAccessibility(`Photo moved to item ${number}`);
    }).catch((error: unknown) => {
      Alert.alert('Photo not moved', error instanceof Error ? error.message : 'Please try again.');
    });
  }, [saveOrganization, setAttachGroupId]);

  const startPhotoDrag = useCallback((photoId: string) => {
    if (captureBusy || deletingRef.current) return;
    draggingPhotoIdRef.current = photoId;
    setDraggingPhotoId(photoId);
    dropTargetRects.current.clear();
    rootRef.current?.measureInWindow((x, y) => { rootX.value = x; rootY.value = y; });
    for (const [key, view] of dropTargetViews.current) {
      view.measureInWindow((x, y, width, height) => dropTargetRects.current.set(key, { x, y, width, height }));
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [captureBusy, rootX, rootY]);

  const movePhotoDrag = useCallback((x: number, y: number) => {
    const photoId = draggingPhotoIdRef.current;
    if (!photoId) return;
    const key = hitDropTarget(x, y, photoId);
    if (key === dropTargetKeyRef.current) return;
    dropTargetKeyRef.current = key;
    setDropTargetKey(key);
    if (key) void Haptics.selectionAsync();
  }, [hitDropTarget]);

  const endPhotoDrag = useCallback((x: number, y: number, cancelled: boolean) => {
    const photoId = draggingPhotoIdRef.current;
    draggingPhotoIdRef.current = null;
    setDraggingPhotoId(null);
    setDropTargetKey(null);
    dropTargetKeyRef.current = null;
    if (!photoId || cancelled) return;
    const key = hitDropTarget(x, y, photoId);
    if (key) movePhotoToItem(photoId, key);
  }, [hitDropTarget, movePhotoToItem]);

  const dragGhostStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value - rootX.value - DRAG_GHOST_W / 2 },
      // Lifted above the fingertip so the photo stays visible while dragging.
      { translateY: dragY.value - rootY.value - DRAG_GHOST_H - 12 },
      { scale: 1.08 },
    ],
  }));

  const previewToSnap = useCallback((preview: (typeof visitPreviews)[number]): ShoppingSnap => {
    const upload = pendingUploads.find((item) => item.id === preview.id);
    return {
      id: preview.id,
      imageUri: preview.syncStatus === 'pending'
        ? preview.localFileUri
        : preview.previewUri ?? preview.localFileUri,
      storagePath: preview.storagePath,
      storeName: currentSession?.storeName ?? upload?.storeName ?? null,
      storeLocationId: currentSession?.storeLocationId ?? upload?.storeLocationId ?? null,
      shoppingSessionId: preview.shoppingSessionId,
      captureGroupId: preview.captureGroupId,
      captureRole: preview.captureRole,
      captureSequence: preview.captureSequence,
      branchLabel: currentSession?.branchLabel ?? upload?.branchLabel ?? null,
      latitude: currentSession?.latitude ?? upload?.latitude ?? null,
      longitude: currentSession?.longitude ?? upload?.longitude ?? null,
      locationAccuracyMeters: currentSession?.locationAccuracyMeters ?? upload?.locationAccuracyMeters ?? null,
      locality: currentSession?.locality ?? upload?.locality ?? null,
      region: currentSession?.region ?? upload?.region ?? null,
      countryCode: currentSession?.countryCode ?? upload?.countryCode ?? null,
      locationHint: currentSession?.locationHint ?? upload?.locationHint ?? null,
      locationSource: currentSession?.locationSource ?? upload?.locationSource ?? null,
      extractedPrice: upload?.extractedPrice ?? null,
      rawOcrText: upload?.rawOcrText ?? '',
      capturedAt: new Date(preview.timestamp).toISOString(),
      syncStatus: preview.syncStatus,
      category: upload?.category ?? null,
      sizeLabel: upload?.sizeLabel ?? null,
      colorLabel: upload?.colorLabel ?? null,
      materialLabel: upload?.materialLabel ?? null,
      notes: upload?.notes ?? null,
      isFavorite: upload?.isFavorite ?? false,
      catalogStatus: upload?.catalogStatus ?? 'considering',
    };
  }, [currentSession, pendingUploads]);

  const confirmDeletePreview = useCallback((previewId: string) => {
    if (captureBusy || deletingRef.current) return;
    const preview = visitPreviews.find((candidate) => candidate.id === previewId);
    if (!preview) return;
    confirmSheet({
      title: 'Delete this photo?',
      message: 'It will be removed from this visit. Your phone’s photo library is not changed.',
      images: preview.previewUri ? [preview.previewUri] : undefined,
      confirmLabel: 'Delete photo',
      destructive: true,
      onConfirm: () => {
          if (deletingRef.current) return;
          deletingRef.current = true;
          setIsDeleting(true);
          const latestPreview = useShoppingSessionStore.getState().visitPreviews.find((item) => item.id === preview.id) ?? preview;
          const snap = previewToSnap(latestPreview);
          const lastInGroup = visitPreviews.filter((item) => item.captureGroupId === preview.captureGroupId).length === 1;
          void deleteShoppingSnaps([snap], user?.id ?? null)
            .then(() => {
              deleteShoppingPreview(preview.previewUri);
              removeVisitPreview(preview.id);
              setSelectedPreviewId(null);
              if (lastInGroup) setAttachGroupId(null);
              AccessibilityInfo.announceForAccessibility('Photo deleted');
            })
            .catch((error) => {
              // The deletion helper removes previews optimistically. Restore
              // the failed photo for retry while retaining its upload tombstone.
              recordVisitPreview(latestPreview);
              Alert.alert('Could not delete photo', error instanceof Error ? error.message : 'Please try again.');
            })
            .finally(() => {
              deletingRef.current = false;
              setIsDeleting(false);
            });
      },
    });
  }, [captureBusy, previewToSnap, recordVisitPreview, removeVisitPreview, setAttachGroupId, user?.id, visitPreviews]);

  const cancelCamera = useCallback(() => {
    if (captureBusy) return;
    const leave = () => {
      useShoppingSessionStore.getState().endVisit();
      releaseCamera();
      requestAnimationFrame(() => navigation.goBack());
    };
    if (visitPreviews.length === 0) {
      leave();
      return;
    }
    confirmSheet({
      title: 'Discard this visit?',
      message: `All ${visitPreviews.length} photo${visitPreviews.length === 1 ? '' : 's'} from this visit will be removed from Shopping. Your phone’s photo library will not be changed.`,
      images: visitPreviews.map((preview) => preview.previewUri).filter((uri): uri is string => Boolean(uri)),
      confirmLabel: 'Discard photos',
      cancelLabel: 'Keep taking photos',
      destructive: true,
      onConfirm: async () => {
        setIsDiscarding(true);
        try {
          if (currentSession) await discardShoppingVisit(currentSession.id, user?.id ?? null, previewToSnap);
          leave();
        } catch (error) {
          setIsDiscarding(false);
          Alert.alert('Could not discard all photos', error instanceof Error ? error.message : 'Please try again.');
        }
      },
    });
  }, [captureBusy, currentSession, navigation, previewToSnap, releaseCamera, user, visitPreviews]);

  usePreventRemove(!isClosing, () => {
    if (!exitAllowedRef.current) cancelCamera();
  });

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionRoot}>
        <StatusBar style="dark" />
        <Ionicons name="camera-outline" size={44} color={colors.primary} />
        <Text style={styles.permissionTitle}>Camera access is required</Text>
        <Text style={styles.permissionText}>
          Allow camera access to photograph a piece and its price tag.
        </Text>
        {permission.canAskAgain ? (
          <TouchableOpacity style={styles.permissionButton} onPress={() => void requestPermission()}>
            <Text style={styles.permissionButtonText}>Allow camera</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={cancelCamera}>
          <Text style={styles.cancelText}>Back to Shop</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View ref={rootRef} style={styles.root}>
      {isFocused ? <StatusBar style="light" /> : null}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        active={cameraActive}
        enableTorch={torchOn}
        facing="back"
        mode="picture"
        onCameraReady={() => setCameraReady(true)}
        onMountError={() => setCameraError('Camera unavailable. You can still add photos from your library.')}
      />

      <LinearGradient
        pointerEvents="none"
        colors={[cameraColors.overlayStrong, 'transparent']}
        locations={[0, 1]}
        style={styles.topScrim}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', cameraColors.overlayStrong]}
        locations={[0, 1]}
        style={styles.bottomScrim}
      />
      <Animated.View pointerEvents="none" style={[styles.captureFlash, flashStyle]} />

      {guideRect ? (
        <View pointerEvents="none" style={[styles.guide, { left: guideRect.x, top: guideRect.y, width: guideRect.width, height: guideRect.height }]}>
          <View style={styles.guideThirdsVertical} />
          <View style={styles.guideThirdsHorizontal} />
        </View>
      ) : null}

      <View style={[styles.topControls, { paddingTop: insets.top + spacing.xs }]}
        onLayout={(event) => setTopBarHeight(event.nativeEvent.layout.height)}>
        <TouchableOpacity style={[styles.doneButton, styles.cancelButton]} onPress={cancelCamera} disabled={captureBusy} accessibilityRole="button" accessibilityLabel="Cancel shopping visit">
          <Text style={styles.doneButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          ref={storePillRef}
          style={styles.contextPill}
          onPress={openStoreSheet}
          activeOpacity={0.8}
          accessibilityLabel={currentStoreName
            ? `Current store ${currentStoreName}, ${sessionPlaceLabel(currentSession)}, tap to change`
            : nearbyStore ? `Suggested store ${nearbyStore.storeName}, tap to choose a different store` : 'Tap to add store'}
        >
          <Ionicons name="location-outline" size={15} color={cameraColors.onCamera} />
          <Text style={styles.contextPillText} numberOfLines={1}>
            {currentStoreName ?? (nearbyStore ? `At ${nearbyStore.storeName}?` : 'Add store')}
          </Text>
          {nearbyStore ? (
            <TouchableOpacity
              style={styles.nearbyConfirm}
              onPress={() => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                chooseStore(nearbyStore.storeName, nearbyStore);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Yes, I'm at ${nearbyStore.storeName}`}
              accessibilityHint="Sets this visit's store. Tap the store name to choose a different one."
            >
              <Ionicons name="checkmark" size={15} color={cameraColors.backdrop} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          ref={reviewRef}
          style={[styles.doneButton, visitPreviews.length > 0 ? styles.reviewButton : styles.reviewButtonEmpty, captureBusy && styles.sameItemButtonDisabled]}
          onPress={closeCamera}
          disabled={captureBusy || visitPreviews.length === 0}
          accessibilityLabel={visitPreviews.length > 0
            ? `Review ${captureStacks.length} item${captureStacks.length === 1 ? '' : 's'}`
            : 'Take a photo to review items'}
        >
          <Text style={[styles.doneButtonText, visitPreviews.length === 0 && styles.doneButtonTextMuted]}>
            {isDiscarding ? 'Wait…' : `Review${captureStacks.length > 0 ? ` · ${captureStacks.length}` : ''}`}
          </Text>
        </TouchableOpacity>
      </View>

      {galleryImportProgress ? (
        <View style={[styles.importStatusPill, { top: insets.top + 54 }]}>
          <ActivityIndicator color={cameraColors.onCamera} size="small" />
          <Text style={styles.importStatusText}>
            Adding {galleryImportProgress.imported}/{galleryImportProgress.total} photos to this item
          </Text>
        </View>
      ) : null}

      {cameraError ? (
        <View style={styles.cameraUnavailableState} accessibilityRole="alert">
          <View style={styles.cameraUnavailableIcon}>
            <Ionicons name="camera-outline" size={20} color={cameraColors.onCamera} />
          </View>
          <Text style={styles.cameraUnavailableTitle}>Camera unavailable</Text>
          <Text selectable style={styles.cameraUnavailableText}>Add photos from your library instead.</Text>
          <TouchableOpacity
            style={styles.cameraUnavailableButton}
            onPress={openGallery}
            disabled={captureBusy}
            accessibilityRole="button"
            accessibilityLabel="Choose photos from your library"
          >
            <Ionicons name="images-outline" size={17} color={cameraColors.ctaForeground} />
            <Text style={styles.cameraUnavailableButtonText}>Choose from Library</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.bottomDock} pointerEvents="box-none"
        onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}>
        {visitPreviews.length === 0 && !galleryImportProgress ? <Text style={styles.captureGuidance}>Start with the piece. Add its price tag if you have it.</Text> : null}
        {activePrice?.status === 'missing' && activePhotos.some((photo) => photo.captureRole === 'tag') ? (
          <Text style={styles.captureGuidance}>No price read — retake the tag closer.</Text>
        ) : null}
        {activePrice && attachGroupId && (activePrice.status === 'ambiguous' || (activePrice.inferred && !activePrice.confirmed)) ? (
          <View style={styles.priceChooser}>
            <PriceCandidateChips
              tone="camera"
              prompt={activePrice.status === 'ambiguous' ? 'Which price?' : 'Price'}
              candidates={activePrice.candidates}
              selected={activePrice.amount !== null ? { amount: activePrice.amount, currencyCode: activePrice.currencyCode } : null}
              disabled={captureBusy}
              onPick={(choice) => pickPrice(attachGroupId, choice)}
            />
            {priceSaveError ? <Text style={styles.priceChooserError}>{priceSaveError}</Text> : null}
          </View>
        ) : null}
        {activePhotos.length > 0 ? (
          <View style={styles.activePhotosRail}>
            <GestureScrollView ref={photoRailRef} horizontal showsHorizontalScrollIndicator={false}
              scrollEnabled={!draggingPhotoId}
              style={styles.photoViewport} contentContainerStyle={styles.photoRail}
              onContentSizeChange={() => photoRailRef.current?.scrollToEnd({ animated: !reducedMotion })}>
              {activePhotos.map((photo, index) => {
                // Once the shopper has confirmed a price, every photo of the
                // item wears it; until then each shows what it read.
                const photoPrice = activePrice?.confirmed && attachGroupId ? stackPriceLabels.get(attachGroupId) ?? null : photoPriceLabel(photo, homeCurrency);
                return (
                <Animated.View key={photo.id} entering={reducedMotion ? undefined : ZoomIn.duration(220)}>
                  <DraggableCapturePhoto photoId={photo.id} disabled={captureBusy}
                    dragX={dragX} dragY={dragY}
                    style={[styles.photoButton, draggingPhotoId === photo.id && styles.photoButtonLifted]}
                    accessibilityLabel={`Open photo ${index + 1} of item ${activeItemNumber}${photo.captureRole === 'tag' ? ', price tag' : ''}${photoPrice ? `, ${photoPrice}` : ''}`}
                    accessibilityHint="Opens the photo. Hold and drag onto another item to move it."
                    accessibilityActions={[
                      ...(activePhotos.length > 1 ? [{ name: 'move:empty', label: 'Move to new item' }] : []),
                      ...captureStacks.flatMap((stack, stackIndex) => stack.groupId === attachGroupId ? []
                        : [{ name: `move:${stack.groupId}`, label: `Move to item ${stackIndex + 1}` }]),
                    ]}
                    onAccessibilityAction={(name) => { if (name.startsWith('move:')) movePhotoToItem(photo.id, name.slice(5)); }}
                    onOpen={setSelectedPreviewId}
                    onDragStart={startPhotoDrag}
                    onDragMove={movePhotoDrag}
                    onDragEnd={endPhotoDrag}>
                    <Image source={{ uri: photo.previewUri ?? photo.localFileUri }} contentFit="cover" style={styles.photoThumbnail} />
                    {photoPrice ? (
                      <View style={styles.pricePill}>
                        <Text style={styles.pricePillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{photoPrice}</Text>
                      </View>
                    ) : photo.price?.status === 'ambiguous' ? (
                      <View style={styles.roleGlyph}>
                        <Text style={styles.roleGlyphText}>?</Text>
                      </View>
                    ) : photo.captureRole === 'tag' ? (
                      <View style={styles.roleGlyph}>
                        <Ionicons name="pricetag" size={10} color={cameraColors.backdrop} />
                      </View>
                    ) : null}
                  </DraggableCapturePhoto>
                </Animated.View>
                );
              })}
            </GestureScrollView>
          </View>
        ) : null}
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + spacing.lg }]}>
          <CaptureStackRail
            stacks={captureStacks}
            priceLabels={stackPriceLabels}
            activeGroupId={attachGroupId}
            showEmptyItem
            disabled={captureBusy}
            onSelect={selectStack}
            registerDropTarget={registerDropTarget}
            dropTargetKey={dropTargetKey}
          />
          <View style={styles.captureActions}>
            <TouchableOpacity
              ref={libraryRef}
              style={styles.galleryButton}
              onPress={openGallery}
              disabled={captureBusy}
              accessibilityLabel={currentStoreName
                ? `Import photos from your library for ${currentStoreName}`
                : 'Import photos from your library'}
            >
              {isImporting ? <ActivityIndicator color={cameraColors.onCamera} /> : <Ionicons name="images-outline" size={25} color={cameraColors.onCamera} />}
              <Text style={styles.galleryButtonText}>Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              ref={shutterRef}
              style={[styles.shutterOuter, (!cameraReady || cameraError || isCapturing) && styles.shutterDisabled]}
              onPress={() => void takePhoto()}
              disabled={!cameraReady || Boolean(cameraError) || captureBusy}
              activeOpacity={0.8}
              accessibilityLabel={cameraError ? 'Camera unavailable' : `Take photo for item ${activeItemNumber}`}
              accessibilityHint={cameraError ? 'Use the Library button to add photos' : undefined}
              accessibilityState={{ disabled: !cameraReady || Boolean(cameraError) || captureBusy }}
            >
              {isCapturing ? <ActivityIndicator color={cameraColors.ctaForeground} /> : <View style={styles.shutterInner} />}
            </TouchableOpacity>

            {cameraError ? (
              // Holds the slot so the shutter stays centred.
              <View style={[styles.sameItemButton, styles.controlPlaceholder]} />
            ) : (
              <TouchableOpacity
                style={styles.sameItemButton}
                onPress={toggleTorch}
                disabled={captureBusy}
                accessibilityRole="switch"
                accessibilityLabel="Torch"
                accessibilityState={{ checked: torchOn, disabled: captureBusy }}
              >
                <Ionicons name={torchOn ? 'flashlight' : 'flashlight-outline'} size={25} color={cameraColors.onCamera} />
                <Text style={styles.galleryButtonText}>Torch</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <BottomSheetModal
        ref={storeSheetRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Where are you shopping?</Text>
          <Text style={styles.sheetSubtitle}>
            Styled attaches your current branch location in the background. The camera stays ready.
          </Text>
          <BottomSheetTextInput
            style={styles.storeInput}
            value={storeDraft}
            onChangeText={setStoreDraft}
            placeholder="Store name"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => chooseStore(storeDraft)}
          />
          <ScrollView
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.suggestionList}
          >
            {storeSuggestions.map((suggestion) => (
              <TouchableOpacity
                key={suggestion.id}
                style={styles.storeSuggestion}
                onPress={() => chooseStore(suggestion.storeName, suggestion)}
              >
                <View style={styles.storeSuggestionIcon}>
                  <Ionicons
                    name={suggestion.source === 'popular' ? 'storefront-outline' : suggestion.source === 'free-text' ? 'create-outline' : 'location-outline'}
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.storeSuggestionCopy}>
                  <Text style={styles.storeSuggestionTitle} numberOfLines={1}>
                    {suggestion.source === 'free-text' ? `Use "${suggestion.storeName}"` : suggestion.storeName}
                  </Text>
                  <Text style={styles.storeSuggestionSubtitle} numberOfLines={1}>
                    {suggestion.source === 'popular'
                      ? 'Popular fashion store'
                      : suggestion.source === 'free-text'
                        ? 'Save as a custom store'
                        : formatShoppingPlaceLabel(suggestion, { fallback: 'Recent store' })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.storeSuggestion, styles.clearSuggestion]} onPress={clearStore}>
              <View style={styles.storeSuggestionIcon}>
                <Ionicons name="close-circle-outline" size={16} color={colors.destructive} />
              </View>
              <Text style={styles.clearChipText}>{currentStoreName ? 'Cancel' : 'Keep store unset'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>

      <Modal visible={resumePromptVisible} transparent animationType="fade" onRequestClose={closeCamera}>
        <View style={styles.resumeBackdrop}>
          <View style={styles.resumeCard}>
            <View style={styles.resumeIcon}>
              <Ionicons name="bag-handle-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.resumeTitle}>
              {currentStoreName ? `Resume at ${currentStoreName}?` : 'Resume previous visit?'}
            </Text>
            <Text style={styles.resumeText}>
              Your earlier photos are safe. Resume to keep this visit together, or start fresh.
            </Text>
            <TouchableOpacity style={styles.resumePrimary} onPress={confirmResumeVisit}>
              <Text style={styles.resumePrimaryText}>Resume visit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resumeSecondary} onPress={startFreshVisit}>
              <Text style={styles.resumeSecondaryText}>Start new visit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedPreview)}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setSelectedPreviewId(null)}
      >
        <View style={styles.previewViewer}>
          {isFocused ? <StatusBar style="light" /> : null}
          <View style={[styles.viewerHeader, { paddingTop: insets.top + spacing.sm }]}>
            <TouchableOpacity
              style={styles.roundButton}
              onPress={() => setSelectedPreviewId(null)}
              accessibilityLabel="Close photo preview"
            >
              <Ionicons name="close" size={25} color={cameraColors.onCamera} />
            </TouchableOpacity>
            <View style={styles.viewerTitle}>
              <Text style={styles.viewerItem}>Item {activeItemNumber}</Text>
              <Text style={styles.viewerCount}>
                {Math.max(1, activePhotos.findIndex((preview) => preview.id === selectedPreviewId) + 1)} of {activePhotos.length}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.roundButton}
              onPress={() => selectedPreviewId && confirmDeletePreview(selectedPreviewId)}
              disabled={captureBusy}
              accessibilityLabel="Delete this photo"
            >
              <Ionicons name="trash-outline" size={22} color={cameraColors.destructive} />
            </TouchableOpacity>
          </View>
          {selectedPreview ? (
            <FlatList
              key={attachGroupId}
              data={activePhotos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={Math.max(0, activePhotos.findIndex((preview) => preview.id === selectedPreview.id))}
              getItemLayout={(_, index) => ({ length: windowWidth, offset: windowWidth * index, index })}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
                setSelectedPreviewId(activePhotos[index]?.id ?? null);
              }}
              renderItem={({ item }) => (
                <View style={[styles.viewerPage, { width: windowWidth }]}>
                  {/* The full capture, with the small preview as its placeholder:
                      the preview alone is visibly soft at full-screen size. */}
                  <Image
                    source={{ uri: item.localFileUri ?? item.previewUri }}
                    placeholder={item.previewUri && item.localFileUri ? { uri: item.previewUri } : undefined}
                    placeholderContentFit="contain"
                    transition={reducedMotion ? 0 : 180}
                    style={styles.viewerImage}
                    contentFit="contain"
                    recyclingKey={item.id}
                  />
                </View>
              )}
            />
          ) : null}
          {selectedPreview ? (() => {
            const viewerPrice = activePrice?.confirmed && attachGroupId
              ? stackPriceLabels.get(attachGroupId) ?? null
              : photoPriceLabel(selectedPreview, homeCurrency);
            const isTag = selectedPreview.captureRole === 'tag';
            if (!viewerPrice && !isTag) return null;
            return (
              <View pointerEvents="none" style={[styles.viewerCaption, { paddingBottom: insets.bottom + spacing.lg }]}>
                {isTag ? (
                  <View style={styles.viewerChip}>
                    <Ionicons name="pricetag-outline" size={13} color={cameraColors.onCamera} />
                    <Text style={styles.viewerChipText}>Price tag</Text>
                  </View>
                ) : null}
                {viewerPrice ? (
                  <View style={[styles.viewerChip, styles.viewerPriceChip]}>
                    <Text style={styles.viewerPriceText}>{viewerPrice}</Text>
                  </View>
                ) : null}
              </View>
            );
          })() : null}
        </View>
      </Modal>
      <AiActionCoachmark
        visible={Boolean(tour)}
        tone="light"
        spotlightShape="fit"
        title={tour ? CAMERA_TOUR_STEPS[tour.step].title : ''}
        body={tour ? CAMERA_TOUR_STEPS[tour.step].body : ''}
        step={tour?.step}
        stepCount={CAMERA_TOUR_STEPS.length}
        primaryLabel={tour && tour.step + 1 >= CAMERA_TOUR_STEPS.length ? 'Done' : 'Next'}
        onPrimary={advanceTour}
        onSkip={endTour}
        onDismiss={endTour}
        spotlight={tour?.rect}
        caretPlacement={tour && tourCalloutAbove(tour.rect, windowHeight) ? 'bottom' : 'top'}
        style={tour ? tourCalloutPosition(tour.rect, windowWidth, windowHeight) : undefined}
        caretLeft={tour ? tourCaretLeft(tour.rect, windowWidth) : undefined}
        scrimAccessibilityLabel="Dismiss camera tips"
      />
      {draggingPhoto ? (
        <Animated.View pointerEvents="none" style={[styles.dragGhost, dragGhostStyle]}>
          <Image source={{ uri: draggingPhoto.previewUri ?? draggingPhoto.localFileUri }} contentFit="cover" style={styles.photoThumbnail} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const DRAG_GHOST_W = 52;
const DRAG_GHOST_H = 68;

const styles = StyleSheet.create({
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 156 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300 },
  captureFlash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: cameraColors.onCamera },
  guide: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 252, 247, 0.55)',
    borderRadius: radii.sm,
    borderCurve: 'continuous',
  },
  guideThirdsVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33.33%',
    width: '33.33%',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 252, 247, 0.25)',
  },
  guideThirdsHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33.33%',
    height: '33.33%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 252, 247, 0.25)',
  },
  bottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  activePhotosRail: {
    width: '100%',
    minHeight: 68,
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
  },
  photoViewport: { width: '100%', flexGrow: 0 },
  photoRail: { flexGrow: 1, justifyContent: 'flex-end', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs, paddingHorizontal: spacing.lg, minHeight: 68 },
  photoButton: { width: 52, height: 68, borderRadius: radii.sm, borderCurve: 'continuous', overflow: 'hidden' },
  photoButtonLifted: { opacity: 0.3 },
  dragGhost: {
    position: 'absolute', left: 0, top: 0, width: DRAG_GHOST_W, height: DRAG_GHOST_H,
    borderRadius: radii.sm, borderCurve: 'continuous',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.45)',
  },
  photoThumbnail: { width: '100%', height: '100%', borderRadius: radii.sm, borderCurve: 'continuous' },
  roleGlyph: { position: 'absolute', right: 4, bottom: 4, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: cameraColors.onCamera },
  roleGlyphText: { fontSize: 11, lineHeight: 13, fontWeight: typography.weight.bold, color: cameraColors.backdrop },
  pricePill: { position: 'absolute', left: 2, right: 2, bottom: 2, height: 16, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: cameraColors.onCamera },
  pricePillText: { fontSize: 10, lineHeight: 12, fontWeight: typography.weight.semibold, color: cameraColors.backdrop, fontVariant: ['tabular-nums'] },
  priceChooser: { width: '100%', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  priceChooserError: { ...typography.text.caption, color: cameraColors.destructive },
  root: { flex: 1, backgroundColor: cameraColors.backdrop },
  captureGuidance: { ...typography.text.bodySmall, color: cameraColors.onCamera, textAlign: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  permissionRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    ...typography.text.editorialCompact,
    color: colors.foreground,
  },
  permissionText: {
    maxWidth: 320,
    fontSize: typography.text.bodySmall.fontSize,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.mutedForeground,
  },
  permissionButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  permissionButtonText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  cancelText: { padding: spacing.sm, fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
  },
  roundButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: cameraColors.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cameraColors.selectionSubtle,
  },
  doneButton: {
    minWidth: 54,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: cameraColors.control,
    borderCurve: 'continuous',
  },
  cancelButton: { backgroundColor: 'transparent' },
  reviewButton: { backgroundColor: colors.primary },
  reviewButtonEmpty: { backgroundColor: cameraColors.control },
  doneButtonText: { ...typography.text.label, color: cameraColors.onCamera },
  doneButtonTextMuted: { color: cameraColors.onCameraMuted },
  contextPill: {
    flexShrink: 1,
    maxWidth: '55%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: cameraColors.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cameraColors.selectionSubtle,
  },
  nearbyConfirm: {
    width: 26,
    height: 26,
    marginRight: -spacing.xs,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cameraColors.onCamera,
  },
  contextPillText: {
    flexShrink: 1,
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: cameraColors.onCamera,
  },
  importStatusPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: cameraColors.control,
  },
  importStatusText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.medium,
    color: cameraColors.onCamera,
  },
  bottomControls: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  cameraUnavailableState: {
    position: 'absolute',
    top: '36%',
    left: spacing.xl,
    right: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  cameraUnavailableIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: cameraColors.controlSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cameraColors.selectionSubtle,
  },
  cameraUnavailableButton: {
    marginTop: spacing.md,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.full,
    backgroundColor: cameraColors.ctaBackground,
  },
  cameraUnavailableButtonText: { ...typography.text.label, color: cameraColors.ctaForeground },
  controlPlaceholder: { backgroundColor: 'transparent', borderWidth: 0 },
  cameraUnavailableTitle: { ...typography.text.editorialCompact, color: cameraColors.onCamera, textAlign: 'center' },
  cameraUnavailableText: { ...typography.text.bodySmall, color: cameraColors.onCameraMuted, textAlign: 'center' },
  captureActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
  },
  galleryButton: {
    width: 80,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.md,
    backgroundColor: cameraColors.control,
  },
  galleryButtonText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.medium,
    color: cameraColors.onCamera,
    textAlign: 'center',
  },
  sameItemButton: {
    width: 80,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.md,
    backgroundColor: cameraColors.control,
  },
  sameItemButtonDisabled: { opacity: 0.5 },
  shutterOuter: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 39,
    borderWidth: 4,
    borderColor: cameraColors.onCamera,
    backgroundColor: cameraColors.selectionSubtle,
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: cameraColors.onCamera },
  shutterDisabled: { opacity: 0.58 },
  sheetBackground: { backgroundColor: colors.background },
  sheetHandle: { backgroundColor: colors.border },
  sheetContent: { flex: 1, gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  sheetTitle: {
    fontSize: typography.text.sectionTitle.fontSize,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  sheetSubtitle: {
    marginTop: -spacing.sm,
    fontSize: typography.text.bodySmall.fontSize,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  storeInput: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    fontSize: typography.text.body.fontSize,
    color: colors.foreground,
    backgroundColor: colors.surfaceElevated,
  },
  suggestionList: { gap: spacing.sm, paddingBottom: spacing.xl },
  storeSuggestion: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
  },
  storeSuggestionIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  storeSuggestionCopy: { flex: 1 },
  storeSuggestionTitle: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.secondaryForeground,
  },
  storeSuggestionSubtitle: {
    paddingTop: 2,
    ...typography.text.caption,
    color: colors.mutedForeground,
  },
  clearSuggestion: { borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.background },
  clearChipText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.destructive,
  },
  resumeBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: cameraColors.overlayStrong,
  },
  resumeCard: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.background,
  },
  resumeIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.accent,
  },
  resumeTitle: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.bold, color: colors.foreground, textAlign: 'center' },
  resumeText: { fontSize: typography.text.bodySmall.fontSize, lineHeight: 20, color: colors.mutedForeground, textAlign: 'center' },
  resumePrimary: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  resumePrimaryText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.bold, color: colors.primaryForeground },
  resumeSecondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg },
  resumeSecondaryText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  previewViewer: { flex: 1, backgroundColor: cameraColors.backdropDeep },
  viewerHeader: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  viewerTitle: { alignItems: 'center', gap: 1 },
  viewerItem: { ...typography.text.caption, fontWeight: typography.weight.semibold, color: cameraColors.onCameraMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  viewerCaption: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  viewerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: spacing.md, borderRadius: 15, backgroundColor: cameraColors.control },
  viewerChipText: { ...typography.text.bodySmall, fontWeight: typography.weight.semibold, color: cameraColors.onCamera },
  viewerPriceChip: { backgroundColor: cameraColors.onCamera },
  viewerPriceText: { ...typography.text.bodySmall, fontWeight: typography.weight.semibold, color: cameraColors.backdrop, fontVariant: ['tabular-nums'] },
  viewerCount: { ...typography.text.bodySmall, fontWeight: typography.weight.semibold, color: cameraColors.onCamera, fontVariant: ['tabular-nums'] },
  viewerPage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
});
