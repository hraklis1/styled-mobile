import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const DEFAULT_MAX_DIM = 800;

type PickedAsset = { uri: string; width: number; height: number };

export type CompressedImage = {
  /** Local file URI — use for multipart FormData uploads. */
  uri: string;
  /** Base64 data URL — use for image preview or legacy JSON uploads. */
  dataUrl: string;
};

/**
 * Compresses an image URI to max `maxWidth` pixels wide (aspect-ratio preserved)
 * at JPEG quality `compress`. Returns the new local file URI — no base64 conversion.
 * Images already narrower than `maxWidth` are re-encoded at the target quality but
 * not upscaled.
 */
export async function compressImageUri(
  uri: string,
  maxWidth: number = 1080,
  compress: number = 0.8,
): Promise<string> {
  const { width } = await new Promise<{ width: number; height: number }>((resolve, reject) =>
    Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject),
  );

  const actions: ImageManipulator.Action[] =
    width > maxWidth ? [{ resize: { width: maxWidth } }] : [];

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return result.uri;
}

export async function compressImageToDataUrl(
  asset: PickedAsset,
  maxDim: number = DEFAULT_MAX_DIM,
  compress?: number,
): Promise<CompressedImage> {
  const { uri, width, height } = asset;

  const actions: ImageManipulator.Action[] = [];
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      actions.push({ resize: { width: maxDim } });
    } else {
      actions.push({ resize: { height: maxDim } });
    }
  }

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: compress ?? 0.75,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  return {
    uri: result.uri,
    dataUrl: `data:image/jpeg;base64,${result.base64}`,
  };
}
