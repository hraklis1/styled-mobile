import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import type { Bbox } from '../components/wardrobe/CropAdjustModal';

function getImageSize(uri: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) =>
    Image.getSize(uri, (w, h) => resolve({ w, h }), reject),
  );
}

// Crops a region from a URI or base64 data URL using expo-image-manipulator.
// Bbox coordinates are percentages (0–100). Returns a JPEG data URL, or null on failure.
export async function cropImage(
  uri: string,
  bbox: Bbox,
  options: { maxDim?: number; quality?: number } = {},
): Promise<string | null> {
  const { maxDim = 600, quality = 0.82 } = options;

  try {
    const { w: natW, h: natH } = await getImageSize(uri);

    const sx = Math.max(0, Math.round((bbox.x / 100) * natW));
    const sy = Math.max(0, Math.round((bbox.y / 100) * natH));
    const sw = Math.min(natW - sx, Math.round((bbox.width / 100) * natW));
    const sh = Math.min(natH - sy, Math.round((bbox.height / 100) * natH));

    if (sw <= 0 || sh <= 0) return null;

    const actions: ImageManipulator.Action[] = [
      { crop: { originX: sx, originY: sy, width: sw, height: sh } },
    ];

    const longest = Math.max(sw, sh);
    if (longest > maxDim) {
      actions.push(sw >= sh ? { resize: { width: maxDim } } : { resize: { height: maxDim } });
    }

    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });

    return result.base64 ? `data:image/jpeg;base64,${result.base64}` : result.uri;
  } catch {
    return null;
  }
}
