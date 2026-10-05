import type { ShoppingBriefPriority } from './shopDecisionWorkspace';
import type { ShoppingPriorityTarget } from './shoppingPriorityEdit';

export function priorityIdentity(priority: ShoppingBriefPriority): string {
  return priority.recommendationKey ?? priority.candidateKey ?? `${priority.category}:${priority.label}`;
}

export function focusedPriority(priorities: ShoppingBriefPriority[], selectedKey: string | null) {
  return priorities.find(priority => priorityIdentity(priority) === selectedKey)
    ?? [...priorities].sort((a, b) => a.priority - b.priority)[0];
}

export function previewTarget(targets: ShoppingPriorityTarget[]) {
  return targets.find(target => target.offers?.some(offer => offer.inStock !== false))
    ?? targets.find(target => target.offerState?.status === 'pending')
    ?? targets[0];
}
