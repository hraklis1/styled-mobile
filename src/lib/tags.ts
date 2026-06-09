export function normalizeTag(s: string): string {
  return s.trim().toLowerCase().slice(0, 40);
}

export function dedupeTags(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    const n = normalizeTag(t);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
