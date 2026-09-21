import { captureItemPrice } from '../shoppingCapturePrice';
import type { ShoppingVisitPreview } from '../../stores/useShoppingSessionStore';

const preview = (overrides: Partial<ShoppingVisitPreview>): ShoppingVisitPreview => ({
  id: 'p', shoppingSessionId: 's', captureGroupId: 'g', captureSequence: 0, localFileUri: 'file://p',
  previewUri: null, captureRole: 'unknown', ocrStatus: 'complete', syncStatus: 'pending', storagePath: null, timestamp: 0,
  ...overrides,
});
const usd = (amount: number) => ({ amount, currencyCode: 'USD', label: `$${amount}` });

describe('captureItemPrice', () => {
  it('reports reading while OCR is still running and missing afterwards', () => {
    expect(captureItemPrice([preview({ ocrStatus: 'processing' })]).status).toBe('reading');
    expect(captureItemPrice([preview({ price: { amount: null, currencyCode: null, status: 'missing', candidates: [] } })]).status).toBe('missing');
  });

  it('shows the tag reading and ignores a garment photo that read something else', () => {
    const result = captureItemPrice([
      preview({ id: 'garment', captureRole: 'garment', price: { amount: 5, currencyCode: 'USD', status: 'resolved', candidates: [usd(5)] } }),
      preview({ id: 'tag', captureRole: 'tag', price: { amount: 90, currencyCode: 'USD', status: 'resolved', inferred: true, candidates: [usd(120), usd(90)] } }),
    ]);
    expect(result).toMatchObject({ amount: 90, currencyCode: 'USD', status: 'resolved', inferred: true, confirmed: false });
    expect(result.candidates.map((candidate) => candidate.amount)).toEqual([5, 120, 90]);
  });

  it('asks when tag photos disagree or one could not decide', () => {
    expect(captureItemPrice([
      preview({ id: 'a', captureRole: 'tag', price: { amount: 120, currencyCode: 'USD', status: 'resolved', candidates: [usd(120)] } }),
      preview({ id: 'b', captureRole: 'tag', price: { amount: 90, currencyCode: 'USD', status: 'resolved', candidates: [usd(90)] } }),
    ])).toMatchObject({ amount: null, status: 'ambiguous' });
    expect(captureItemPrice([
      preview({ id: 'a', captureRole: 'tag', price: { amount: null, currencyCode: null, status: 'ambiguous', candidates: [usd(60), { amount: 90, currencyCode: 'CAD', label: 'CAD 90' }] } }),
    ])).toMatchObject({ status: 'ambiguous' });
  });

  it('lets a confirmed choice win over every reading', () => {
    expect(captureItemPrice([
      preview({ id: 'a', captureRole: 'tag', price: { amount: null, currencyCode: null, status: 'ambiguous', candidates: [usd(60), usd(90)] } }),
    ], { amount: 60, currencyCode: 'USD' })).toMatchObject({ amount: 60, currencyCode: 'USD', status: 'resolved', confirmed: true });
  });
});
