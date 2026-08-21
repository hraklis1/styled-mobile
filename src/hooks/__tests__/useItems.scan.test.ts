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
import { ITEM_SCAN_TIMEOUT_MS, scanItemDirect } from '../useItems';

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
