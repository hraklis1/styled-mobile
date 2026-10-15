// Replies that just arrived over the wire get a choreographed entrance; threads
// loaded from history or the session cache appear instantly. The window is short
// so a card remounting later (tab switch, scroll recycling) doesn't replay it.
const FRESH_WINDOW_MS = 4000;
const arrivedAt = new Map<string, number>();

export function markMessageFresh(id: string) {
  arrivedAt.set(id, Date.now());
  if (arrivedAt.size > 50) arrivedAt.delete(arrivedAt.keys().next().value as string);
}

export function isMessageFresh(id: string): boolean {
  const at = arrivedAt.get(id);
  return at !== undefined && Date.now() - at < FRESH_WINDOW_MS;
}
