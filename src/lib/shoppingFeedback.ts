export const shoppingFeedbackOptions = [
  { id: 'not_interested', title: 'Not interested' },
  { id: 'already_owned', title: 'I already own something similar' },
  { id: 'not_my_style', title: 'Not my style' },
  { id: 'too_expensive', title: 'Too expensive' },
  { id: 'not_relevant_now', title: 'Not relevant right now' },
] as const;
export type ShoppingFeedbackReason = (typeof shoppingFeedbackOptions)[number]['id'];
export type ShoppingFeedbackInput = {
  recommendationKey: string;
  localDate: string;
  feedbackReason: ShoppingFeedbackReason;
  label: string;
};
type Pending = ShoppingFeedbackInput & { id: string; submitting: boolean };
type Snapshot = { pending: Pending[]; error: string | null };

/** Screen-independent undo windows. Serial commits prevent responses resurrecting another dismissal. */
export function createShoppingFeedbackQueue() {
  let snapshot: Snapshot = { pending: [], error: null };
  let generation = 0;
  let tail = Promise.resolve();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const remove = (id: string) => {
    snapshot = { ...snapshot, pending: snapshot.pending.filter((entry) => entry.id !== id) };
    emit();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    enqueue(
      input: ShoppingFeedbackInput,
      commit: (input: ShoppingFeedbackInput, isCurrent: () => boolean) => Promise<void>,
    ) {
      const id = `${input.localDate}:${input.recommendationKey}`;
      if (snapshot.pending.some((entry) => entry.id === id)) return;
      const epoch = generation;
      snapshot = {
        pending: [...snapshot.pending, { ...input, id, submitting: false }],
        error: null,
      };
      emit();
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          snapshot = {
            ...snapshot,
            pending: snapshot.pending.map((entry) =>
              entry.id === id ? { ...entry, submitting: true } : entry,
            ),
          };
          emit();
          tail = tail.then(async () => {
            if (epoch !== generation) return;
            try {
              await commit(input, () => epoch === generation);
            } catch {
              if (epoch === generation)
                snapshot = {
                  ...snapshot,
                  error: `Couldn’t hide ${input.label}. Please try again.`,
                };
            } finally {
              if (epoch === generation) remove(id);
            }
          });
        }, 8000),
      );
    },
    undo(id: string) {
      if (!timers.has(id)) return;
      clearTimeout(timers.get(id));
      timers.delete(id);
      remove(id);
    },
    clear() {
      generation += 1;
      tail = Promise.resolve();
      timers.forEach(clearTimeout);
      timers.clear();
      snapshot = { pending: [], error: null };
      emit();
    },
  };
}
export const shoppingFeedbackQueue = createShoppingFeedbackQueue();
