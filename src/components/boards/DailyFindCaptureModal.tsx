import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { compressImageUri } from '../../lib/compressImage';
import { capturePhotoLocationData, type CapturedLocation } from '../../lib/photoLocation';
import { persistStoreFindPhoto } from './StoreFindFormModal';

const MAX_PHOTOS = 5;

type Props = {
  visible: boolean;
  onClose: () => void;
  onCaptured: (imageUris: string[], location: CapturedLocation | null) => void;
};

async function persistCapturedPhoto(uri: string): Promise<string> {
  const compressed = await compressImageUri(uri, 1080, 0.82);
  return persistStoreFindPhoto(compressed);
}

export function DailyFindCaptureModal({ visible, onClose, onCaptured }: Props) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
    if (!visible) setCameraReady(false);
  }, [permission, requestPermission, visible]);

  const finish = useCallback((uris: string[], location: CapturedLocation | null) => {
    onCaptured(uris, location);
    onClose();
  }, [onCaptured, onClose]);

  const takePhoto = useCallback(async () => {
    if (!camera.current || !cameraReady || isWorking) return;
    setIsWorking(true);
    try {
      await Haptics.selectionAsync();
      const photo: CameraCapturedPicture = await camera.current.takePictureAsync({
        quality: 0.9,
        exif: true,
      });
      const uri = await persistCapturedPhoto(photo.uri);
      const location = await capturePhotoLocationData(photo.exif, true);
      finish([uri], location);
    } catch (error) {
      Alert.alert('Photo not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsWorking(false);
    }
  }, [cameraReady, finish, isWorking]);

  const chooseFromLibrary = useCallback(async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await Haptics.selectionAsync();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_PHOTOS,
        orderedSelection: true,
        quality: 1,
        exif: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const uris = await Promise.all(result.assets.slice(0, MAX_PHOTOS).map((asset) => persistCapturedPhoto(asset.uri)));
      let location: CapturedLocation | null = null;
      for (const asset of result.assets.slice(0, MAX_PHOTOS)) {
        location = await capturePhotoLocationData(asset.exif, false);
        if (location) break;
      }
      finish(uris, location);
    } catch (error) {
      Alert.alert('Photos not added', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsWorking(false);
    }
  }, [finish, isWorking]);

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            active={visible}
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

        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.roundButton} onPress={onClose} accessibilityLabel="Close camera">
              <Ionicons name="close" size={25} color="#fff" />
            </TouchableOpacity>
            <View style={styles.captureLabel}>
              <Text style={styles.captureLabelText}>DAILY FIND</Text>
            </View>
            <View style={styles.roundButtonPlaceholder} />
          </View>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={() => { void chooseFromLibrary(); }}
              disabled={isWorking}
              accessibilityLabel="Choose up to five photos from library"
            >
              <View style={styles.galleryIcon}>
                <Ionicons name="images-outline" size={23} color="#fff" />
              </View>
              <Text style={styles.galleryText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shutterOuter, (!cameraReady || isWorking || !permission?.granted) && styles.disabled]}
              onPress={() => { void takePhoto(); }}
              disabled={!cameraReady || isWorking || !permission?.granted}
              accessibilityLabel="Take photo"
            >
              {isWorking ? <ActivityIndicator color="#28231F" /> : <View style={styles.shutterInner} />}
            </TouchableOpacity>

            <View style={styles.controlSpacer} />
          </View>
        </SafeAreaView>
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
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,16,14,0.62)' },
  roundButtonPlaceholder: { width: 46, height: 46 },
  captureLabel: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: 'rgba(20,16,14,0.55)' },
  captureLabelText: { color: '#fff', fontSize: typography.size.xs, fontWeight: typography.weight.bold, letterSpacing: 1.5 },
  bottomBar: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(12,10,9,0.48)' },
  galleryButton: { width: 76, alignItems: 'center', gap: spacing.xs, paddingTop: spacing.md },
  galleryIcon: { width: 48, height: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.45)' },
  galleryText: { color: '#fff', fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  shutterOuter: { width: 78, height: 78, borderRadius: 39, padding: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 3, borderColor: '#fff' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  disabled: { opacity: 0.5 },
  controlSpacer: { width: 76 },
});
