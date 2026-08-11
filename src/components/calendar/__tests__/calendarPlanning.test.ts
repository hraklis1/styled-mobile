import { getEventItemsActionLabel, getEventPlanActionLabel } from '../calendarPlanning';

describe('calendar planning action labels', () => {
  it('uses one consistent AI action vocabulary', () => {
    expect(getEventPlanActionLabel(false)).toBe('Ask Styled to plan this event');
    expect(getEventPlanActionLabel(true)).toBe('Refine this look');
  });

  it('distinguishes manual item selection from AI planning', () => {
    expect(getEventItemsActionLabel(false)).toBe('Choose items');
    expect(getEventItemsActionLabel(true)).toBe('Edit items');
  });

  it('keeps the primary planning action distinct from the passive state', () => {
    expect(getEventPlanActionLabel(false)).not.toBe('Needs outfit');
    expect(getEventPlanActionLabel(true)).not.toBe('Outfit planned');
  });
});
