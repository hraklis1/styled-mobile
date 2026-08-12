import type { AxiosError } from 'axios';

// True only for connectivity failures (no response received).
// HTTP 4xx/5xx errors have a response and are NOT retryable.
export function isNetworkError(error: unknown): boolean {
  const err = error as AxiosError;
  return !!err?.isAxiosError && !err.response;
}
