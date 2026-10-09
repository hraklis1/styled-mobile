jest.mock('../../lib/api', () => ({
  api: {
    post: jest.fn(),
  },
  isNetworkError: jest.fn(),
}));

jest.mock('../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../useOutfits', () => ({ OUTFITS_QUERY_KEY: ['outfits'] }));
jest.mock('../useShoppingBrief', () => ({ invalidateShoppingBriefQueries: jest.fn() }));

import { api, isNetworkError } from '../../lib/api';
import {
  ITEM_SCAN_TIMEOUT_MS,
  POSE_SCAN_TIMEOUT_MS,
  isRetryableScanError,
  scanItemDirect,
  scanVisionPoseDirect,
} from '../useItems';

const mockPost = jest.mocked(api.post);

describe('scanItemDirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the long extraction timeout and preserves the supplied retry key', async () => {
    mockPost.mockResolvedValue({ data: { name: 'Striped shirt' } });

    await scanItemDirect({
      imageData: 'data:image/jpeg;base64,crop',
      targetName: 'Shirt',
      idempotencyKey: 'piece-12345678',
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/api/items/scan',
      {
        imageData: 'data:image/jpeg;base64,crop',
        targetName: 'Shirt',
      },
      {
        timeout: ITEM_SCAN_TIMEOUT_MS,
        headers: { 'Idempotency-Key': 'piece-12345678' },
      },
    );
  });
});

describe('scanVisionPoseDirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('outlives the axios default, which the multi-model scan regularly exceeds', async () => {
    mockPost.mockResolvedValue({ data: { items: [] } });

    await scanVisionPoseDirect('data:image/jpeg;base64,photo', 'scan-photo-1');

    expect(POSE_SCAN_TIMEOUT_MS).toBeGreaterThan(15_000);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/scan-vision-pose',
      { imageBase64: 'data:image/jpeg;base64,photo' },
      expect.objectContaining({ timeout: POSE_SCAN_TIMEOUT_MS }),
    );
  });

  it("reuses the caller's key so a retry never pays for a second scan", async () => {
    mockPost.mockResolvedValue({ data: { items: [] } });

    await scanVisionPoseDirect('photo', 'scan-photo-1');
    await scanVisionPoseDirect('photo', 'scan-photo-1');

    const keys = mockPost.mock.calls.map((call) => (call[2] as { headers: Record<string, string> }).headers['Idempotency-Key']);
    expect(keys).toEqual(['scan-photo-1', 'scan-photo-1']);
  });

  it('asks for the v2 shape, without inline base64', async () => {
    mockPost.mockResolvedValue({ data: { format: 2, items: [] } });

    await scanVisionPoseDirect('photo', 'scan-photo-1');

    const headers = (mockPost.mock.calls[0][2] as { headers: Record<string, string> }).headers;
    expect(headers['X-Scan-Format']).toBe('2');
  });
});

describe('isRetryableScanError', () => {
  const status = (code: number) => ({ response: { status: code } });

  beforeEach(() => {
    jest.mocked(isNetworkError).mockReturnValue(false);
  });

  it('retries a refunded label failure and other transient gateway errors', () => {
    expect(isRetryableScanError(status(503))).toBe(true);
    expect(isRetryableScanError(status(502))).toBe(true);
  });

  it('retries a dropped connection', () => {
    jest.mocked(isNetworkError).mockReturnValue(true);
    expect(isRetryableScanError(new Error('Network Error'))).toBe(true);
  });

  it('does not retry refusals that would be refused again', () => {
    for (const code of [400, 402, 429, 500]) {
      expect(isRetryableScanError(status(code))).toBe(false);
    }
  });
});
