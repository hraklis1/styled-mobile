import axios from 'axios';
import type { AxiosError } from 'axios';
import { supabase } from './supabase';
import { queryClient } from './queryClient';
export { isNetworkError } from './networkError';
export { apiErrorCode, apiErrorMessage, retryAfterMs, type ApiError, type ApiErrorBody } from './apiErrors';
import type { ApiErrorBody } from './apiErrors';

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

// One refresh shared by every request that hits a 401 at the same moment (the
// app fires several on resume), so a burst doesn't stampede the auth server.
let refreshing: Promise<string | null> | null = null;
function refreshAccessToken(): Promise<string | null> {
  refreshing ??= supabase.auth
    .refreshSession()
    .then(({ data }) => {
      _accessToken = data.session?.access_token ?? null;
      return _accessToken;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status;

    // An access token can expire while the app is backgrounded or mid-batch
    // before auto-refresh catches up. Refresh once and replay the request;
    // a second 401 is real and falls through to the caller.
    const config = error.config as (typeof error.config & { _authRetried?: boolean }) | undefined;
    if (status === 401 && config && !config._authRetried) {
      config._authRetried = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return api.request(config);
      }
    }

    const url = error.config?.url;
    console.warn(`[API] ${status ?? 'NETWORK_ERR'} ${url}`, error.message);

    // 402 (insufficient credits / free-limit reached) and 403 (premium
    // required) both mean the client's idea of its own entitlement is stale —
    // invalidate so the next read reflects what the server actually enforced,
    // rather than the UI continuing to offer an action it just refused.
    //
    // Deliberately does NOT present a paywall or alert here: this interceptor
    // fires on background refetches too, and popping UI from a request the
    // user didn't initiate would be jarring and untraceable to what caused
    // it. Surfacing the gate is each call site's job — see
    // src/lib/entitlementGate.ts for the premium case, and read
    // apiErrorCode()/apiErrorMessage() in an onError handler for credits.
    if (status === 402 || status === 403) {
      queryClient.invalidateQueries({ queryKey: ['profile'] }).catch(() => {});
    }

    return Promise.reject(error);
  }
);
