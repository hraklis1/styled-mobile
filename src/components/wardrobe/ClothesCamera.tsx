import React, { useRef, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const MAX_PHOTOS = 10;

/** Keep shooting until the user chooses to hand their photos to scan review. */
export function ClothesCamera({ onCancel, onUse }: {
  onCancel: () => void;
  onUse: (photos: ImagePickerAsset[]) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const locked = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<ImagePickerAsset[]>([]);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const cancel = () => {
    if (locked.current) return;
    if (!photos.length) { onCancel(); return; }
    Alert.alert('Discard photos?', 'These photos haven’t been scanned yet.', [
      { text: 'Keep taking photos', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ]);
  };
  const capture = async () => {
    if (locked.current || !ready || photos.length >= MAX_PHOTOS || !camera.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 1, exif: true });
      if (photo) setPhotos(current => [...current, { uri: photo.uri, width: photo.width, height: photo.height, exif: photo.exif, type: 'image' }]);
    } catch {
      Alert.alert('Couldn’t take photo', 'Please try again. Your other photos are still here.');
    } finally { locked.current = false; setBusy(false); }
  };
  const submitPhotos = async () => {
    if (locked.current || !photos.length) return;
    locked.current = true;
    setBusy(true);
    try { await onUse(photos); }
    catch { Alert.alert('Couldn’t start scan', 'Your photos are still here. Please try again.'); }
    finally { locked.current = false; setBusy(false); }
  };
  return (
    <Modal animationType="slide" onRequestClose={cancel}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.row}>
          <TouchableOpacity onPress={cancel} disabled={busy} accessibilityRole="button"><Text style={styles.text}>Cancel</Text></TouchableOpacity>
          <Text style={styles.text}>Add clothes</Text>
          <TouchableOpacity disabled={busy} onPress={() => { setReady(false); setFacing(value => value === 'back' ? 'front' : 'back'); }} accessibilityRole="button" accessibilityLabel="Flip camera"><Text style={styles.text}>Flip</Text></TouchableOpacity>
        </View>
        {permission?.granted ? (
          <CameraView ref={camera} style={styles.preview} facing={facing} onCameraReady={() => setReady(true)} onMountError={() => { setReady(false); Alert.alert('Camera unavailable', 'Try reopening the camera on your phone.'); }} />
        ) : (
          <View style={[styles.preview, styles.center]}>
            <Text style={styles.text}>Allow camera access to photograph your clothes.</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => { if (permission?.canAskAgain === false) void Linking.openSettings(); else void requestPermission(); }}><Text style={styles.text}>{permission?.canAskAgain === false ? 'Open Settings' : 'Allow camera'}</Text></TouchableOpacity>
          </View>
        )}
        <Text style={styles.hint}>{photos.length === MAX_PHOTOS ? 'Photo limit reached — use these photos or remove one.' : 'Take one photo or keep going for a batch.'}</Text>
        <ScrollView horizontal style={styles.tray} contentContainerStyle={styles.thumbnails}>
          {photos.map((photo, index) => (
            <TouchableOpacity key={photo.uri} disabled={busy} accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => setPhotos(current => current.filter((_, i) => i !== index))}>
              <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
              <Text style={styles.remove}>×</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.row}>
          <Text style={styles.text}>{photos.length}/{MAX_PHOTOS}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Take photo" disabled={busy || !ready || photos.length >= MAX_PHOTOS} onPress={() => void capture()} style={[styles.shutter, (busy || !ready || photos.length >= MAX_PHOTOS) && styles.disabled]} />
          <TouchableOpacity accessibilityRole="button" disabled={busy || !photos.length} onPress={() => void submitPhotos()} style={(busy || !photos.length) && styles.disabled}><Text style={styles.text}>{busy ? 'Preparing…' : `Use ${photos.length === 1 ? 'photo' : 'photos'}`}</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  text: { color: '#fff', fontSize: 16 },
  hint: { color: '#fff', textAlign: 'center', padding: 12 },
  preview: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  tray: { flexGrow: 0, height: 82 },
  thumbnails: { gap: 10, paddingHorizontal: 20 },
  thumbnail: { width: 64, height: 76, borderRadius: 8 },
  remove: { position: 'absolute', right: 2, top: 0, color: '#fff', backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 5, fontSize: 20 },
  shutter: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff', borderWidth: 5, borderColor: '#888' },
  disabled: { opacity: 0.4 },
});
