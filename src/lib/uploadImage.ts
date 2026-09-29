import { api } from './api';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { mapWithConcurrency } from './asyncPool';

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
  const fileName = `users/${userId}/items/${Date.now()}-${Crypto.randomUUID()}.${ext}`;

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

export type PresignedUpload = { presignedUrl: string; publicUrl: string };

/**
 * Presigned PUTs for several files in one round trip. The server names the
 * objects (under the caller's own folder) and they stay valid for 10 minutes.
 */
export async function requestUploadUrls(contentTypes: string[]): Promise<PresignedUpload[]> {
  if (contentTypes.length === 0) return [];
  const { data } = await api.post<{ urls: PresignedUpload[] }>('/api/upload-urls', {
    files: contentTypes.map((contentType) => ({ contentType })),
  });
  return data.urls;
}

/**
 * PUT a file on disk to a presigned URL natively. Unlike uploadImageToR2, the
 * bytes never pass through the JS thread (no base64 decode loop), so a batch
 * of uploads doesn't stutter the screen the user is browsing.
 */
export async function uploadFileToR2(
  fileUri: string,
  contentType: string,
  upload: PresignedUpload,
): Promise<string> {
  const result = await new File(fileUri).upload(upload.presignedUrl, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': contentType },
    mimeType: contentType,
  });
  if (result.status < 200 || result.status >= 300) {
    throw Object.assign(new Error(`R2 upload failed: ${result.status}`), { status: result.status });
  }
  return upload.publicUrl;
}

/**
 * Upload several data-URL images with one presign round trip and native PUTs,
 * `concurrency` at a time. Each image is written to a cache file first, which
 * is a native base64 decode — the JS-thread loop in uploadImageToR2 is what
 * this avoids — and deleted once its PUT settles.
 *
 * Returns one settled result per input, in order, so the caller can tell a
 * failed photo from a failed cutout. Throws only if presigning fails, since
 * then nothing could have been uploaded.
 */
export async function uploadDataUrlsToR2(
  dataUrls: string[],
  concurrency = 4,
): Promise<PromiseSettledResult<string>[]> {
  if (dataUrls.length === 0) return [];
  const parsed = dataUrls.map((dataUrl) => {
    const commaIdx = dataUrl.indexOf(',');
    const contentType = dataUrl.slice(5, commaIdx).replace(';base64', '') || 'image/jpeg';
    return { contentType, base64: dataUrl.slice(commaIdx + 1) };
  });
  const uploads = await requestUploadUrls(parsed.map((p) => p.contentType));
  return mapWithConcurrency(parsed, concurrency, async ({ contentType, base64 }, index) => {
    const ext = contentType.includes('webp') ? 'webp' : contentType.includes('png') ? 'png' : 'jpg';
    const file = new File(Paths.cache, `upload-${Crypto.randomUUID()}.${ext}`);
    file.create();
    file.write(base64, { encoding: 'base64' });
    try {
      return await uploadFileToR2(file.uri, contentType, uploads[index]);
    } finally {
      try { file.delete(); } catch { /* cache dir; the OS reclaims it */ }
    }
  });
}
