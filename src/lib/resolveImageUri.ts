import { API_BASE_URL } from './api';

export function resolveImageUri(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('file://')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${API_BASE_URL}${imageUrl}`;
  // Raw base64 — assume JPEG
  return `data:image/jpeg;base64,${imageUrl}`;
}
