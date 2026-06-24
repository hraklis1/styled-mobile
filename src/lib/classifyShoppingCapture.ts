export type ShoppingCaptureRole = 'garment' | 'tag' | 'unknown';

/**
 * Cheap, deterministic tag detection using only the OCR already running on
 * device. Group membership never depends on this heuristic; it only labels
 * the photo within the user's explicit capture stack.
 */
export function classifyShoppingCapture(
  rawOcrText: string,
  extractedPrice: number | null,
): ShoppingCaptureRole {
  const text = rawOcrText.trim();
  if (!text && extractedPrice === null) return 'garment';

  let score = extractedPrice === null ? 0 : 3;
  if (/\b(?:sku|style|item|article|upc|colour|color)\b/i.test(text)) score += 2;
  if (/\b(?:size|xs|s|m|l|xl|xxl)\b/i.test(text)) score += 1;
  if (/\b[A-Z0-9]{6,16}\b/.test(text)) score += 1;
  if (text.split(/\r?\n/).filter(Boolean).length >= 4) score += 1;

  return score >= 2 ? 'tag' : 'garment';
}
