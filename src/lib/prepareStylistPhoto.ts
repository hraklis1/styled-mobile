import { Image } from 'react-native';
import { File, Paths } from 'expo-file-system';

import { compressImageToDataUrl } from './compressImage';

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function prepareStylistPhoto(uri: string) {
  let sourceUri = uri;
  let downloaded: File | null = null;
  try {
    if (/^https?:\/\//i.test(uri)) {
      const destination = new File(Paths.cache, `stylist_find_${Date.now()}.jpg`);
      downloaded = await File.downloadFileAsync(uri, destination);
      sourceUri = downloaded.uri;
    }
    const size = await imageSize(sourceUri);
    return await compressImageToDataUrl({ uri: sourceUri, ...size });
  } finally {
    if (downloaded?.exists) downloaded.delete();
  }
}
