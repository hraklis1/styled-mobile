jest.mock('../../lib/api', () => ({
  api: {
    post: jest.fn(),
  },
  isNetworkError: jest.fn(),
}));

jest.mock('../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../useOutfits', () => ({ OUTFITS_QUERY_KEY: ['outfits'] }));
jest.mock('../useShoppingBrief', () => ({ invalidateShoppingBriefQueries: jest.fn() }));

import { api } from '../../lib/api';
import { ITEM_SCAN_TIMEOUT_MS, POSE_SCAN_TIMEOUT_MS, scanItemDirect, scanVisionPoseDirect } from '../useItems';

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
});
