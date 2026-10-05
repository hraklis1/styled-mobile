import { createContext, useCallback, useContext, useState, type Dispatch, type SetStateAction } from 'react';

export type StylistCardState = Record<string, unknown>;
export const StylistCardStateContext = createContext<StylistCardState | null>(null);

/** Retain local outfit edits and saved ids when iOS unmounts a dismissed chat modal. */
export function useStylistCardState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const cache = useContext(StylistCardStateContext);
  const [value, setValue] = useState<T>(() => cache && key in cache ? cache[key] as T : initial);
  const update = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValue(previous => {
      const resolved = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
      if (cache) cache[key] = resolved;
      return resolved;
    });
  }, [cache, key]);
  return [value, update];
}
