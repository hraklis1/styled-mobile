import { useEffect, useState } from 'react';
import { cropImage } from '../../../lib/cropImage';

type Box = { x: number; y: number; width: number; height: number };

/**
 * A new piece's own crop, cut locally from the stored outfit photo for
 * display; the saved cover is cut again at full size when the outfit is
 * logged. Null without a crop, or until the cut is ready.
 */
export function useCropPreview(photoUri: string | undefined, box: Box | null | undefined, maxDim = 800): string | null {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!box || !photoUri) { setPreview(null); return; }
    let live = true;
    void cropImage(photoUri, box, { maxDim }).then((uri) => { if (live) setPreview(uri); });
    return () => { live = false; };
  }, [photoUri, box?.x, box?.y, box?.width, box?.height, maxDim]); // eslint-disable-line react-hooks/exhaustive-deps
  return preview;
}
