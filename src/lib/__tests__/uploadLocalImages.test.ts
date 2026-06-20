const mockReadAsStringAsync = jest.fn();
const mockUploadImageToR2 = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

jest.mock('../uploadImage', () => ({
  uploadImageToR2: (...args: unknown[]) => mockUploadImageToR2(...args),
}));

import { uploadLocalImages } from '../uploadLocalImages';
import type { StoreFind } from '../../types/storeFind';

const find: StoreFind = {
  id: 'find-1',
  imageUrl: 'file:///find.jpg',
  imageUrls: ['file:///find.jpg'],
  location: null,
  description: null,
  store: null,
  brand: null,
  price: null,
  size: null,
  notes: null,
  createdAt: '2026-06-19T12:00:00.000Z',
};

describe('uploadLocalImages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('replaces local image URLs with uploaded URLs', async () => {
    mockReadAsStringAsync.mockResolvedValue('encoded-photo');
    mockUploadImageToR2.mockResolvedValue('https://images.example/find.jpg');

    await expect(uploadLocalImages(find, '1')).resolves.toMatchObject({
      imageUrl: 'https://images.example/find.jpg',
      imageUrls: ['https://images.example/find.jpg'],
    });
    expect(mockUploadImageToR2).toHaveBeenCalledWith('data:image/jpeg;base64,encoded-photo', '1');
  });

  it('surfaces upload errors so the queue can report and retry them', async () => {
    mockReadAsStringAsync.mockResolvedValue('encoded-photo');
    mockUploadImageToR2.mockRejectedValue(new Error('R2 upload failed: 403'));

    await expect(uploadLocalImages(find, '1')).rejects.toThrow('R2 upload failed: 403');
  });
});
