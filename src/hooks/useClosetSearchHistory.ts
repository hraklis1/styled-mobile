import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addRecentSearch, normalizeSearch } from '../lib/closet-search';

type Section = 'pieces' | 'outfits' | 'boards';
const memory = new Map<string, string[]>();
const writes = new Map<string, Promise<void>>();
function persist(key: string, values: string[]) {
  const write = (writes.get(key) ?? Promise.resolve()).then(() => AsyncStorage.setItem(key, JSON.stringify(values))).catch(() => {});
  writes.set(key, write);
  void write.then(() => { if (writes.get(key) === write) writes.delete(key); });
}
export function useClosetSearchHistory(account: string | null, section: Section) {
  const key = account ? `styled:closet:search:v1:${account}:${section}` : null;
  const [loaded, setLoaded] = useState<{ key: string | null; values: string[] }>({ key: null, values: [] });
  useEffect(() => {
    let active = true;
    if (!key) return;
    if (memory.has(key)) { setLoaded({ key, values: memory.get(key)! }); return; }
    void AsyncStorage.getItem(key).then(raw => {
      let values: string[] = [];
      try {
        const parsed: unknown = JSON.parse(raw ?? '[]');
        if (Array.isArray(parsed)) values = parsed.filter((v): v is string => typeof v === 'string').reverse().reduce(addRecentSearch, [] as string[]);
      } catch { /* Invalid history is an empty history. */ }
      if (!memory.has(key)) memory.set(key, values);
      if (active) setLoaded({ key, values: memory.get(key)! });
    }).catch(() => { if (active) setLoaded({ key, values: memory.get(key) ?? [] }); });
    return () => { active = false; };
  }, [key]);
  const values = key ? memory.get(key) ?? (loaded.key === key ? loaded.values : []) : [];
  function save(next: string[]) {
    if (!key) return;
    memory.set(key, next);
    setLoaded({ key, values: next });
    persist(key, next);
  }
  return { recent: values, record: (query: string) => { if (normalizeSearch(query)) save(addRecentSearch(key ? memory.get(key) ?? values : [], query)); }, clear: () => save([]) };
}
