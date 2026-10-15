import {
  formatLocalCalendarDate,
  parseLocalCalendarDate,
  summarizeStylistWorkflow,
  tripSpanLabel,
  validateStylistWorkflow,
  workflowMode,
} from '../workflows';
import type { Item } from '../../../types/item';

const item = { id: 42, name: 'Navy Sweater' } as Item;

describe('stylist workflows', () => {
  it('labels a trip span with nights', () => {
    expect(tripSpanLabel('2026-11-12', '2026-11-18')).toEqual({ range: 'Thu 12 Nov → Wed 18 Nov', nights: '6 nights' });
    expect(tripSpanLabel('2026-11-12', '2026-11-13')?.nights).toBe('1 night');
    expect(tripSpanLabel('2026-11-12', '2026-11-12')?.nights).toBe('Day trip');
    expect(tripSpanLabel('2026-10-30', '2026-11-02')?.nights).toBe('3 nights');
    expect(tripSpanLabel('2026-11-12', '')).toEqual({ range: 'Thu 12 Nov', nights: null });
    expect(tripSpanLabel('', '2026-11-12')).toBeNull();
  });

  it('keeps calendar dates in local calendar space', () => {
    const date = new Date(2026, 11, 31, 23, 30);
    expect(formatLocalCalendarDate(date)).toBe('2026-12-31');
    expect(parseLocalCalendarDate('2026-12-31')?.getDate()).toBe(31);
    expect(parseLocalCalendarDate('2026-02-31')).toBeNull();
  });

  it('validates required workflow fields and trip ordering', () => {
    expect(validateStylistWorkflow({ kind: 'occasion', plan: ' ' }, [item])).toMatch(/plan/i);
    expect(validateStylistWorkflow({ kind: 'style_piece', itemId: 99 }, [item])).toMatch(/choose/i);
    expect(validateStylistWorkflow({
      kind: 'trip',
      destination: 'Tokyo',
      startDate: '2026-09-10',
      endDate: '2026-09-09',
    }, [item])).toMatch(/return date/i);
  });

  it('maps workflows to deterministic modes', () => {
    expect(workflowMode({ kind: 'wardrobe_audit' })).toBe('wardrobe_audit');
    expect(workflowMode({ kind: 'style_piece', itemId: 42 })).toBe('from_closet');
    expect(workflowMode({ kind: 'wardrobe_build', lifestyle: ['travel'] })).toBe('shop_list');
  });

  it('builds compact natural summaries without meta-prompts', () => {
    expect(summarizeStylistWorkflow({
      kind: 'style_piece',
      itemId: 42,
      occasion: 'dinner',
      direction: 'More polished',
    }, [item])).toBe('Build a look around Navy Sweater — dinner · More polished.');
  });
});
