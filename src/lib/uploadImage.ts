import { api } from './api';

/** True for inline base64 data URIs (vs hosted http/https URLs). */
export function isDataUri(url: string | null | undefined): boolean {
  return !!url && url.startsWith('data:');
}

/**
 * Uploads a base64 data URL to R2 via the presigned-URL flow and returns the
 * hosted public URL. Shared by the scan, manual-add, and AI-refine paths so
 * every item image lands in object storage rather than as inline base64 in
 * Postgres (which bloats the closet list payload as a library grows).
 *
 * RN's fetch can't read data: URIs and its Blob can silently re-encode binary
 * through XHR, so we parse the data URL by hand and PUT a raw ArrayBuffer.
 */
export async function uploadImageToR2(dataUrl: string, userId: string | number): Promise<string> {
  const commaIdx = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, commaIdx); // e.g. "data:image/webp;base64"
  const base64 = dataUrl.slice(commaIdx + 1);
  const mimeType = meta.slice(5).replace(';base64', '') || 'image/jpeg';
  const ext = mimeType.includes('webp') ? 'webp' : 'jpg';
  const fileName = `users/${userId}/items/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { presignedUrl, publicUrl } = await api
    .post<{ presignedUrl: string; publicUrl: string }>('/api/upload-url', {
      fileName,
      fileType: mimeType,
    })
    .then((r) => r.data);

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`R2 upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('R2 upload network error'));
    xhr.send(bytes.buffer);
  });

  return publicUrl;
}

/**
 * Returns a hosted URL for an image: passes hosted URLs through unchanged and
 * uploads data: URIs to R2 first. Safe no-op for null/empty.
 */
export async function ensureHostedImage(
  url: string | null | undefined,
  userId: string | number,
): Promise<string | null> {
  if (!url) return null;
  if (!isDataUri(url)) return url;
  return uploadImageToR2(url, userId);
}
