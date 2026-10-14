import { Share } from 'react-native';

import { localYmd } from '../../lib/lending';
import { nudgeMessage } from '../../lib/loanReminders';
import * as Haptics from '../../lib/haptics';

/**
 * Opens the share sheet with a ready-to-send reminder for whoever has these
 * pieces. The person picks Messages, WhatsApp or anything else there; the app
 * needs no Contacts access and sends nothing itself.
 */
export async function remindPerson(contactName: string | null, items: { name: string; dueBack?: string | null }[]) {
  if (!items.length) return;
  void Haptics.selectionAsync();
  try {
    await Share.share({ message: nudgeMessage(contactName, items, localYmd()) });
  } catch {
    // Dismissed or unavailable: nothing to do.
  }
}
