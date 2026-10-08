import { availabilityPatch, isAvailableNow } from '../availability';

describe('availability', () => {
  it('laundry lapses after three days, lent waits for the user', () => {
    const patch = availabilityPatch('laundry', new Date(2026, 9, 8, 9));
    expect(patch).toEqual({ availability: 'laundry', availabilityUntil: '2026-10-11' });
    expect(isAvailableNow(patch, '2026-10-11')).toBe(false);
    expect(isAvailableNow(patch, '2026-10-12')).toBe(true);
    expect(availabilityPatch('lent')).toEqual({ availability: 'lent', availabilityUntil: null });
    expect(isAvailableNow({ availability: 'lent', availabilityUntil: null }, '2030-01-01')).toBe(false);
    expect(isAvailableNow({}, '2026-10-08')).toBe(true);
  });
});
