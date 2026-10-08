import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as Haptics from '../../lib/haptics';

const ENTER_PRESS_WINDOW_MS = 700;

/**
 * Multi-select state for a closet list (pieces or outfits).
 *
 * `visible` is the list as currently filtered: Select all takes exactly what
 * is on screen, and ids a filter hides are dropped so the count never claims
 * pieces the user cannot see.
 */
export function useSelection<T extends { id: number }>(visible: readonly T[]) {
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState<Set<number>>(() => new Set());
  // A long-press enters with that card selected; a press the same touch may
  // still deliver must not toggle it straight back off. Scoped to that card
  // and a short window, since the press often never arrives.
  const enteredRef = useRef<{ id: number; at: number } | null>(null);

  const enter = useCallback((id?: number) => {
    enteredRef.current = id !== undefined ? { id, at: Date.now() } : null;
    if (id !== undefined) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActive(true);
    setIds(new Set(id !== undefined ? [id] : []));
  }, []);

  const toggle = useCallback((id: number) => {
    const entered = enteredRef.current;
    enteredRef.current = null;
    if (entered && entered.id === id && Date.now() - entered.at < ENTER_PRESS_WINDOW_MS) return;
    void Haptics.selectionAsync();
    setIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    void Haptics.selectionAsync();
    setIds(new Set(visible.map(entry => entry.id)));
  }, [visible]);

  const clear = useCallback(() => {
    void Haptics.selectionAsync();
    setIds(new Set());
  }, []);

  const exit = useCallback(() => {
    enteredRef.current = null;
    setActive(false);
    setIds(new Set());
  }, []);

  const visibleIds = useMemo(() => new Set(visible.map(entry => entry.id)), [visible]);
  useEffect(() => {
    setIds(prev => {
      let pruned: Set<number> | null = null;
      prev.forEach(id => {
        if (!visibleIds.has(id)) (pruned ??= new Set(prev)).delete(id);
      });
      return pruned ?? prev;
    });
  }, [visibleIds]);

  const isAllSelected = visible.length > 0 && ids.size === visible.length;
  const selected = useMemo(() => visible.filter(entry => ids.has(entry.id)), [visible, ids]);

  return { active, ids, selected, count: ids.size, isAllSelected, enter, toggle, selectAll, clear, exit };
}

export type Selection<T extends { id: number }> = ReturnType<typeof useSelection<T>>;
