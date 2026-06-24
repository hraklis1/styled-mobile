import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { compressImageUri } from '../../lib/compressImage';
import { capturePhotoLocationData, type CapturedLocation } from '../../lib/photoLocation';
import type { StoreFind } from '../../types/storeFind';
import { persistStoreFindPhoto, StoreFindFormModal } from './StoreFindFormModal';

const MAX_PHOTOS = 5;
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS'] as const;

type CaptureMode = 'item' | 'tag' | 'review';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<StoreFind, 'id' | 'createdAt'>) => Promise<void>;
};

function defaultCurrency(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const region = locale.split('-')[1]?.toUpperCase();
  return ({ CA: 'CAD', US: 'USD', GB: 'GBP', AU: 'AUD', NZ: 'NZD', JP: 'JPY' } as Record<string, string>)[region] ?? 'USD';
}

async function persistCapturedPhoto(uri: string): Promise<string> {
  const compressed = await compressImageUri(uri, 1080, 0.82);
  return persistStoreFindPhoto(compressed);
}

export function DailyFindCaptureModal({ visible, onClose, onSave }: Props) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [mode, setMode] = useState<CaptureMode>('item');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [tagImageUri, setTagImageUri] = useState<string | null>(null);
  const [sessionLocation, setSessionLocation] = useState<CapturedLocation | null>(null);
  const [sessionStore, setSessionStore] = useState('');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [fullDetailsVisible, setFullDetailsVisible] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
    if (visible) {
      setIsClosing(false);
    }
    if (!visible) {
      setCameraReady(false);
      setMode('item');
      setImageUris([]);
      setTagImageUri(null);
      setSessionLocation(null);
      setSessionStore('');
      setPrice('');
      setSize('');
      setFullDetailsVisible(false);
    }
  }, [permission, requestPermission, visible]);

  const closeCamera = useCallback(() => {
    setIsClosing(true);
    setCameraReady(false);
    void camera.current?.pausePreview().catch(() => undefined);
    requestAnimationFrame(onClose);
  }, [onClose]);

  const resetCurrentFind = useCallback(() => {
    setImageUris([]);
    setTagImageUri(null);
    setPrice('');
    setSize('');
    setMode('item');
  }, []);

  const applyItemPhotos = useCallback((uris: string[], location: CapturedLocation | null) => {
    setImageUris(uris);
    if (!sessionLocation && location) setSessionLocation(location);
    setMode('review');
  }, [sessionLocation]);

  const takePhoto = useCallback(async () => {
    if (!camera.current || !cameraReady || isWorking) return;
    setIsWorking(true);
    try {
      await Haptics.selectionAsync();
      const photo: CameraCapturedPicture = await camera.current.takePictureAsync({ quality: 0.9, exif: true });
      const uri = await persistCapturedPhoto(photo.uri);
      if (mode === 'tag') {
        setTagImageUri(uri);
        setMode('review');
      } else {
        const location = sessionLocation ?? await capturePhotoLocationData(photo.exif, true);
        applyItemPhotos([uri], location);
      }
    } catch (error) {
      Alert.alert('Photo not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsWorking(false);
    }
  }, [applyItemPhotos, cameraReady, isWorking, mode, sessionLocation]);

  const chooseFromLibrary = useCallback(async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await Haptics.selectionAsync();
      const choosingTag = mode === 'tag';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: !choosingTag,
        selectionLimit: choosingTag ? 1 : MAX_PHOTOS,
        orderedSelection: !choosingTag,
        quality: 1,
        exif: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const assets = result.assets.slice(0, choosingTag ? 1 : MAX_PHOTOS);
      const uris = await Promise.all(assets.map((asset) => persistCapturedPhoto(asset.uri)));
      if (choosingTag) {
        setTagImageUri(uris[0]);
        setMode('review');
        return;
      }
      let location = sessionLocation;
      if (!location) {
        for (const asset of assets) {
          location = await capturePhotoLocationData(asset.exif, false);
          if (location) break;
        }
      }
      applyItemPhotos(uris, location);
    } catch (error) {
      Alert.alert('Photos not added', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsWorking(false);
    }
  }, [applyItemPhotos, isWorking, mode, sessionLocation]);

  const buildDraft = useCallback((): Omit<StoreFind, 'id' | 'createdAt'> => {
    const parsedPrice = parseFloat(price.replace(/[^0-9.]/g, ''));
    return {
      imageUrl: imageUris[0] ?? null,
      imageUrls: imageUris,
      tagImageUrl: tagImageUri,
      location: sessionLocation?.label ?? null,
      locationData: sessionLocation,
      description: null,
      store: sessionStore.trim() || null,
      brand: null,
      price: Number.isNaN(parsedPrice) ? null : parsedPrice,
      currency: defaultCurrency(),
      size: size || null,
      notes: null,
      syncStatus: 'pending',
      status: 'saved',
      syncError: null,
      syncAttempts: 0,
      lastSyncAttemptAt: null,
    };
  }, [imageUris, price, sessionLocation, sessionStore, size, tagImageUri]);

  const saveQuickFind = useCallback(async () => {
    if (isWorking || imageUris.length === 0) return;
    setIsWorking(true);
    try {
      await onSave(buildDraft());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetCurrentFind();
    } catch (error) {
      Alert.alert('Not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsWorking(false);
    }
  }, [buildDraft, imageUris.length, isWorking, onSave, resetCurrentFind]);

  const saveFullFind = useCallback(async (data: Omit<StoreFind, 'id' | 'createdAt'>) => {
    await onSave(data);
    setSessionStore(data.store ?? '');
    setSessionLocation(data.locationData ?? null);
    resetCurrentFind();
  }, [onSave, resetCurrentFind]);

  const discardCurrent = useCallback(() => {
    Alert.alert('Discard this find?', 'The photos have not been saved yet.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: resetCurrentFind },
    ]);
  }, [resetCurrentFind]);

  const safeTop = Math.max(insets.top, 48) + spacing.sm;
  const safeBottom = Math.max(insets.bottom, spacing.md) + spacing.md;
  const cameraActive = visible && !isClosing && mode !== 'review' && !fullDetailsVisible;
  const locationLabel = sessionLocation?.label || sessionLocation?.address;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={closeCamera}>
      <View style={styles.root}>
        {mode === 'review' ? (
          <KeyboardAvoidingView style={styles.reviewRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.reviewHeader, { paddingTop: safeTop }]}>
              <TouchableOpacity onPress={discardCurrent} style={styles.reviewHeaderButton} accessibilityLabel="Discard this find">
                <Text style={styles.discardText}>Discard</Text>
              </TouchableOpacity>
              <Text style={styles.reviewTitle}>Review find</Text>
              <View style={styles.reviewHeaderButton} />
            </View>
            <ScrollView contentContainerStyle={[styles.reviewContent, { paddingBottom: safeBottom }]} keyboardShouldPersistTaps="handled">
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.itemPreview} onPress={() => setMode('item')} accessibilityLabel="Retake garment photo">
                  <Image source={{ uri: imageUris[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <View style={styles.photoBadge}><Text style={styles.photoBadgeText}>ITEM</Text></View>
                  <View style={styles.retakeBadge}><Ionicons name="camera-outline" size={14} color="#fff" /></View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tagPreview, !tagImageUri && styles.emptyTagPreview]}
                  onPress={() => setMode('tag')}
                  accessibilityLabel={tagImageUri ? 'Retake tag photo' : 'Add tag photo'}
                >
                  {tagImageUri ? (
                    <Image source={{ uri: tagImageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <>
                      <Ionicons name="pricetag-outline" size={26} color={colors.primary} />
                      <Text style={styles.addTagText}>Add tag photo</Text>
                    </>
                  )}
                  {tagImageUri && <View style={styles.photoBadge}><Text style={styles.photoBadgeText}>TAG</Text></View>}
                </TouchableOpacity>
              </View>

              {imageUris.length > 1 && <Text style={styles.photoCount}>{imageUris.length} garment photos selected</Text>}

              <View style={styles.quickFields}>
                <TextInput
                  style={styles.quickInput}
                  value={sessionStore}
                  onChangeText={setSessionStore}
                  placeholder="Store (carried through this session)"
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="done"
                />
                {locationLabel ? (
                  <View style={styles.locationChip}>
                    <Ionicons name="location-outline" size={15} color={colors.primary} />
                    <Text style={styles.locationText} numberOfLines={1}>{locationLabel}</Text>
                  </View>
                ) : null}
                <View style={styles.priceSizeRow}>
                  <View style={styles.priceInputWrap}>
                    <Text style={styles.currencyLabel}>$</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={price}
                      onChangeText={setPrice}
                      placeholder="Price"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sizeOptions}>
                    {SIZE_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[styles.sizeOption, size === option && styles.sizeOptionActive]}
                        onPress={() => setSize(size === option ? '' : option)}
                        accessibilityState={{ selected: size === option }}
                      >
                        <Text style={[styles.sizeOptionText, size === option && styles.sizeOptionTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={() => { void saveQuickFind(); }} disabled={isWorking}>
                {isWorking ? <ActivityIndicator color={colors.primaryForeground} /> : <Ionicons name="checkmark" size={20} color={colors.primaryForeground} />}
                <Text style={styles.saveButtonText}>{isWorking ? 'Saving…' : 'Save find'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.moreDetailsButton} onPress={() => setFullDetailsVisible(true)} disabled={isWorking}>
                <Text style={styles.moreDetailsText}>More details</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <>
            {permission?.granted ? (
              <CameraView
                ref={camera}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
                active={cameraActive}
                facing="back"
                mode="picture"
                onCameraReady={() => setCameraReady(true)}
                onMountError={(event) => Alert.alert('Camera unavailable', event.message)}
              />
            ) : (
              <View style={styles.permissionState}>
                <Ionicons name="camera-outline" size={42} color="#fff" />
                <Text style={styles.permissionTitle}>Camera access is off</Text>
                <Text style={styles.permissionCopy}>You can allow camera access or choose existing photos below.</Text>
                {!!permission?.canAskAgain && (
                  <TouchableOpacity style={styles.permissionButton} onPress={() => { void requestPermission(); }}>
                    <Text style={styles.permissionButtonText}>Allow camera</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.overlay}>
              <View style={[styles.topBar, { paddingTop: safeTop }]}>
                {mode === 'tag' ? (
                  <TouchableOpacity style={styles.roundButton} onPress={() => setMode('review')} accessibilityLabel="Back to review">
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                  </TouchableOpacity>
                ) : <View style={styles.roundButtonPlaceholder} />}
                <View style={styles.captureLabel}>
                  <Text style={styles.captureLabelText}>{mode === 'tag' ? 'TAG PHOTO' : 'DAILY FIND'}</Text>
                </View>
                {mode === 'item' ? (
                  <TouchableOpacity style={styles.doneButton} onPress={closeCamera} accessibilityLabel="Finish Daily Finds session">
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.doneButton} onPress={() => setMode('review')} accessibilityLabel="Skip tag photo">
                    <Text style={styles.doneButtonText}>Skip</Text>
                  </TouchableOpacity>
                )}
              </View>

              {mode === 'tag' && (
                <View style={styles.tagHint}>
                  <Ionicons name="pricetag-outline" size={18} color="#fff" />
                  <Text style={styles.tagHintText}>Fill the frame with the price or care tag</Text>
                </View>
              )}

              <View style={[styles.bottomBar, { paddingBottom: safeBottom }]}>
                <TouchableOpacity style={styles.galleryButton} onPress={() => { void chooseFromLibrary(); }} disabled={isWorking}>
                  <View style={styles.galleryIcon}><Ionicons name="images-outline" size={23} color="#fff" /></View>
                  <Text style={styles.galleryText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shutterOuter, (!cameraReady || isWorking || !permission?.granted) && styles.disabled]}
                  onPress={() => { void takePhoto(); }}
                  disabled={!cameraReady || isWorking || !permission?.granted}
                  accessibilityLabel={mode === 'tag' ? 'Take tag photo' : 'Take garment photo'}
                >
                  {isWorking ? <ActivityIndicator color="#28231F" /> : <View style={styles.shutterInner} />}
                </TouchableOpacity>
                <View style={styles.controlSpacer} />
              </View>
            </View>
          </>
        )}

        <StoreFindFormModal
          visible={fullDetailsVisible}
          onClose={() => setFullDetailsVisible(false)}
          onSave={saveFullFind}
          initialDraft={buildDraft()}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#12100F' },
  permissionState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xxl },
  permissionTitle: { color: '#fff', fontSize: typography.size.xl, fontWeight: typography.weight.bold },
  permissionCopy: { color: 'rgba(255,255,255,0.72)', fontSize: typography.size.md, textAlign: 'center', lineHeight: 22 },
  permissionButton: { minHeight: 46, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.primary },
  permissionButtonText: { color: colors.primaryForeground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1, justifyContent: 'space-between' },
  topBar: { paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: 54, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,16,14,0.62)' },
  roundButtonPlaceholder: { width: 54, height: 46 },
  captureLabel: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: 'rgba(20,16,14,0.55)' },
  captureLabelText: { color: '#fff', fontSize: typography.size.xs, fontWeight: typography.weight.bold, letterSpacing: 1.5 },
  doneButton: { minWidth: 54, height: 46, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: 'rgba(20,16,14,0.62)' },
  doneButtonText: { color: '#fff', fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  tagHint: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: 'rgba(20,16,14,0.66)' },
  tagHintText: { color: '#fff', fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  bottomBar: { paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(12,10,9,0.48)' },
  galleryButton: { width: 76, alignItems: 'center', gap: spacing.xs, paddingTop: spacing.md },
  galleryIcon: { width: 48, height: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.45)' },
  galleryText: { color: '#fff', fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  shutterOuter: { width: 78, height: 78, borderRadius: 39, padding: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 3, borderColor: '#fff' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  disabled: { opacity: 0.5 },
  controlSpacer: { width: 76 },
  reviewRoot: { flex: 1, backgroundColor: colors.background },
  reviewHeader: { minHeight: 98, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  reviewHeaderButton: { width: 72, minHeight: 44, justifyContent: 'center' },
  discardText: { color: colors.destructive, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  reviewTitle: { color: colors.foreground, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  reviewContent: { padding: spacing.lg, gap: spacing.md },
  photoRow: { height: 250, flexDirection: 'row', gap: spacing.sm },
  itemPreview: { flex: 1.45, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.muted },
  tagPreview: { flex: 0.85, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.muted },
  emptyTagPreview: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary },
  addTagText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, textAlign: 'center' },
  photoBadge: { position: 'absolute', left: spacing.sm, bottom: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.full, backgroundColor: 'rgba(0,0,0,0.68)' },
  photoBadgeText: { color: '#fff', fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1 },
  retakeBadge: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.68)' },
  photoCount: { color: colors.mutedForeground, fontSize: typography.size.xs, textAlign: 'center' },
  quickFields: { gap: spacing.sm },
  quickInput: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated, color: colors.foreground, fontSize: typography.size.md },
  locationChip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: colors.accent },
  locationText: { flex: 1, color: colors.primary, fontSize: typography.size.sm },
  priceSizeRow: { gap: spacing.sm },
  priceInputWrap: { height: 46, flexDirection: 'row', alignItems: 'center', borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  currencyLabel: { paddingLeft: spacing.md, color: colors.mutedForeground, fontSize: typography.size.md },
  priceInput: { flex: 1, height: 46, paddingHorizontal: spacing.sm, color: colors.foreground, fontSize: typography.size.md },
  sizeOptions: { gap: spacing.xs },
  sizeOption: { minWidth: 42, minHeight: 38, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.secondary },
  sizeOptionActive: { backgroundColor: colors.primary },
  sizeOptionText: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  sizeOptionTextActive: { color: colors.primaryForeground },
  saveButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.full, backgroundColor: colors.primary },
  saveButtonText: { color: colors.primaryForeground, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  moreDetailsButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  moreDetailsText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
});
