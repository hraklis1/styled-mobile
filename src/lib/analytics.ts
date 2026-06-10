import PostHog from 'posthog-react-native';
import type { PostHogEventProperties } from '@posthog/core';

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';

export const posthog = new PostHog(API_KEY, {
  host: 'https://us.i.posthog.com',
  disabled: !API_KEY,
  flushAt: 20,
  flushInterval: 30_000,
});

export function track(event: string, properties?: PostHogEventProperties): void {
  posthog.capture(event, properties);
}

export function identify(userId: string, traits?: PostHogEventProperties): void {
  posthog.identify(userId, traits);
}

export function reset(): void {
  posthog.reset();
}
