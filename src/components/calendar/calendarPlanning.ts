export function getEventPlanActionLabel(hasOutfit: boolean): 'Generate outfit' | 'Generate another' {
  return hasOutfit ? 'Generate another' : 'Generate outfit';
}

export function getEventItemsActionLabel(hasOutfit: boolean): 'Choose items' | 'Edit items' {
  return hasOutfit ? 'Edit items' : 'Choose items';
}
