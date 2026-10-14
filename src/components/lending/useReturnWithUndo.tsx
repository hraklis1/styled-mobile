import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UndoToast } from '../primitives/UndoToast';
import { useReopenLoans, useReturnItems } from '../../hooks/useLendContacts';
import * as Haptics from '../../lib/haptics';
import { spacing } from '../../theme';

const UNDO_MS = 7000;

/**
 * "Returned" with no confirm in front of it: the loans close at once and a
 * "Returned · Undo" bar offers to reopen them (same loan, dates and person
 * intact) for a few seconds. Render `toast` last in the screen.
 */
export function useReturnWithUndo({ bottomOffset = 0 }: { bottomOffset?: number } = {}) {
  const insets = useSafeAreaInsets();
  const returnItems = useReturnItems();
  const reopen = useReopenLoans();
  const [last, setLast] = useState<{ itemIds: number[]; message: string } | null>(null);

  useEffect(() => {
    if (!last) return;
    const timeout = setTimeout(() => setLast(null), UNDO_MS);
    return () => clearTimeout(timeout);
  }, [last]);

  const markReturned = useCallback((itemIds: number[], label: string) => {
    if (!itemIds.length) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    returnItems.mutate(itemIds);
    setLast({ itemIds, message: `${label} returned` });
  }, [returnItems]);

  const undo = useCallback(() => {
    if (!last) return;
    void Haptics.selectionAsync();
    setLast(null);
    reopen.mutate(last.itemIds);
  }, [last, reopen]);

  const toast = last ? (
    <UndoToast message={last.message} onUndo={undo} bottom={insets.bottom + spacing.lg + bottomOffset} />
  ) : null;

  return { markReturned, toast };
}
