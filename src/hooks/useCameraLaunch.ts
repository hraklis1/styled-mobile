import { useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressImageToDataUrl } from '../lib/compressImage';

export type CapturedImage = {
  uri: string;
  dataUrl: string;
};

type Options = {
  /** Max dimension for compression (default: 1600 for pose scan, 800 for single-item) */
  maxDim?: number;
  /** Whether to allow editing after capture (default: false) */
  allowsEditing?: boolean;
  /** JPEG compress quality 0–1 (default: 0.75) */
  compress?: number;
};

/**
 * Returns a `launchCamera` function that:
 *  1. Checks/requests camera permission with a user-friendly message on denial.
 *  2. Opens the system camera via expo-image-picker.
 *  3. Compresses the result and returns { uri, dataUrl }.
 *  4. Returns null if cancelled, permission denied, or capture fails.
 */
export function useCameraLaunch() {
  const launchCamera = useCallback(
    async (options: Options = {}): Promise<CapturedImage | null> => {
      const { maxDim = 1600, allowsEditing = false, compress } = options;

      // Check permission status first
      const { status } = await ImagePicker.getCameraPermissionsAsync();

      if (status === 'denied') {
        showDeniedAlert();
        return null;
      }

      if (status !== 'granted') {
        const { status: requested } = await ImagePicker.requestCameraPermissionsAsync();
        if (requested !== 'granted') {
          showDeniedAlert();
          return null;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing,
      });

      if (result.canceled || !result.assets[0]) return null;

      const asset = result.assets[0];
      try {
        const compressed = await compressImageToDataUrl(
          { uri: asset.uri, width: asset.width ?? maxDim, height: asset.height ?? maxDim },
          maxDim,
          compress,
        );
        return compressed;
      } catch {
        return null;
      }
    },
    [],
  );

  return launchCamera;
}

/**
 * Returns a `launchLibrary` function that opens the photo library and compresses
 * the selected image. Returns null if cancelled or fails.
 */
export function useLibraryLaunch() {
  const launchLibrary = useCallback(
    async (options: Options = {}): Promise<CapturedImage | null> => {
      const { maxDim = 1600, allowsEditing = false, compress } = options;

      // Request photo library permission if not already granted
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status === 'denied') {
        showLibraryDeniedAlert();
        return null;
      }
      if (status !== 'granted') {
        const { status: requested } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (requested !== 'granted') {
          showLibraryDeniedAlert();
          return null;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing,
      });

      if (result.canceled || !result.assets[0]) return null;

      const asset = result.assets[0];
      try {
        const compressed = await compressImageToDataUrl(
          { uri: asset.uri, width: asset.width ?? maxDim, height: asset.height ?? maxDim },
          maxDim,
          compress,
        );
        return compressed;
      } catch {
        return null;
      }
    },
    [],
  );

  return launchLibrary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showDeniedAlert() {
  Alert.alert(
    'Camera access needed',
    'Styled needs camera access to scan your clothing. Enable it in Settings.',
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

function showLibraryDeniedAlert() {
  Alert.alert(
    'Photo library access needed',
    'Styled needs photo library access to scan items. Enable it in Settings.',
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
