import type { StylistMode, StylistSendOptions } from './types';

export function buildInitialStylistSendOptions({
  text,
  mode,
  attachmentUri,
  photoData,
}: {
  text: string;
  mode?: StylistMode;
  attachmentUri?: string;
  photoData?: string;
}): StylistSendOptions {
  return {
    text,
    ...(mode ? { mode } : {}),
    ...(photoData && attachmentUri ? {
      photoData,
      attachment: { type: 'photo' as const, label: 'Shopping find', uri: attachmentUri },
    } : {}),
  };
}
