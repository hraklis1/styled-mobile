import { useCallback, useRef } from 'react';
import type { NavigationProp } from '@react-navigation/native';
import { useGlobalAIStylist, type StylistOpenSource } from '../../contexts/GlobalAIStylistContext';
import { shoppingPriorityFromDailyLookGap } from '../../lib/dailyLookPresentation';
import type { AppTabParamList } from '../../navigation/types';
import type { StylistMissingEssential } from '../../features/stylist/types';
import type { Event } from '../../types/event';
import { eventDayKey } from './calendarAgenda';

type TabNavigation = Pick<NavigationProp<AppTabParamList>, 'navigate'>;

/**
 * Opens the stylist in event-planning mode for one event. Shared by Calendar
 * and Home so both hand off the same brief, context and return routes.
 * `delayMs` lets a dismissing sheet finish before the stylist presents.
 */
export function useEventStylistHandoff(navigation: TabNavigation) {
  const { openStylist } = useGlobalAIStylist();
  const lastHandoffAt = useRef(0);

  return useCallback((event: Event, source: StylistOpenSource, delayMs = 0) => {
    const now = Date.now();
    if (now - lastHandoffAt.current < 600) return;
    lastHandoffAt.current = now;
    const details = [
      `Dress me for "${event.title}"`,
      `on ${new Date(`${eventDayKey(event)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      event.occasion ? `for a ${event.occasion.replaceAll('_', ' ')} occasion` : null,
      event.location ? `at ${event.location}` : null,
      event.environment ? `in a ${event.environment} setting` : null,
    ].filter(Boolean).join(' ');
    setTimeout(() => {
      openStylist({
        initialQuery: `${details}.`,
        destination: event.location ?? undefined,
        initialMode: 'event_plan',
        source,
        eventContext: { id: event.id, title: event.title },
        onNavigateToCloset: (outfitId) => navigation.navigate('Closet', {
          screen: 'OutfitDetail',
          params: {
            outfitId,
            returnTo: 'Calendar',
            returnToEventId: event.id,
            returnToEventDetail: true,
          },
        }),
        onNavigateToShop: (gap?: StylistMissingEssential) => {
          if (!gap?.label) return;
          navigation.navigate('Shop', { screen: 'ShoppingPriorityEdit', params: {
            priority: shoppingPriorityFromDailyLookGap(gap),
          }});
        },
        context: {
          kind: 'event',
          eventId: event.id,
          title: event.title,
          date: event.date,
          location: event.location,
          occasion: event.occasion,
          environment: event.environment,
          itemIds: event.itemIds ?? undefined,
        },
      });
    }, delayMs);
  }, [navigation, openStylist]);
}
