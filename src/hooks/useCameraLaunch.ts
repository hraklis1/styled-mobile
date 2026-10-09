import { useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressImageToDataUrl } from '../lib/compressImage';

export type CapturedImage = {
  uri: string;
  dataUrl: string;
  /** Pixel size of the compressed image. */
  width: number;
  height: number;
  /** Raw EXIF data from the image, present when captureExif option is true. */
  exif?: Record<string, unknown> | null;
};

type Options = {
  /** Max dimension for compression (default: 1600 for pose scan, 800 for single-item) */
  maxDim?: number;
  /** Whether to allow editing after capture (default: false) */
  allowsEditing?: boolean;
  /** JPEG compress quality 0–1 (default: 0.75) */
  compress?: number;
  /** Include raw EXIF metadata in the returned image (e.g. for GPS extraction). */
  captureExif?: boolean;
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
      const { maxDim = 1600, allowsEditing = false, compress, captureExif = false } = options;

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
        exif: captureExif,
      });

      if (result.canceled || !result.assets[0]) return null;

      const asset = result.assets[0];
      try {
        const compressed = await compressImageToDataUrl(
          { uri: asset.uri, width: asset.width ?? maxDim, height: asset.height ?? maxDim },
          maxDim,
          compress,
        );
        return {
          ...compressed,
          exif: captureExif ? (asset.exif as Record<string, unknown> | null) : undefined,
        };
      } catch {
        // Callers can't tell this null from a cancel, so say something here —
        // otherwise the shot the user just took disappears without a word.
        showCaptureFailedAlert('camera');
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
      const { allowsEditing = false, captureExif = false } = options;

      // No library permission needed: the system picker runs out of process and
      // hands back only what's chosen. Asking first also broke the first launch —
      // the picker was presented while the permission alert was still dismissing
      // and iOS silently dropped it.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing,
        exif: captureExif,
      });

      if (result.canceled || !result.assets[0]) return null;

      return processLibraryAsset(result.assets[0], options);
    },
    [],
  );

  return launchLibrary;
}

/**
 * Compresses a photo-library asset the way `launchLibrary` does, for callers
 * that ran the picker themselves. Returns null (after telling the user) if
 * the image can't be read.
 */
export async function processLibraryAsset(
  asset: ImagePicker.ImagePickerAsset,
  options: Options = {},
): Promise<CapturedImage | null> {
  const { maxDim = 1600, compress, captureExif = false } = options;
  try {
    const compressed = await compressImageToDataUrl(
      { uri: asset.uri, width: asset.width ?? maxDim, height: asset.height ?? maxDim },
      maxDim,
      compress,
    );
    return {
      ...compressed,
      exif: captureExif ? (asset.exif as Record<string, unknown> | null) : undefined,
    };
  } catch {
    showCaptureFailedAlert('library');
    return null;
  }
}

/**
 * Returns a `launchLibraryMany` function: the photo library with multi-select
 * up to `limit`, returning the raw full-quality assets in the order picked
 * (empty if cancelled or permission is denied). Callers decide what one
 * photo versus several means.
 */
export function useLibraryLaunchMany() {
  return useCallback(
    async ({ limit, captureExif = false }: { limit: number; captureExif?: boolean }): Promise<ImagePicker.ImagePickerAsset[]> => {
      // No library permission needed: the system picker runs out of process and
      // hands back only what's chosen. Asking first also broke the first launch —
      // the picker was presented while the permission alert was still dismissing
      // and iOS silently dropped it.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: limit,
        quality: 1,
        exif: captureExif,
      });
      return result.canceled ? [] : result.assets;
    },
    [],
  );
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

function showCaptureFailedAlert(source: 'camera' | 'library') {
  Alert.alert(
    "Couldn't use that photo",
    source === 'camera'
      ? 'Something went wrong preparing your photo. Please try taking it again.'
      : 'Something went wrong preparing that photo. Please try picking it again.',
    [{ text: 'OK' }],
  );
}
