export function getEventPlanActionLabel(hasOutfit: boolean): 'Plan outfit' | 'Try another outfit' {
  return hasOutfit ? 'Try another outfit' : 'Plan outfit';
}

export function getEventItemsActionLabel(hasOutfit: boolean): 'Choose items' | 'Change items' {
  return hasOutfit ? 'Change items' : 'Choose items';
}
