import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
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
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShoppingStoreLocations } from '../../hooks/useShoppingStoreLocations';
import type { ShoppingCameraScreenProps } from '../../navigation/types';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { processLocalOCR } from '../../lib/processLocalOCR';
import { classifyShoppingCapture } from '../../lib/classifyShoppingCapture';
import { extractGpsCoords, resolveShoppingSessionLocation } from '../../lib/photoLocation';
import {
  buildShoppingStoreSuggestions,
  formatShoppingPlaceLabel,
  type ShoppingStoreSuggestion,
} from '../../lib/shoppingLocations';
import type { ShoppingSessionContext } from '../../stores/useShoppingSessionStore';
import { colors, radii, spacing, typography } from '../../theme';

const CAPTURE_DIRECTORY = new Directory(Paths.document, 'shopping-snaps');

const MAX_GALLERY_IMPORTS = 20;

function runWhenIdle(callback: () => void): void {
  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(callback);
    return;
  }

  setTimeout(callback, 0);
}

function sessionPlaceLabel(session: ShoppingSessionContext | null): string | null {
  if (!session) return null;
  if (session.locationStatus === 'resolving') return 'Locating nearby branch…';
  if (session.locationStatus === 'unavailable') return 'Location unavailable — tap to retry';
  return [session.branchLabel, session.locality, session.region]
    .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
    .slice(0, 2)
    .join(' · ') || 'Location attached';
}

function imageExtension(
  mimeType: string | null | undefined,
  fileNameOrUri: string,
): string {
  switch (mimeType) {
    case 'image/heic': return 'heic';
    case 'image/heif': return 'heif';
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    default: {
      const extension = fileNameOrUri.match(/\.(heic|heif|png|jpe?g)(?:\?|$)/i)?.[1].toLowerCase();
      return extension === 'jpeg' ? 'jpg' : extension ?? 'jpg';
    }
  }
}

async function persistShoppingPhoto(
  temporaryUri: string,
  id: string,
  extension = 'jpg',
): Promise<string> {
  CAPTURE_DIRECTORY.create({ intermediates: true, idempotent: true });

  const source = new File(temporaryUri);
  const destination = new File(CAPTURE_DIRECTORY, `${id}.${extension}`);
  await source.copy(destination);
  return destination.uri;
}

export function ShoppingCameraScreen({ navigation }: ShoppingCameraScreenProps) {
  const cameraRef = useRef<CameraView>(null);
  const storeSheetRef = useRef<BottomSheetModal>(null);
  const locationResolutionRef = useRef(new Set<string>());
  const gallerySessionAfterSheetRef = useRef<ShoppingSessionContext | 'waiting' | null>(null);
  const galleryPickerInFlightRef = useRef(false);
  const galleryImportQueueRef = useRef<Promise<void>>(Promise.resolve());
  const ocrQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [galleryImportProgress, setGalleryImportProgress] = useState<{
    imported: number;
    total: number;
  } | null>(null);
  const [storeDraft, setStoreDraft] = useState('');
  const [captureCount, setCaptureCount] = useState(0);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { data: visitedStoreLocations = [] } = useShoppingStoreLocations();

  const currentStoreName = useShoppingSessionStore((state) => state.currentStoreName);
  const currentSession = useShoppingSessionStore((state) => state.currentSession);
  const recentStores = useShoppingSessionStore((state) => state.recentStores);
  const recentSessions = useShoppingSessionStore((state) => state.recentSessions);
  const setShoppingSession = useShoppingSessionStore((state) => state.setShoppingSession);
  const updateShoppingSessionLocation = useShoppingSessionStore(
    (state) => state.updateShoppingSessionLocation,
  );
  const clearStoreName = useShoppingSessionStore((state) => state.clearStoreName);
  const addPendingUpload = useShoppingSessionStore((state) => state.addPendingUpload);
  const assignCaptureGroup = useShoppingSessionStore((state) => state.assignCaptureGroup);
  const startNextCaptureGroup = useShoppingSessionStore((state) => state.startNextCaptureGroup);
  const activeCapturePhotoCount = useShoppingSessionStore((state) => state.activeCapturePhotoCount);
  const activeCaptureTagCount = useShoppingSessionStore((state) => state.activeCaptureTagCount);
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

  const startBackgroundOCR = useCallback((id: string, localFileUri: string) => {
    // Apple Vision/CoreML can be unstable when many large library photos are
    // submitted concurrently. Keep capture non-blocking, but process OCR one
    // image at a time in the background.
    ocrQueueRef.current = ocrQueueRef.current.then(async () => {
      try {
        const result = await processLocalOCR(localFileUri);
        useShoppingSessionStore.getState().updatePendingUploadOCR(id, {
          ...result,
          captureRole: classifyShoppingCapture(result.rawOcrText, result.extractedPrice),
          ocrStatus: 'complete',
        });
      } catch (ocrError: unknown) {
        console.warn('Shopping photo OCR failed', ocrError);
        useShoppingSessionStore.getState().updatePendingUploadOCR(id, {
          extractedPrice: null,
          rawOcrText: '',
          captureRole: 'unknown',
          ocrStatus: 'failed',
        });
      }
    });
  }, []);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

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

  const resolveSessionLocation = useCallback((sessionId: string) => {
    if (locationResolutionRef.current.has(sessionId)) return;
    locationResolutionRef.current.add(sessionId);
    void resolveShoppingSessionLocation().then((location) => {
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
    if (!trimmedName) return;
    const hasResolvedSuggestion = suggestion?.source === 'recent'
      && Boolean(suggestion.locality || suggestion.branchLabel || suggestion.latitude !== null);
    const session: ShoppingSessionContext = {
      id: Crypto.randomUUID(),
      storeLocationId: null,
      storeName: trimmedName,
      branchLabel: hasResolvedSuggestion ? suggestion?.branchLabel ?? null : null,
      latitude: hasResolvedSuggestion ? suggestion?.latitude ?? null : null,
      longitude: hasResolvedSuggestion ? suggestion?.longitude ?? null : null,
      locationAccuracyMeters: null,
      locality: hasResolvedSuggestion ? suggestion?.locality ?? null : null,
      region: hasResolvedSuggestion ? suggestion?.region ?? null : null,
      countryCode: hasResolvedSuggestion ? suggestion?.countryCode ?? null : null,
      locationSource: hasResolvedSuggestion ? 'recent' : 'device',
      locationStatus: hasResolvedSuggestion ? 'resolved' : 'resolving',
      locationCapturedAt: hasResolvedSuggestion ? Date.now() : null,
      startedAt: Date.now(),
    };
    setShoppingSession(session);
    if (!hasResolvedSuggestion) resolveSessionLocation(session.id);
    if (gallerySessionAfterSheetRef.current === 'waiting') {
      gallerySessionAfterSheetRef.current = session;
    }
    closeStoreSheet();
  }, [closeStoreSheet, resolveSessionLocation, setShoppingSession]);

  const clearStore = useCallback(() => {
    gallerySessionAfterSheetRef.current = null;
    clearStoreName();
    closeStoreSheet();
  }, [clearStoreName, closeStoreSheet]);

  const importGalleryAssets = useCallback(async (
    session: ShoppingSessionContext,
    assets: ImagePicker.ImagePickerAsset[],
  ) => {
    let importedCount = 0;
    setGalleryImportProgress({ imported: 0, total: assets.length });

    try {
      const importSessionId = assets.some((asset) => asset.exif && extractGpsCoords(asset.exif))
        ? Crypto.randomUUID()
        : session.id;
      for (const asset of assets) {
        try {
          const id = Crypto.randomUUID();
          const coordinates = asset.exif ? extractGpsCoords(asset.exif) : null;
          const localFileUri = await persistShoppingPhoto(
            asset.uri,
            id,
            imageExtension(asset.mimeType, asset.fileName ?? asset.uri),
          );
          const timestamp = Date.now();
          const captureGroup = assignCaptureGroup(importSessionId, Crypto.randomUUID(), timestamp);

          addPendingUpload({
            id,
            localFileUri,
            storeName: session.storeName,
            storeLocationId: coordinates ? null : session.storeLocationId,
            // An EXIF-tagged library photo gets its own location session so
            // imports from different cities never overwrite one another.
            shoppingSessionId: importSessionId,
            sessionStartedAt: coordinates ? Date.now() : session.startedAt,
            latitude: coordinates?.latitude ?? null,
            longitude: coordinates?.longitude ?? null,
            locationAccuracyMeters: coordinates ? null : session.locationAccuracyMeters,
            locality: coordinates ? null : session.locality,
            region: coordinates ? null : session.region,
            countryCode: coordinates ? null : session.countryCode,
            branchLabel: coordinates ? null : session.branchLabel,
            locationSource: coordinates ? 'photo_exif' : session.locationSource,
            locationStatus: coordinates ? 'resolved' : session.locationStatus,
            locationCapturedAt: coordinates ? Date.now() : session.locationCapturedAt,
            captureGroupId: captureGroup.groupId,
            captureGroupStartedAt: captureGroup.groupStartedAt,
            captureSequence: captureGroup.sequence,
            captureRole: 'unknown',
            extractedPrice: null,
            rawOcrText: '',
            ocrStatus: 'processing',
            timestamp,
          });
          startBackgroundOCR(id, localFileUri);
          importedCount += 1;
          setGalleryImportProgress({ imported: importedCount, total: assets.length });
        } catch (assetError) {
          console.warn('Gallery photo import failed', assetError);
        }
      }

      if (importedCount > 0) {
        setCaptureCount((count) => count + importedCount);
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
  }, [addPendingUpload, assignCaptureGroup, startBackgroundOCR]);

  const enqueueGalleryImport = useCallback((
    session: ShoppingSessionContext,
    assets: ImagePicker.ImagePickerAsset[],
  ) => {
    galleryImportQueueRef.current = galleryImportQueueRef.current
      .catch((error) => {
        console.warn('Previous gallery import failed', error);
      })
      .then(() => importGalleryAssets(session, assets))
      .catch((error) => {
        console.warn('Gallery import failed', error);
        Alert.alert(
          'Photos not imported',
          error instanceof Error ? error.message : 'Please try again.',
        );
      });
  }, [importGalleryAssets]);

  const resumeCameraPreview = useCallback(() => {
    if (isFocused && !isClosing) {
      requestAnimationFrame(() => {
        void cameraRef.current?.resumePreview().catch(() => undefined);
      });
    }
  }, [isClosing, isFocused]);

  const closeCamera = useCallback(() => {
    setIsClosing(true);
    setCameraReady(false);
    gallerySessionAfterSheetRef.current = null;
    storeSheetRef.current?.dismiss();
    void cameraRef.current?.pausePreview().catch(() => undefined);
    requestAnimationFrame(() => {
      navigation.goBack();
    });
  }, [navigation]);

  const importFromGallery = useCallback(async (session: ShoppingSessionContext) => {
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

      const assets = result.assets;
      // Return control to the camera before copying full-resolution library
      // files. The import remains local-first, but it no longer blocks the
      // native picker dismissal/next paint.
      setIsImporting(false);
      resumeCameraPreview();
      runWhenIdle(() => {
        enqueueGalleryImport(session, assets);
      });
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

  const openGallery = useCallback(() => {
    if (currentSession) {
      void importFromGallery(currentSession);
      return;
    }

    // A sentinel indicates that choosing a store should continue directly to
    // the system library after the sheet has finished dismissing.
    gallerySessionAfterSheetRef.current = 'waiting';
    openStoreSheet();
  }, [currentSession, importFromGallery, openStoreSheet]);

  const handleStoreSheetDismiss = useCallback(() => {
    const session = gallerySessionAfterSheetRef.current;
    gallerySessionAfterSheetRef.current = null;
    if (session && session !== 'waiting') void importFromGallery(session);
  }, [importFromGallery]);

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
      const localFileUri = await persistShoppingPhoto(photo.uri, id);
      const timestamp = Date.now();
      const captureGroup = assignCaptureGroup(
        capturedSession?.id ?? null,
        Crypto.randomUUID(),
        timestamp,
      );

      // Queueing immediately keeps the saved photo visible and durable before
      // background OCR begins.
      addPendingUpload({
        id,
        localFileUri,
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
      setCaptureCount((count) => count + 1);

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
  }, [addPendingUpload, assignCaptureGroup, cameraReady, currentSession, isCapturing, startBackgroundOCR]);

  const handleNextItem = useCallback(() => {
    if (activeCapturePhotoCount === 0) return;
    startNextCaptureGroup();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [activeCapturePhotoCount, startNextCaptureGroup]);

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
          Shopping Mode uses a custom camera so every photo saves without a confirmation step.
        </Text>
        {permission.canAskAgain ? (
          <TouchableOpacity style={styles.permissionButton} onPress={() => void requestPermission()}>
            <Text style={styles.permissionButtonText}>Allow camera</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={closeCamera}>
          <Text style={styles.cancelText}>Back to Shop</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        active={isFocused && !isImporting && !isClosing}
        facing="back"
        mode="picture"
        onCameraReady={() => setCameraReady(true)}
        onMountError={(event) => Alert.alert('Camera unavailable', event.message)}
      />

      <View style={[styles.topControls, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.roundButton}
          onPress={closeCamera}
          disabled={isClosing}
          accessibilityLabel="Close Shopping Mode"
        >
          <Ionicons name="close" size={25} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contextPill}
          onPress={openStoreSheet}
          activeOpacity={0.8}
          accessibilityLabel={currentStoreName
            ? `Current store ${currentStoreName}, ${sessionPlaceLabel(currentSession)}, tap to change`
            : 'Tap to add store'}
        >
          <Text style={styles.contextPillText} numberOfLines={1}>
            {currentStoreName ? `📍 ${currentStoreName}` : '📍 Tap to add store'}
          </Text>
          {currentSession ? (
            <Text style={styles.contextPillSubtext} numberOfLines={1}>
              {sessionPlaceLabel(currentSession)}
            </Text>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.roundButton}
          onPress={() => navigation.navigate('ShoppingGallery')}
          accessibilityLabel="View Shopping Mode gallery"
        >
          <Ionicons name="images-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {galleryImportProgress ? (
        <View style={[styles.importStatusPill, { top: insets.top + 66 }]}>
          <ActivityIndicator color="#FFFFFF" size="small" />
          <Text style={styles.importStatusText}>
            Importing {galleryImportProgress.imported}/{galleryImportProgress.total} · camera stays ready
          </Text>
        </View>
      ) : null}

      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.captureHint}>
          {activeCapturePhotoCount > 0
            ? `${activeCapturePhotoCount} in this item${activeCaptureTagCount > 0 ? ` · ${activeCaptureTagCount} tag${activeCaptureTagCount === 1 ? '' : 's'}` : ''}`
            : captureCount > 0
              ? `${captureCount} saved this session · start the next item`
            : 'Snap an item or price tag'}
        </Text>
        <View style={styles.captureActions}>
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={openGallery}
            disabled={isImporting || isCapturing}
            accessibilityLabel={currentStoreName
              ? `Import photos for ${currentStoreName}`
              : 'Choose a store, then import photos'}
          >
            {isImporting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons name="images-outline" size={25} color="#FFFFFF" />
            )}
            <Text style={styles.galleryButtonText}>Library</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shutterOuter, (!cameraReady || isCapturing) && styles.shutterDisabled]}
            onPress={() => void takePhoto()}
            disabled={!cameraReady || isCapturing || isImporting}
            activeOpacity={0.8}
            accessibilityLabel="Take photo"
          >
            {isCapturing ? (
              <ActivityIndicator color="#111111" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextItemButton, activeCapturePhotoCount === 0 && styles.nextItemButtonDisabled]}
            onPress={handleNextItem}
            disabled={activeCapturePhotoCount === 0 || isCapturing || isImporting}
            accessibilityLabel="Finish this item and start the next item"
          >
            <Ionicons name="arrow-forward-circle-outline" size={25} color="#FFFFFF" />
            <Text style={styles.galleryButtonText}>Next item</Text>
          </TouchableOpacity>
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
        onDismiss={handleStoreSheetDismiss}
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
              <Text style={styles.clearChipText}>Clear Store</Text>
            </TouchableOpacity>
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  permissionRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  permissionText: {
    maxWidth: 320,
    fontSize: typography.size.sm,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  cancelText: { padding: spacing.sm, fontSize: typography.size.sm, color: colors.mutedForeground },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  roundButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  roundButtonPlaceholder: { width: 44, height: 44 },
  contextPill: {
    maxWidth: '72%',
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  contextPillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: '#FFFFFF',
  },
  contextPillSubtext: {
    paddingTop: 1,
    fontSize: 10,
    fontWeight: typography.weight.medium,
    color: 'rgba(255, 255, 255, 0.76)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
  },
  importStatusText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: '#FFFFFF',
  },
  bottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  captureHint: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  captureActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
  },
  galleryButton: {
    width: 72,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  galleryButtonText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: '#FFFFFF',
  },
  captureActionPlaceholder: { width: 72, height: 58 },
  nextItemButton: {
    width: 72,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  nextItemButtonDisabled: { opacity: 0.42 },
  shutterOuter: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  shutterDisabled: { opacity: 0.58 },
  sheetBackground: { backgroundColor: colors.background },
  sheetHandle: { backgroundColor: colors.border },
  sheetContent: { flex: 1, gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  sheetTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  sheetSubtitle: {
    marginTop: -spacing.sm,
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  storeInput: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    fontSize: typography.size.md,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.secondaryForeground,
  },
  storeSuggestionSubtitle: {
    paddingTop: 2,
    fontSize: 10,
    color: colors.mutedForeground,
  },
  clearSuggestion: { borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.background },
  clearChipText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.destructive,
  },
});
