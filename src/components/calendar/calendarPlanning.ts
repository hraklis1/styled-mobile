export function getEventPlanActionLabel(hasOutfit: boolean): 'Plan my look' | 'Refine my look' {
  return hasOutfit ? 'Refine my look' : 'Plan my look';
}

export function getEventItemsActionLabel(hasOutfit: boolean): 'Choose items' | 'Edit items' {
  return hasOutfit ? 'Edit items' : 'Choose items';
}
