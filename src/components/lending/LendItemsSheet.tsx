import { useQueryClient } from '@tanstack/react-query';

import { LendSheet } from './LendSheet';
import { LEND_CONTACTS_QUERY_KEY, useLendItems } from '../../hooks/useLendContacts';
import { itemThumbUri } from '../../lib/itemImage';
import type { LendContact } from '../../lib/lending';
import * as Haptics from '../../lib/haptics';
import type { Item } from '../../types/item';

/**
 * Lend a set of pieces (a closet selection, an outfit) to one person in one
 * go. Pieces already out move to the new person and keep their lent date.
 * `onLent` gets a ready-made confirmation line ("3 pieces lent to Maya").
 */
export function LendItemsSheet({ items, onClose, onLent }: {
  /** null = closed. */
  items: Item[] | null;
  onClose: () => void;
  onLent?: (message: string) => void;
}) {
  const qc = useQueryClient();
  const lendItems = useLendItems();

  const confirm = (contactId: number | null, dueBack: string | null) => {
    if (!items?.length) return;
    const name = contactId == null ? null
      : qc.getQueryData<LendContact[]>(LEND_CONTACTS_QUERY_KEY)?.find((c) => c.id === contactId)?.name ?? null;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lendItems.mutate({ itemIds: items.map((i) => i.id), contactId, dueBack });
    const what = items.length === 1 ? items[0].name : `${items.length} pieces`;
    onClose();
    onLent?.(name ? `${what} lent to ${name}` : `${what} marked as lent`);
  };

  return (
    <LendSheet
      visible={!!items?.length}
      items={(items ?? []).map((i) => ({ name: i.name, uri: itemThumbUri(i) }))}
      onClose={onClose}
      onConfirm={confirm}
    />
  );
}
