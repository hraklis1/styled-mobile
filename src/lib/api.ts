import axios from 'axios';
import type { AxiosError } from 'axios';
import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the active Supabase JWT so the backend can validate requests.
// No-op when the user is signed out.
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url;
    console.warn(`[API] ${status ?? 'NETWORK_ERR'} ${url}`, error.message);
    return Promise.reject(error);
  }
);

// True only for connectivity failures (no response received).
// HTTP 4xx/5xx errors have a response and are NOT retryable.
export function isNetworkError(error: unknown): boolean {
  const err = error as AxiosError;
  return !!err?.isAxiosError && !err.response;
}
