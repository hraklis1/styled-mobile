import { DISMISS_BACKOFF_MS, mayAsk, promptCompleteness, remainingPrompts } from '../gate';
import type { Profile } from '../../../types/profile';

const base = { id: 1, userId: 1, onboardingComplete: true } as unknown as Profile;
const now = Date.parse('2026-10-09T12:00:00Z');

describe('profile prompt gate', () => {
  it('asks open questions and skips answered ones, however they were answered', () => {
    expect(mayAsk('budget', base, now)).toBe(true);
    expect(mayAsk('budget', { ...base, budgetRange: ['premium'] } as Profile, now)).toBe(false);
  });

  it('backs off after a dismissal, then asks again', () => {
    const dismissed = (at: number, count = 1) =>
      ({ ...base, profilePrompts: { budget: { shownAt: null, answeredAt: null, dismissCount: count, dismissedAt: new Date(at).toISOString() } } }) as unknown as Profile;
    expect(mayAsk('budget', dismissed(now - 1000), now)).toBe(false);
    expect(mayAsk('budget', dismissed(now - DISMISS_BACKOFF_MS - 1000), now)).toBe(true);
    expect(mayAsk('budget', dismissed(now - DISMISS_BACKOFF_MS - 1000, 2), now)).toBe(false);
  });

  it('never re-asks something marked answered', () => {
    const p = { ...base, profilePrompts: { fit: { shownAt: null, dismissedAt: null, dismissCount: 0, answeredAt: '2026-10-01T00:00:00Z' } } } as unknown as Profile;
    expect(mayAsk('fit', p, now)).toBe(false);
  });

  it('counts completeness over the five deferred questions', () => {
    expect(remainingPrompts(base)).toHaveLength(5);
    const p = { ...base, budgetRange: ['premium'], sizeTop: 'M', sizeShoe: '10' } as unknown as Profile;
    expect(remainingPrompts(p)).toEqual(['fit', 'avoids', 'retailers']);
    expect(promptCompleteness(p)).toBeCloseTo(0.4);
  });
});
