jest.mock('../../../lib/api', () => ({ api: { post: jest.fn() } }));
jest.mock('../../../hooks/useItems', () => ({ createItemsBatch: jest.fn() }));
jest.mock('../../../lib/cropImage', () => ({ cropImage: jest.fn(async () => 'data:image/jpeg;base64,crop') }));
jest.mock('../../../lib/uploadImage', () => ({ uploadDataUrlsToR2: jest.fn(async () => [{ status: 'fulfilled', value: 'https://r2.example/crop.jpg' }]) }));

import { api } from '../../../lib/api';
import { createItemsBatch } from '../../../hooks/useItems';
import { newItemInput, saveWearLog } from '../api';
import { draftFrom, reduce } from '../reducer';
import type { ReviewFlow } from '../types';
import { closetItems, detection, reviewFixture } from '../__fixtures__/review';

const post = jest.mocked(api.post);
const batch = jest.mocked(createItemsBatch);

beforeEach(() => { jest.clearAllMocks(); post.mockResolvedValue({ data: { id: 8, alreadyLoggedItemIds: [] } }); });

it('saves unique detected and additional IDs with the existing API contract', async () => {
  const flow = { ...reviewFixture([detection('d0', 'high')]), additionalItemIds: [1, 3] };
  const result = await saveWearLog(flow);
  expect(result.itemIds).toEqual([1, 3]);
  expect(post).toHaveBeenCalledWith('/api/outfit-logs', { clientLogId: 'flow-test', date: '2026-09-30', itemIds: [1, 3], imageUrl: 'https://example.com/outfit.jpg' });
  expect(batch).not.toHaveBeenCalled();
});

it('saves a manual-only outfit', async () => {
  const flow = { ...reviewFixture([]), additionalItemIds: [3] };
  expect((await saveWearLog(flow)).itemIds).toEqual([3]);
});

it('retries new-item creation and logging with the same idempotency keys', async () => {
  const flow = reduce(reviewFixture([detection('d0', 'low', null)]), { type: 'markNew', detectionId: 'd0' }) as ReviewFlow;
  flow.additionalItemIds = [3];
  batch.mockResolvedValue({ items: [closetItems[0]], rejected: [] });
  post.mockRejectedValueOnce(new Error('connection lost'));
  await expect(saveWearLog(flow)).rejects.toThrow('connection lost');
  await expect(saveWearLog(flow)).resolves.toMatchObject({ itemIds: [3, 1] });
  expect(batch.mock.calls[0]).toEqual(batch.mock.calls[1]);
  expect(batch.mock.calls[0][0][0].clientImportId).toBe('wear-flow-test-d0');
  expect(post.mock.calls[0]).toEqual(post.mock.calls[1]);
});

describe('new piece cover image', () => {
  const draft = draftFrom(detection('d0'));
  it('uses the background-intact crop as the cover, keeping the cutout on the item', () => {
    const input = newItemInput('flow-test', { ...detection('d0'), cropUrl: 'https://x/crop.jpg', cutoutUrl: 'https://x/cut.png' }, draft);
    expect(input).toMatchObject({ imageUrl: 'https://x/crop.jpg', cutoutUrl: 'https://x/cut.png', coverImageVariant: 'original' });
  });
  it('falls back to the cutout only when there is no crop', () => {
    const input = newItemInput('flow-test', { ...detection('d0'), cropUrl: null, cutoutUrl: 'https://x/cut.png' }, draft);
    expect(input.coverImageVariant).toBe('cutout');
  });
});

describe('a user crop', () => {
  const cropped = () => {
    const marked = reduce(reviewFixture([detection('d0', 'low', null)]), { type: 'markNew', detectionId: 'd0' }) as ReviewFlow;
    return reduce(marked, { type: 'editDraft', detectionId: 'd0', patch: { cropBbox: { x: 10, y: 20, width: 30, height: 40 } } }) as ReviewFlow;
  };

  it('is cut from the stored photo, uploaded, and becomes the cover without the scan cutout', async () => {
    batch.mockResolvedValue({ items: [closetItems[0]], rejected: [] });
    await saveWearLog(cropped());
    const { cropImage } = jest.requireMock('../../../lib/cropImage');
    expect(cropImage).toHaveBeenCalledWith('file:///outfit.jpg', { x: 10, y: 20, width: 30, height: 40 }, { maxDim: 1200, quality: 0.88 });
    expect(batch.mock.calls[0][0][0]).toMatchObject({ clientImportId: 'wear-flow-test-d0', imageUrl: 'https://r2.example/crop.jpg', cutoutUrl: null, coverImageVariant: 'original' });
  });

  it('fails the save instead of falling back when the crop cannot be made', async () => {
    const { cropImage } = jest.requireMock('../../../lib/cropImage');
    cropImage.mockResolvedValueOnce(null);
    await expect(saveWearLog(cropped())).rejects.toThrow('cropped photo');
    expect(batch).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('leaves uncropped pieces on the scan crop', () => {
    const d = { ...detection('d0'), cropUrl: 'https://scan/crop.jpg', cutoutUrl: 'https://scan/cut.webp' };
    expect(newItemInput('flow-test', d, draftFrom(d))).toMatchObject({ imageUrl: 'https://scan/crop.jpg', cutoutUrl: 'https://scan/cut.webp', coverImageVariant: 'original' });
  });
});
