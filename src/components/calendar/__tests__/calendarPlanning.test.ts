import { getEventItemsActionLabel, getEventPlanActionLabel } from '../calendarPlanning';

describe('calendar planning action labels', () => {
  it('uses one consistent AI action vocabulary', () => {
    expect(getEventPlanActionLabel(false)).toBe('Generate outfit');
    expect(getEventPlanActionLabel(true)).toBe('Generate another');
  });

  it('distinguishes manual item selection from AI planning', () => {
    expect(getEventItemsActionLabel(false)).toBe('Choose items');
    expect(getEventItemsActionLabel(true)).toBe('Edit items');
  });
});
