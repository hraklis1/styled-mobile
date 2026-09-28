import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { shoppingFeedbackQueue, type ShoppingFeedbackInput } from '../lib/shoppingFeedback';
import { api } from '../lib/api';
import { parseShoppingBrief } from '../lib/shopDecisionWorkspace';
import { track } from '../lib/analytics';

export function useShoppingFeedback() {
  const state = useSyncExternalStore(
    shoppingFeedbackQueue.subscribe,
    shoppingFeedbackQueue.getSnapshot,
  );
  const queryClient = useQueryClient();
  return {
    ...state,
    undo: shoppingFeedbackQueue.undo,
    dismiss: (input: ShoppingFeedbackInput) => {
      shoppingFeedbackQueue.enqueue(input, async (request, isCurrent) => {
        try {
          await queryClient.cancelQueries({
            queryKey: ['shop', 'brief', request.localDate],
            exact: true,
          });
          if (!isCurrent()) return;
          const { recommendationKey, localDate, feedbackReason } = request;
          const response = await api.post('/api/shop/brief/priorities/not-now', {
            recommendationKey,
            localDate,
            feedbackReason,
          });
          if (!isCurrent()) return;
          const brief = parseShoppingBrief(response.data);
          queryClient.setQueryData(['shop', 'brief', request.localDate], brief);
          track('shopping_brief_priority_not_now', { feedbackReason: request.feedbackReason });
        } catch (error) {
          if (isCurrent())
            AccessibilityInfo.announceForAccessibility(
              `Couldn’t hide ${request.label}. Please try again.`,
            );
          throw error;
        }
      });
      AccessibilityInfo.announceForAccessibility(
        'Suggestion hidden. Undo is available for eight seconds.',
      );
    },
  };
}
