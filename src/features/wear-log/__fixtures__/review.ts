import type { Item } from '../../../types/item';
import { IDLE, reduce } from '../reducer';
import type { ReviewFlow, WearDetection } from '../types';

export const closetItems = [
  { id: 1, name: 'Linen shirt', brand: 'Zara', category: 'top', color: 'beige', imageUrl: null, cutoutUrl: null, coverImageVariant: 'original' },
  { id: 2, name: 'Cotton shirt', brand: 'COS', category: 'top', color: 'white', imageUrl: null, cutoutUrl: null, coverImageVariant: 'original' },
  { id: 3, name: 'White trousers', brand: 'Zara', category: 'bottom', color: 'white', imageUrl: null, cutoutUrl: null, coverImageVariant: 'original' },
] as Item[];

export function detection(id: string, band: WearDetection['match']['band'] = 'medium', itemId: number | null = 1): WearDetection {
  return { id, layer: 'base', bbox_pct: null, cutoutUrl: null,
    attributes: { name: 'Beige shirt', category: 'top', color: 'beige', description: 'Short sleeve shirt' },
    lowConfidenceFields: [], match: { band, itemId, confidence: 0.6 }, candidates: [{ itemId: 1, score: 0.8 }, { itemId: 2, score: 0.5 }] };
}
export function reviewFixture(detections = [detection('d0'), detection('d1', 'low', null)]): ReviewFlow {
  const processing = reduce(IDLE, { type: 'capture', id: 'flow-test', photoUri: 'file:///outfit.jpg', date: '2026-09-30', now: 1 });
  return reduce(processing, { type: 'scanSucceeded', id: 'flow-test', scan: { format: 2, scanId: 'scan-test', imageUrl: 'https://example.com/outfit.jpg', detections }, now: 2 }) as ReviewFlow;
}
