import { createShoppingFeedbackQueue } from '../shoppingFeedback';

const input = {
  recommendationKey: 'trousers',
  localDate: '2026-09-28',
  feedbackReason: 'already_owned' as const,
  label: 'Tailored trousers',
};
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('undo prevents submission, including after screen subscribers leave', async () => {
  const queue = createShoppingFeedbackQueue();
  const commit = jest.fn().mockResolvedValue(undefined);
  const unsubscribe = queue.subscribe(jest.fn());
  queue.enqueue(input, commit);
  unsubscribe();
  const id = queue.getSnapshot().pending[0].id;
  await jest.advanceTimersByTimeAsync(7999);
  expect(commit).not.toHaveBeenCalled();
  queue.undo(id);
  await jest.advanceTimersByTimeAsync(1);
  expect(commit).not.toHaveBeenCalled();
  expect(queue.getSnapshot().pending).toEqual([]);
});

test('navigation does not cancel a dismissal and each request keeps its metadata', async () => {
  const queue = createShoppingFeedbackQueue();
  const commit = jest.fn().mockResolvedValue(undefined);
  queue.enqueue(input, commit);
  queue.enqueue(
    { ...input, recommendationKey: 'shoes', feedbackReason: 'not_my_style', label: 'Shoes' },
    commit,
  );
  await jest.advanceTimersByTimeAsync(8000);
  expect(commit).toHaveBeenNthCalledWith(1, input, expect.any(Function));
  expect(commit).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ recommendationKey: 'shoes', feedbackReason: 'not_my_style' }),
    expect.any(Function),
  );
  expect(queue.getSnapshot().pending).toHaveLength(0);
});

test('failed requests restore the recommendation and expose a readable error', async () => {
  const queue = createShoppingFeedbackQueue();
  queue.enqueue(input, jest.fn().mockRejectedValue(new Error('offline')));
  await jest.advanceTimersByTimeAsync(8000);
  expect(queue.getSnapshot().pending).toHaveLength(0);
  expect(queue.getSnapshot().error).toContain('Couldn’t hide Tailored trousers');
});

test('account changes cancel pending requests', async () => {
  const queue = createShoppingFeedbackQueue();
  const commit = jest.fn();
  queue.enqueue(input, commit);
  queue.clear();
  await jest.advanceTimersByTimeAsync(9000);
  expect(commit).not.toHaveBeenCalled();
});

test('serial commits keep a later response from racing the first', async () => {
  const queue = createShoppingFeedbackQueue();
  let finish!: () => void;
  const first = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const second = jest.fn().mockResolvedValue(undefined);
  queue.enqueue(input, first);
  queue.enqueue({ ...input, recommendationKey: 'shoes' }, second);
  await jest.advanceTimersByTimeAsync(8000);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
  finish();
  await jest.advanceTimersByTimeAsync(0);
  expect(second).toHaveBeenCalledTimes(1);
});
