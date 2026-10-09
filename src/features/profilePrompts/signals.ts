import type { ProfilePromptKey } from '../../types/profile';

/**
 * In-context triggers for the deferred questions. Screens report what the
 * user just did; once a threshold is crossed the matching question is
 * offered. Counts live on the device — they only pace the asking, so losing
 * them on reinstall costs nothing.
 */

export type PromptSignal = 'shop_opened' | 'stylist_message' | 'product_hidden';

/** Signal → [question, the count at which it's first offered]. */
const TRIGGERS: Record<PromptSignal, Array<[ProfilePromptKey, number]>> = {
  // Budget on the first Shop visit, sizes on the second, shops on the third.
  shop_opened: [['budget', 1], ['sizes', 2], ['retailers', 3]],
  stylist_message: [['fit', 5]],
  product_hidden: [['avoids', 2]],
};

const STORAGE_KEY = 'profile_prompt_counters';
// Required lazily: this module is imported by shared code (productFeedback)
// whose tests have no AsyncStorage native module.
const storage = () =>
  require('@react-native-async-storage/async-storage').default as typeof import('@react-native-async-storage/async-storage').default;
let counts: Partial<Record<PromptSignal, number>> | null = null;
const listeners = new Set<(keys: ProfilePromptKey[]) => void>();

async function load() {
  if (counts) return counts;
  try {
    counts = JSON.parse((await storage().getItem(STORAGE_KEY)) ?? '{}');
  } catch {
    counts = {};
  }
  return counts!;
}

/** Report an action. Listeners get every question whose threshold is now met. */
export async function recordPromptSignal(signal: PromptSignal): Promise<void> {
  const c = await load();
  const n = (c[signal] ?? 0) + 1;
  c[signal] = n;
  try {
    void storage().setItem(STORAGE_KEY, JSON.stringify(c)).catch(() => {});
  } catch {
    // Counting is best-effort pacing; never let it break the caller.
  }
  const due = TRIGGERS[signal].filter(([, at]) => n >= at).map(([key]) => key);
  if (due.length) listeners.forEach((l) => l(due));
}

export function onPromptsDue(listener: (keys: ProfilePromptKey[]) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
