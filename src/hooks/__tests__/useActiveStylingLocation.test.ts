import { conversationLocation, resolveStylingLocation } from '../../lib/stylingLocation';

describe('resolveStylingLocation', () => {
  const device = {
    label: 'Paris, France',
    coords: { lat: 48.8566, lon: 2.3522 },
  };

  it('uses current device location while traveling', () => {
    expect(resolveStylingLocation('London, Ontario, CA', device, 'granted')).toEqual({
      source: 'current',
      label: device.label,
      coords: device.coords,
      isFallback: false,
    });
  });

  it('falls back to home when current location is unavailable', () => {
    const result = resolveStylingLocation('London, Ontario, CA', undefined, 'denied');
    expect(result.source).toBe('home');
    expect(result.label).toBe('London, Ontario, CA');
    expect(result.isFallback).toBe(true);
  });

  it('returns setup guidance when neither current nor home is available', () => {
    expect(resolveStylingLocation(undefined, undefined, 'denied')).toMatchObject({
      source: 'current',
      isFallback: true,
    });
  });

  it('creates a conversation-only destination context', () => {
    expect(conversationLocation(' Tokyo, Japan ')).toEqual({
      source: 'conversation',
      label: 'Tokyo, Japan',
      isFallback: false,
    });
  });
});
