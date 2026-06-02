const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export function resolveImageUri(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('file://')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${API_URL}${imageUrl}`;
  // Raw base64 — assume JPEG
  return `data:image/jpeg;base64,${imageUrl}`;
}
