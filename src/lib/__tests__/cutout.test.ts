const mockPost = jest.fn();

jest.mock('../api', () => ({
  api: { post: (...args: unknown[]) => mockPost(...args) },
}));

jest.mock('../uploadImage', () => ({
  isDataUri: (value: string) => value.startsWith('data:'),
  uploadImageToR2: jest.fn(),
}));

import { requestCutout } from '../cutout';

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue({ data: { cutoutWebP: 'encoded-webp', detectionSource: 'sam3' } });
});

describe('requestCutout', () => {
  it('forwards the known item metadata used to target one garment', async () => {
    const result = await requestCutout({
      imageDataUrl: 'data:image/jpeg;base64,source',
      name: 'Lightweight Athletic Pants',
      category: 'bottom',
      subcategory: 'Trousers',
      style: 'Chinos',
      color: 'Dusty Blue',
    });

    expect(result).toBe('data:image/webp;base64,encoded-webp');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/api/cutout');
    expect(mockPost.mock.calls[0][1]).toMatchObject({
      name: 'Lightweight Athletic Pants',
      category: 'bottom',
      subcategory: 'Trousers',
      style: 'Chinos',
      color: 'Dusty Blue',
    });
  });
});
