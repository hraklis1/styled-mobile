import * as FileSystem from 'expo-file-system/legacy';
import { uploadImageToR2 } from './uploadImage';
import type { StoreFind } from '../types/storeFind';

export async function uploadLocalImages(find: StoreFind, userId: string): Promise<StoreFind> {
  const uploadUri = async (uri: string): Promise<string> => {
    if (!uri.startsWith('file://')) return uri;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return uploadImageToR2(`data:image/jpeg;base64,${base64}`, userId);
  };

  const uploadedUrls = await Promise.all(
    (find.imageUrls ?? []).map(uploadUri),
  );
  const uploadedTagImageUrl = find.tagImageUrl ? await uploadUri(find.tagImageUrl) : find.tagImageUrl;

  return {
    ...find,
    imageUrls: uploadedUrls,
    imageUrl: uploadedUrls[0] ?? find.imageUrl,
    tagImageUrl: uploadedTagImageUrl,
  };
}
