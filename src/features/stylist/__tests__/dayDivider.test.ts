import { dayDividerLabel, dayDividers } from '../dayDivider';

// Fixed reference point: Wed 2026-09-23, 10:00 local.
const NOW = new Date(2026, 8, 23, 10, 0).getTime();
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();

describe('dayDividerLabel', () => {
  it('names today and yesterday in words', () => {
    expect(dayDividerLabel(at(2026, 8, 23, 1), NOW)).toBe('Today');
    expect(dayDividerLabel(at(2026, 8, 22), NOW)).toBe('Yesterday');
  });

  it('uses the weekday within the past week', () => {
    expect(dayDividerLabel(at(2026, 8, 20), NOW)).toBe('Sunday');
  });

  it('falls back to a date once the weekday stops being unambiguous', () => {
    expect(dayDividerLabel(at(2026, 8, 10), NOW)).not.toMatch(/day$/);
    expect(dayDividerLabel(at(2026, 8, 10), NOW)).toContain('10');
  });

  it('adds the year for a different year', () => {
    expect(dayDividerLabel(at(2025, 8, 10), NOW)).toContain('2025');
  });
});

describe('dayDividers', () => {
  it('draws nothing for a thread that started today', () => {
    const dividers = dayDividers(
      [{ id: 'a', createdAt: at(2026, 8, 23, 9) }, { id: 'b' }],
      NOW,
    );
    expect(dividers.size).toBe(0);
  });

  it('leads a resumed thread with the day it started on', () => {
    const dividers = dayDividers([{ id: 'a', createdAt: at(2026, 8, 22) }], NOW);
    expect(dividers.get('a')).toBe('Yesterday');
  });

  it('marks each day change once, not every message', () => {
    const dividers = dayDividers(
      [
        { id: 'a', createdAt: at(2026, 8, 21) },
        { id: 'b', createdAt: at(2026, 8, 21, 14) },
        { id: 'c', createdAt: at(2026, 8, 22) },
      ],
      NOW,
    );
    expect([...dividers.keys()]).toEqual(['a', 'c']);
  });

  it('files messages sent in this session under today', () => {
    const dividers = dayDividers(
      [{ id: 'old', createdAt: at(2026, 8, 20) }, { id: 'live' }],
      NOW,
    );
    expect(dividers.get('old')).toBe('Sunday');
    expect(dividers.get('live')).toBe('Today');
  });

  it('keeps a late-night message on its own local day', () => {
    const dividers = dayDividers(
      [
        { id: 'late', createdAt: at(2026, 8, 21, 23) },
        { id: 'next', createdAt: at(2026, 8, 22, 0) },
      ],
      NOW,
    );
    expect([...dividers.keys()]).toEqual(['late', 'next']);
  });
});
