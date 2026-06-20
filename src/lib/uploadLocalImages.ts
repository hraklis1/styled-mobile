import * as FileSystem from 'expo-file-system/legacy';
import { uploadImageToR2 } from './uploadImage';
import type { StoreFind } from '../types/storeFind';

export async function uploadLocalImages(find: StoreFind, userId: string): Promise<StoreFind> {
  if (!find.imageUrls?.length) return find;

  const uploadedUrls = await Promise.all(
    find.imageUrls.map(async (uri) => {
      if (!uri.startsWith('file://')) return uri;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return uploadImageToR2(`data:image/jpeg;base64,${base64}`, userId);
    }),
  );

  return {
    ...find,
    imageUrls: uploadedUrls,
    imageUrl: uploadedUrls[0] ?? find.imageUrl,
  };
}
