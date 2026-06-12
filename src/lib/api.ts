import axios from 'axios';
import type { AxiosError } from 'axios';
import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error('Missing required EXPO_PUBLIC_API_URL configuration.');
}

const parsedApiUrl = new URL(API_URL);
if (!__DEV__ && ['localhost', '127.0.0.1', '10.0.2.2'].includes(parsedApiUrl.hostname)) {
  throw new Error('Released builds must use a hosted EXPO_PUBLIC_API_URL.');
}

export const API_BASE_URL = API_URL.replace(/\/+$/, '');

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Keep the active JWT in memory, refreshed via onAuthStateChange.
// This makes the request interceptor fully synchronous — no await, no risk of
// a hanging Supabase token-refresh call blocking every outgoing request.
let _accessToken: string | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}

supabase.auth.getSession().then(({ data: { session } }) => {
  _accessToken = session?.access_token ?? null;
});

supabase.auth.onAuthStateChange((_event, session) => {
  _accessToken = session?.access_token ?? null;
});

// Attach the active Supabase JWT so the backend can validate requests.
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
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
