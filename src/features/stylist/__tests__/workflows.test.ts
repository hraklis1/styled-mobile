import {
  formatLocalCalendarDate,
  parseLocalCalendarDate,
  summarizeStylistWorkflow,
  validateStylistWorkflow,
  workflowMode,
} from '../workflows';
import type { Item } from '../../../types/item';

const item = { id: 42, name: 'Navy Sweater' } as Item;

describe('stylist workflows', () => {
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
