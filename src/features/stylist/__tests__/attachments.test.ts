import { appendStylistAttachment } from '../attachments';

it('accumulates closet pieces and photos without duplicate closet items', () => {
  const first = { type: 'item' as const, label: 'Jacket', itemId: 1 };
  let attachment = appendStylistAttachment(first, { type: 'item', label: 'Shirt', itemId: 2 });
  attachment = appendStylistAttachment(attachment, first);
  attachment = appendStylistAttachment(attachment, { type: 'photo', label: 'Photo', photos: [{ uri: 'file:///photo', dataUrl: 'data:image/jpeg;base64,abc' }] });
  expect(attachment.items?.map(item => item.itemId)).toEqual([1, 2]);
  expect(attachment.photos).toHaveLength(1);
});
