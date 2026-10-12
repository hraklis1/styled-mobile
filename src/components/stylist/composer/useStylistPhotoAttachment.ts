import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressImageToDataUrl } from '../../../lib/compressImage';

type Options = {
  closeSheet: () => void;
  onPhoto: (photo: { uri: string; dataUrl: string }) => void;
  onChooseCloset: () => void;
};

/** A native picker must be presented only after the source modal has dismissed. */
export function useStylistPhotoAttachment({ closeSheet, onPhoto, onChooseCloset }: Options) {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const pending = useRef<(() => Promise<void> | void) | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pending.current = null; };
  }, []);

  const afterDismiss = useCallback(async () => {
    const action = pending.current;
    if (!action) return;
    pending.current = null;
    try {
      await action();
    } catch {
      if (mounted.current) Alert.alert('Could not load photo', 'Please try again. Your question is still here.');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);

  const queue = (action: () => Promise<void> | void) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    pending.current = action;
    closeSheet();
  };

  const choosePhoto = (source: 'camera' | 'library') => queue(async () => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!mounted.current) return;
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to show your stylist what you are wearing.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result = await (source === 'camera'
      ? ImagePicker.launchCameraAsync(options)
      : ImagePicker.launchImageLibraryAsync(options));
    if (!mounted.current || result.canceled || !result.assets?.[0]) return;
    const compressed = await compressImageToDataUrl(result.assets[0]);
    if (mounted.current) onPhoto({ uri: compressed.uri, dataUrl: compressed.dataUrl });
  });

  return { busy, choosePhoto, chooseCloset: () => queue(onChooseCloset), afterDismiss };
}
