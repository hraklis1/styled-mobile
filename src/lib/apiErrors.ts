import type { AxiosError } from 'axios';

// Pure helpers over the server's error responses. Kept apart from api.ts so
// they can be imported (and tested) without creating the axios client.

/**
 * The server's structured error shape for gated/metered routes — see
 * server/metering/index.ts's refusal responses and the various
 * `PREMIUM_REQUIRED` / `CAPACITY` checks elsewhere. Not every 4xx/5xx uses
 * this shape (plain validation errors just send `message`), so `code` is
 * optional even though it's populated for anything callers actually branch on.
 */
export interface ApiErrorBody {
  message: string;
  code?:
    | 'PREMIUM_REQUIRED'
    | 'INSUFFICIENT_CREDITS'
    | 'RATE_LIMITED'
    | 'FREE_LIMIT_REACHED'
    | 'CAPACITY'
    | string;
  meta?: {
    required?: number;
    balance?: number;
    retryAfterMs?: number;
    used?: number;
    current?: number;
    limit?: number;
  };
}

/** Typed view over an Axios error carrying one of the shapes above. */
export type ApiError = AxiosError<ApiErrorBody>;

export function apiErrorCode(error: unknown): string | undefined {
  return (error as ApiError)?.response?.data?.code;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  return (error as ApiError)?.response?.data?.message ?? fallback;
}

/** Milliseconds to wait before retrying a 429, from Retry-After or the body's meta. */
export function retryAfterMs(error: unknown): number | undefined {
  const err = error as ApiError;
  const header = err?.response?.headers?.['retry-after'];
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }
  return err?.response?.data?.meta?.retryAfterMs;
}
