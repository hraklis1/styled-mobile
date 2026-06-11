jest.mock('../api', () => ({
  API_BASE_URL: 'https://api.styled.test',
}));

import { resolveImageUri } from '../resolveImageUri';

describe('resolveImageUri', () => {
  it('resolves server-relative images against the configured API', () => {
    expect(resolveImageUri('/images/item.webp')).toBe(
      'https://api.styled.test/images/item.webp',
    );
  });

  it('preserves absolute and local image URLs', () => {
    expect(resolveImageUri('https://cdn.test/item.webp')).toBe('https://cdn.test/item.webp');
    expect(resolveImageUri('file:///tmp/item.webp')).toBe('file:///tmp/item.webp');
  });

  it('converts raw base64 to a JPEG data URL', () => {
    expect(resolveImageUri('abc123')).toBe('data:image/jpeg;base64,abc123');
  });
});
