import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ITEMS_QUERY_KEY } from '../../../hooks/useItems';
import { resolveImageUri } from '../../../lib/resolveImageUri';
import type { Item } from '../../../types/item';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import { useEntitlement } from '../../../hooks/useEntitlement';
import { ensureEntitled } from '../../../lib/entitlementGate';
import { track } from '../../../lib/analytics';

export type PolishChoice = ReturnType<typeof usePolishChoice>;

/**
 * Whether the pieces being added get a polished cover once they're saved.
 * One switch for the batch, seeded from the user's last choice, with
 * per-piece overrides from the piece sheet. Nothing is spent here: the
 * polishes are queued after the save lands.
 */
export function usePolishChoice() {
  const { isPremium, credits, costOf } = useEntitlement();
  const { prefs, setPrefs } = useAppPreferences();
  const [all, setAll] = useState<boolean | null>(null);
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(() => new Map());

  // Non-premium always starts off; the remembered choice only applies to those who can use it.
  const polishAll = isPremium && (all ?? prefs.polishOnImport);

  const isPolished = useCallback(
    (id: string) => isPremium && (overrides.get(id) ?? polishAll),
    [isPremium, overrides, polishAll],
  );

  const setAllAndRemember = useCallback(async (next: boolean) => {
    if (next && !(await ensureEntitled(isPremium, {
      title: 'Polish your photos',
      message: 'Studio-quality covers for every piece are part of Premium.',
    }))) return;
    setAll(next);
    setOverrides(new Map());
    if (next !== prefs.polishOnImport) setPrefs({ polishOnImport: next });
    track('scan_review_polish_toggled', { scope: 'all', enabled: next });
  }, [isPremium, prefs.polishOnImport, setPrefs]);

  const setPiece = useCallback((id: string, next: boolean) => {
    setOverrides((current) => new Map(current).set(id, next));
    track('scan_review_polish_toggled', { scope: 'piece', enabled: next });
  }, []);

  // A before/after from the user's own closet: the most convincing sample there is.
  const queryClient = useQueryClient();
  const example = useMemo(() => {
    const items = queryClient.getQueryData<Item[]>(ITEMS_QUERY_KEY) ?? [];
    const item = items.find((candidate) => candidate.polishedUrl && candidate.imageUrl);
    const before = resolveImageUri(item?.imageUrl);
    const after = resolveImageUri(item?.polishedUrl);
    return item && before && after ? { name: item.name, before, after } : null;
  }, [queryClient]);

  const costPerPiece = costOf('polish');
  const costFor = (count: number) => costPerPiece * count;

  return {
    isPremium,
    polishAll,
    isPolished,
    setAll: setAllAndRemember,
    setPiece,
    costPerPiece,
    example,
    costFor,
    /** null while the profile hasn't loaded: never block on an unknown balance. */
    balance: credits?.total ?? null,
  };
}
