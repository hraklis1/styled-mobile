import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type RevealPiece = { slot: 'outer' | 'top' | 'bottom' | 'shoes' | 'accent'; name: string };
export type Reveal = {
  styleRead: string;
  look: { title: string; pieces: RevealPiece[]; note: string };
  source: 'generated' | 'fallback';
};

/**
 * The closing screen's content. Fetched once the profile has saved — the
 * server reads the answers from it — so `enabled` is the caller's "saved"
 * flag. Never retried: the server already answers with a fallback rather
 * than failing slowly, so a client error means the network, and the screen
 * renders without the look rather than waiting.
 */
export function useRevealQuery(
  enabled: boolean,
  weather: { temperatureC?: number | null; condition?: string | null } | undefined,
) {
  return useQuery<Reveal, Error>({
    queryKey: ['onboarding', 'reveal'],
    enabled,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    queryFn: () =>
      api
        .post<Reveal>('/api/onboarding/reveal', {
          temperatureC: weather?.temperatureC ?? null,
          condition: weather?.condition ?? null,
        })
        .then((r) => r.data),
  });
}
