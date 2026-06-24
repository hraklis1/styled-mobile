import { extractTextFromImage, isSupported } from 'expo-text-extractor';

export const PRICE_REGEX = /\$\s?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)/;

export type LocalOCRResult = {
  extractedPrice: number | null;
  rawOcrText: string;
};

export function extractPriceFromText(text: string): number | null {
  const match = text.match(PRICE_REGEX);
  if (!match) return null;

  const price = Number.parseFloat(match[1].replaceAll(',', ''));
  return Number.isFinite(price) ? price : null;
}

/** Runs entirely on-device using Apple Vision on iOS and ML Kit on Android. */
export async function processLocalOCR(localFileUri: string): Promise<LocalOCRResult> {
  if (!isSupported) {
    throw new Error('On-device text recognition is not supported on this device.');
  }

  const recognizedLines = await extractTextFromImage(localFileUri);
  const rawOcrText = recognizedLines.join('\n').trim();

  return {
    extractedPrice: extractPriceFromText(rawOcrText),
    rawOcrText,
  };
}
