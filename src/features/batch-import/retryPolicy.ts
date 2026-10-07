import { apiErrorCode, apiErrorMessage, retryAfterMs } from '../../lib/apiErrors';
import type { BlockReason } from './types';

/** Automatic attempts per job before it waits for the user's Retry. */
export const MAX_AUTO_ATTEMPTS = 3;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 15_000;
const DEFAULT_RATE_LIMIT_DELAY_MS = 5_000;

export type RetryDecision =
  /** Try again after `delayMs`. `countsAttempt` is false for waits the server asked for. */
  | { kind: 'retry'; delayMs: number; countsAttempt: boolean }
  /** Give up on this job; the user can retry it by hand. */
  | { kind: 'fail'; message: string }
  /** Stop the whole queue — retrying would be refused the same way. */
  | { kind: 'block'; reason: BlockReason; message: string };

function httpStatus(error: unknown): number | null {
  const err = error as { response?: { status?: number }; status?: unknown };
  if (typeof err?.response?.status === 'number') return err.response.status;
  // Native file uploads report the status on the error they are wrapped in.
  if (typeof err?.status === 'number') return err.status;
  return null;
}

/** 2s, 4s, 8s… capped, with ±25% jitter so a batch's retries don't land together. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1), MAX_DELAY_MS);
  return Math.round(base * (0.75 + random() * 0.5));
}

/**
 * Decide what to do with a failed request.
 *
 * `attempts` is how many attempts have been made INCLUDING the one that just
 * failed. Every retry reuses the job's idempotency key, which is what makes
 * retrying a paid scan safe: the server replays the first result (or at least
 * never charges twice) instead of running it again.
 */
export function classifyError(
  error: unknown,
  attempts: number,
  random: () => number = Math.random,
): RetryDecision {
  const status = httpStatus(error);

  if (status === 402) {
    const code = apiErrorCode(error);
    return {
      kind: 'block',
      reason: code === 'FREE_LIMIT_REACHED' ? 'free_limit' : 'credits',
      message: apiErrorMessage(error, "You're out of Studio credits."),
    };
  }

  // A per-user daily spend cap doesn't lift in seconds; retrying would spin.
  if (status === 429 && apiErrorCode(error) === 'DAILY_LIMIT') {
    return { kind: 'fail', message: apiErrorMessage(error, "You've reached today's limit. Try again tomorrow.") };
  }

  // The api client already refreshed the session and replayed once; a 401
  // here means the session is gone. Fail without burning retries — the user's
  // work stays in the queue for a hand retry after signing back in.
  if (status === 401) {
    return { kind: 'fail', message: 'Your session expired. Sign in again, then tap Retry.' };
  }

  if (status === 429) {
    return {
      kind: 'retry',
      delayMs: retryAfterMs(error) ?? DEFAULT_RATE_LIMIT_DELAY_MS,
      countsAttempt: false,
    };
  }

  // No status: a dropped connection, a timeout, or a local failure (file
  // read, image decode). 408 and every 5xx — including the budget breaker's
  // 503 CAPACITY — are transient by definition.
  const transient = status == null || status === 408 || status >= 500;
  if (transient) {
    if (attempts < MAX_AUTO_ATTEMPTS) {
      return { kind: 'retry', delayMs: backoffDelay(attempts, random), countsAttempt: true };
    }
    return {
      kind: 'fail',
      message: status == null
        ? "Couldn't reach Styled. Check your connection."
        : apiErrorMessage(error, 'The service is busy right now.'),
    };
  }

  // Any other 4xx is about this request; sending it again changes nothing.
  return { kind: 'fail', message: apiErrorMessage(error, 'This photo could not be processed.') };
}

export class GaveUp extends Error {
  constructor(readonly decision: Exclude<RetryDecision, { kind: 'retry' }>) {
    super(decision.message);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run `fn`, retrying per the batch retry policy; throws GaveUp when it stops. */
export async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  let attempts = 0;
  for (;;) {
    attempts += 1;
    try {
      return await fn();
    } catch (error) {
      const decision = classifyError(error, attempts);
      if (decision.kind !== 'retry') throw new GaveUp(decision);
      if (!decision.countsAttempt) attempts -= 1;
      await sleep(decision.delayMs);
    }
  }
}
