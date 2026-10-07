import { COLOR_HEX_MAP, getSwatchColor, toNormalizedColor } from '../colorUtils';

describe('colour names', () => {
  it('prefers the longest name, so olive green is olive rather than green', () => {
    expect(getSwatchColor('olive green').primary).toBe(COLOR_HEX_MAP['olive green']);
    expect(getSwatchColor('Olive Green').primary).not.toBe(COLOR_HEX_MAP.green);
    expect(getSwatchColor('dark navy').primary).toBe(COLOR_HEX_MAP.navy);
  });

  it('maps free text onto the palette', () => {
    expect(toNormalizedColor('olive green')).toBe('olive');
    expect(toNormalizedColor('Light Grey')).toBe('grey');
    expect(toNormalizedColor('light blue')).toBe('light-blue');
    expect(toNormalizedColor('navy')).toBe('navy');
    expect(toNormalizedColor('navy/white stripe')).toBe('multi');
    expect(toNormalizedColor('periwinkle')).toBeNull();
    expect(toNormalizedColor('')).toBeNull();
  });
});
