import { focusedPriority, previewTarget, priorityIdentity } from '../shopFocusedEdit';
import type { ShoppingBriefPriority } from '../shopDecisionWorkspace';
import type { ShoppingPriorityTarget } from '../shoppingPriorityEdit';

const first: ShoppingBriefPriority = { label: 'Leather shoes', category: 'shoes', context: 'With tailoring', priority: 1, reason: 'wardrobe_gap', unlocks: [], recommendationKey: 'shoes' };
const second = { ...first, label: 'Trousers', priority: 2, recommendationKey: 'trousers' };
test('ranking chooses the default, explicit selection persists, and a stale selection falls back', () => {
  expect(focusedPriority([second, first], null)).toBe(first);
  expect(focusedPriority([first, second], priorityIdentity(second))).toBe(second);
  expect(focusedPriority([first], priorityIdentity(second))).toBe(first);
  expect(focusedPriority([], priorityIdentity(first))).toBeUndefined();
});
test('the preview uses the first suitable style in server order and skips unavailable stock', () => {
  const targets = [
    { key: 'a', offers: [{ inStock: false }], offerState: { status: 'ready' } },
    { key: 'b', offers: [{ inStock: null }], offerState: { status: 'ready' } },
    { key: 'c', offers: [{ inStock: true }], offerState: { status: 'ready' } },
  ] as unknown as ShoppingPriorityTarget[];
  expect(previewTarget(targets)).toBe(targets[1]);
  expect(previewTarget([])).toBeUndefined();
});
test('pending and empty results retain a defined wardrobe direction', () => {
  const targets = [{ key: 'empty', offers: [], offerState: { status: 'empty' } }, { key: 'pending', offers: [], offerState: { status: 'pending' } }] as unknown as ShoppingPriorityTarget[];
  expect(previewTarget(targets)).toBe(targets[1]);
  expect(previewTarget([targets[0]])).toBe(targets[0]);
});
