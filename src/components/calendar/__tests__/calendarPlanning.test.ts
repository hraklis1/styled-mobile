import { getEventItemsActionLabel, getEventPlanActionLabel } from '../calendarPlanning';

describe('calendar planning action labels', () => {
  it('uses one consistent AI action vocabulary', () => {
    expect(getEventPlanActionLabel(false)).toBe('Plan outfit');
    expect(getEventPlanActionLabel(true)).toBe('Try another outfit');
  });

  it('distinguishes manual item selection from AI planning', () => {
    expect(getEventItemsActionLabel(false)).toBe('Choose items');
    expect(getEventItemsActionLabel(true)).toBe('Change items');
  });
});
