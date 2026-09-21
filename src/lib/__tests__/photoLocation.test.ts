jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 'high', Balanced: 'balanced' },
}));

import * as Location from 'expo-location';
import { capturePhotoLocationData, extractGpsCoords } from '../photoLocation';

describe('photo location currency source', () => {
  it('extracts iOS EXIF coordinates with hemisphere signs', () => {
    expect(extractGpsCoords({
      '{GPS}': {
        Latitude: 43.65,
        LatitudeRef: 'N',
        Longitude: 79.38,
        LongitudeRef: 'W',
      },
    })).toEqual({ latitude: 43.65, longitude: -79.38 });
  });

  it('reverse geocodes uploaded-photo EXIF data without current-location permission', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValueOnce([{
      name: 'Yorkdale',
      street: 'Jane Street',
      city: 'Toronto',
      region: 'Ontario',
      isoCountryCode: 'CA',
      formattedAddress: 'Yorkdale, Toronto',
    }]);

    await expect(capturePhotoLocationData({
      GPSLatitude: 43.72,
      GPSLatitudeRef: 'N',
      GPSLongitude: 79.45,
      GPSLongitudeRef: 'W',
    }, false)).resolves.toMatchObject({
      latitude: 43.72,
      longitude: -79.45,
      countryCode: 'CA',
      locality: 'Toronto',
      branchLabel: 'Yorkdale',
    });
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('accepts EXIF rational strings and degree-minute-second arrays', () => {
    expect(extractGpsCoords({
      GPSLatitude: ['43/1', '39/1', '0/1'],
      GPSLatitudeRef: 'N',
      GPSLongitude: [79, 22, 48],
      GPSLongitudeRef: 'W',
    })).toEqual({ latitude: 43.65, longitude: -79.38 });
  });
});
