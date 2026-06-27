import { mapWithConcurrency } from '../asyncPool';

describe('mapWithConcurrency', () => {
  it('caps concurrent work and preserves settled result order', async () => {
    let active = 0;
    let maxActive = 0;

    const settled = await mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      if (item === 3) throw new Error('boom');
      return item * 10;
    });

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(settled.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
    ]);
    expect(settled[5]).toEqual({ status: 'fulfilled', value: 50 });
  });
});
