import type { StylistComposerAttachment } from './types';

export function appendStylistAttachment(current: StylistComposerAttachment | null, added: StylistComposerAttachment): StylistComposerAttachment {
  const items = [...(current?.items ?? (current?.itemId != null ? [{ itemId: current.itemId, label: current.label, uri: current.uri }] : [])), ...(added.items ?? (added.itemId != null ? [{ itemId: added.itemId, label: added.label, uri: added.uri }] : []))];
  const uniqueItems = items.filter((item, index) => items.findIndex(other => other.itemId === item.itemId) === index);
  const photos = [...(current?.photos ?? []), ...(added.photos ?? [])];
  return { type: 'items', label: `${uniqueItems.length + photos.length} attachments`, items: uniqueItems, photos };
}
