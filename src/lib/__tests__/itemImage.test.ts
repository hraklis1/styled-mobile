jest.mock('../api', () => ({
  API_BASE_URL: 'https://api.styled.test',
}));

import {
  hasCutout,
  itemCoverPresentation,
  itemImageUri,
  itemThumbUri,
} from '../itemImage';
import type { Item } from '../../types/item';

type ImageFields = Pick<
  Item,
  'imageUrl' | 'cutoutUrl' | 'polishedUrl' | 'thumbUrl' | 'coverImageVariant'
>;

const item = (patch: Partial<ImageFields> = {}): ImageFields => ({
  imageUrl: 'https://cdn.test/photo.jpg',
  cutoutUrl: 'https://cdn.test/cutout.webp',
  polishedUrl: null,
  thumbUrl: null,
  coverImageVariant: 'original',
  ...patch,
});

describe('item cover presentation', () => {
  it('keeps the original photo as the default when a cutout exists', () => {
    expect(itemCoverPresentation(item())).toEqual({
      uri: 'https://cdn.test/photo.jpg',
      variant: 'original',
      contentFit: 'cover',
      isCatalogStyle: false,
    });
  });

  it('uses a selected cutout with catalog presentation', () => {
    expect(itemCoverPresentation(item({ coverImageVariant: 'cutout' }))).toEqual({
      uri: 'https://cdn.test/cutout.webp',
      variant: 'cutout',
      contentFit: 'contain',
      isCatalogStyle: true,
    });
  });

  it('uses a selected AI polish without discarding the other assets', () => {
    const polished = item({
      polishedUrl: 'https://cdn.test/polished.webp',
      coverImageVariant: 'polished',
    });
    expect(itemImageUri(polished)).toBe('https://cdn.test/polished.webp');
    expect(polished.imageUrl).toBe('https://cdn.test/photo.jpg');
    expect(polished.cutoutUrl).toBe('https://cdn.test/cutout.webp');
  });

  it('falls back to the original when the selected derivative is unavailable', () => {
    expect(itemCoverPresentation(item({
      coverImageVariant: 'polished',
      polishedUrl: null,
    })).variant).toBe('original');
  });

  it('keeps polished legacy items visually stable during a rolling release', () => {
    const legacy = {
      imageUrl: 'https://cdn.test/photo.jpg',
      cutoutUrl: 'https://cdn.test/cutout.webp',
      polishedUrl: 'https://cdn.test/polished.webp',
    };
    expect(itemCoverPresentation(legacy).variant).toBe('polished');
  });

  it('does not treat an AI polish as a background-removed cutout asset', () => {
    expect(hasCutout(item({ cutoutUrl: null, polishedUrl: 'https://cdn.test/polished.webp' }))).toBe(false);
  });
});

describe('thumbnail preference', () => {
  it('prefers the thumbnail over the full photo when the variant is original', () => {
    const withThumb = item({ thumbUrl: 'https://cdn.test/thumb.webp' });
    expect(itemCoverPresentation(withThumb, { preferThumb: true }).uri)
      .toBe('https://cdn.test/thumb.webp');
    expect(itemThumbUri(withThumb)).toBe('https://cdn.test/thumb.webp');
  });

  it('falls back to the full photo when no thumbnail has been generated', () => {
    expect(itemThumbUri(item({ thumbUrl: null }))).toBe('https://cdn.test/photo.jpg');
  });

  it('does not substitute a thumbnail for a selected cutout or polish', () => {
    const cutoutSelected = item({
      thumbUrl: 'https://cdn.test/thumb.webp',
      coverImageVariant: 'cutout',
    });
    expect(itemThumbUri(cutoutSelected)).toBe('https://cdn.test/cutout.webp');
  });

  it('leaves itemImageUri (no preferThumb) using the full photo even when a thumbnail exists', () => {
    const withThumb = item({ thumbUrl: 'https://cdn.test/thumb.webp' });
    expect(itemImageUri(withThumb)).toBe('https://cdn.test/photo.jpg');
  });
});
