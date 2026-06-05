import * as ImageManipulator from 'expo-image-manipulator';

const DEFAULT_MAX_DIM = 800;

type PickedAsset = { uri: string; width: number; height: number };

export type CompressedImage = {
  /** Local file URI — use for multipart FormData uploads. */
  uri: string;
  /** Base64 data URL — use for image preview or legacy JSON uploads. */
  dataUrl: string;
};

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
