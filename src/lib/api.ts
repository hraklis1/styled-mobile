import axios from 'axios';
import type { AxiosError } from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// True only for connectivity failures (no response received).
// HTTP 4xx/5xx errors have a response and are NOT retryable.
export function isNetworkError(error: unknown): boolean {
  const err = error as AxiosError;
  return !!err?.isAxiosError && !err.response;
}
