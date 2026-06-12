import type { AxiosError } from 'axios';

export const GOOGLE_CALENDAR_CALLBACK_URI = 'styled://calendar';

export type GoogleCalendarConnectionResult =
  | { status: 'connected' }
  | { status: 'cancelled'; reason: 'cancel' | 'dismiss' | 'unknown' }
  | { status: 'failed'; code: string };

type AuthSessionResult =
  | { type: 'success'; url: string }
  | { type: string };

type ConnectionDependencies = {
  getMobileToken: () => Promise<string>;
  openAuthSession: (url: string, redirectUrl: string) => Promise<AuthSessionResult>;
  verifyConnection: () => Promise<boolean>;
  apiBaseUrl: string;
};

const KNOWN_CALLBACK_ERRORS = new Set([
  'access_denied',
  'not_configured',
  'state_mismatch',
  'token_exchange_failed',
  'token_exchange',
  'missing_refresh_token',
  'no_token',
  'no_code',
]);

export const GOOGLE_CALENDAR_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You denied access to Google Calendar.',
  not_configured: 'Google Calendar is not configured for this app.',
  state_mismatch: 'The connection attempt expired. Please try again.',
  token_exchange_failed: 'Google could not complete the connection. Please try again.',
  token_exchange:
    'Google could not exchange the authorization code. Verify the hosted API callback URL in Google Cloud, then try again.',
  missing_refresh_token:
    'Google did not grant long-term calendar access. Remove Styled from your Google account permissions, then try again.',
  no_token: 'The connection request was missing its one-time token. Please try again.',
  no_code: 'Google did not return an authorization code. Please try again.',
  connection_not_verified: 'Google returned successfully, but the connection could not be verified. Please try again.',
  api_unreachable: 'Styled could not reach the calendar service. Check your connection and try again.',
  session_expired: 'Your Styled session expired. Sign in again, then connect Google Calendar.',
  server_error: 'The calendar service is temporarily unavailable. Please try again later.',
  invalid_callback: 'Google returned an invalid response. Please try again.',
  unknown: 'Could not connect Google Calendar. Please try again.',
};

export function buildGoogleCalendarConnectUrl(apiBaseUrl: string, token: string): string {
  const url = new URL('/api/calendar/google/mobile-connect', apiBaseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export function parseGoogleCalendarCallback(urlValue: string): GoogleCalendarConnectionResult {
  try {
    const url = new URL(urlValue);
    if (url.protocol !== 'styled:' || url.hostname !== 'calendar') {
      return { status: 'failed', code: 'invalid_callback' };
    }

    if (url.searchParams.get('cal_connected') === 'google') {
      return { status: 'connected' };
    }

    const callbackCode = url.searchParams.get('cal_error');
    return {
      status: 'failed',
      code: callbackCode && KNOWN_CALLBACK_ERRORS.has(callbackCode) ? callbackCode : 'unknown',
    };
  } catch {
    return { status: 'failed', code: 'invalid_callback' };
  }
}

export function getGoogleCalendarApiErrorCode(error: unknown): string {
  const axiosError = error as AxiosError<{ code?: string }>;
  const serverCode = axiosError.response?.data?.code;
  if (serverCode && KNOWN_CALLBACK_ERRORS.has(serverCode)) return serverCode;
  if (axiosError.isAxiosError && !axiosError.response) return 'api_unreachable';
  if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
    return 'session_expired';
  }
  if (axiosError.response?.status && axiosError.response.status >= 500) return 'server_error';
  return 'unknown';
}

export async function connectGoogleCalendar(
  dependencies: ConnectionDependencies,
): Promise<GoogleCalendarConnectionResult> {
  try {
    const token = await dependencies.getMobileToken();
    const connectUrl = buildGoogleCalendarConnectUrl(dependencies.apiBaseUrl, token);
    const authResult = await dependencies.openAuthSession(
      connectUrl,
      GOOGLE_CALENDAR_CALLBACK_URI,
    );

    if (authResult.type !== 'success' || !('url' in authResult)) {
      const reason =
        authResult.type === 'cancel' || authResult.type === 'dismiss'
          ? authResult.type
          : 'unknown';
      return { status: 'cancelled', reason };
    }

    const callbackResult = parseGoogleCalendarCallback(authResult.url);
    if (callbackResult.status !== 'connected') return callbackResult;

    const connected = await dependencies.verifyConnection();
    return connected
      ? { status: 'connected' }
      : { status: 'failed', code: 'connection_not_verified' };
  } catch (error) {
    return { status: 'failed', code: getGoogleCalendarApiErrorCode(error) };
  }
}
