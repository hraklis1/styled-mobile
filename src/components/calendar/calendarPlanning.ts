export function getEventPlanActionLabel(hasOutfit: boolean): 'Ask Styled to plan this event' | 'Refine this look' {
  return hasOutfit ? 'Refine this look' : 'Ask Styled to plan this event';
}

export function getEventItemsActionLabel(hasOutfit: boolean): 'Choose items' | 'Edit items' {
  return hasOutfit ? 'Edit items' : 'Choose items';
}
