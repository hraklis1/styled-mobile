import {
  buildGoogleCalendarConnectUrl,
  connectGoogleCalendar,
  getGoogleCalendarApiErrorCode,
  GOOGLE_CALENDAR_CALLBACK_URI,
  parseGoogleCalendarCallback,
} from '../googleCalendarAuth';

describe('Google Calendar auth callback parsing', () => {
  it('recognizes a successful Google connection', () => {
    expect(
      parseGoogleCalendarCallback('styled://calendar?cal_connected=google'),
    ).toEqual({ status: 'connected' });
  });

  it.each([
    'access_denied',
    'not_configured',
    'state_mismatch',
    'token_exchange_failed',
    'token_exchange',
    'missing_refresh_token',
    'no_token',
    'no_code',
  ])('recognizes the stable error code %s', (code) => {
    expect(parseGoogleCalendarCallback(`styled://calendar?cal_error=${code}`)).toEqual({
      status: 'failed',
      code,
    });
  });

  it('decodes callback parameters without exposing arbitrary server errors', () => {
    expect(
      parseGoogleCalendarCallback('styled://calendar?cal_error=access%5Fdenied'),
    ).toEqual({ status: 'failed', code: 'access_denied' });
    expect(
      parseGoogleCalendarCallback('styled://calendar?cal_error=sensitive-server-detail'),
    ).toEqual({ status: 'failed', code: 'unknown' });
  });

  it('rejects malformed and unexpected callbacks', () => {
    expect(parseGoogleCalendarCallback('not a callback')).toEqual({
      status: 'failed',
      code: 'invalid_callback',
    });
    expect(parseGoogleCalendarCallback('styled://calendar-auth?cal_connected=google')).toEqual({
      status: 'failed',
      code: 'invalid_callback',
    });
  });
});

describe('Google Calendar connection flow', () => {
  const makeDependencies = () => ({
    apiBaseUrl: 'https://api.styled.test',
    getMobileToken: jest.fn().mockResolvedValue('short lived token'),
    openAuthSession: jest.fn().mockResolvedValue({
      type: 'success',
      url: 'styled://calendar?cal_connected=google',
    }),
    verifyConnection: jest.fn().mockResolvedValue(true),
  });

  it('uses the explicit callback and verifies the server connection', async () => {
    const dependencies = makeDependencies();

    await expect(connectGoogleCalendar(dependencies)).resolves.toEqual({ status: 'connected' });

    expect(dependencies.openAuthSession).toHaveBeenCalledWith(
      'https://api.styled.test/api/calendar/google/mobile-connect?token=short+lived+token',
      GOOGLE_CALENDAR_CALLBACK_URI,
    );
    expect(dependencies.verifyConnection).toHaveBeenCalledTimes(1);
  });

  it.each(['cancel', 'dismiss'])('handles browser %s without verifying', async (type) => {
    const dependencies = makeDependencies();
    dependencies.openAuthSession.mockResolvedValue({ type, url: '' });

    await expect(connectGoogleCalendar(dependencies)).resolves.toEqual({
      status: 'cancelled',
      reason: type,
    });
    expect(dependencies.verifyConnection).not.toHaveBeenCalled();
  });

  it('returns callback failures without verifying', async () => {
    const dependencies = makeDependencies();
    dependencies.openAuthSession.mockResolvedValue({
      type: 'success',
      url: 'styled://calendar?cal_error=state_mismatch',
    });

    await expect(connectGoogleCalendar(dependencies)).resolves.toEqual({
      status: 'failed',
      code: 'state_mismatch',
    });
    expect(dependencies.verifyConnection).not.toHaveBeenCalled();
  });

  it('fails when the server does not confirm the connection', async () => {
    const dependencies = makeDependencies();
    dependencies.verifyConnection.mockResolvedValue(false);

    await expect(connectGoogleCalendar(dependencies)).resolves.toEqual({
      status: 'failed',
      code: 'connection_not_verified',
    });
  });

  it('maps API startup failures to actionable codes', async () => {
    const dependencies = makeDependencies();
    dependencies.getMobileToken.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    await expect(connectGoogleCalendar(dependencies)).resolves.toEqual({
      status: 'failed',
      code: 'session_expired',
    });
  });
});

describe('Google Calendar connection utilities', () => {
  it('builds a safely encoded mobile connection URL', () => {
    expect(buildGoogleCalendarConnectUrl('https://api.styled.test/', 'a&b=c')).toBe(
      'https://api.styled.test/api/calendar/google/mobile-connect?token=a%26b%3Dc',
    );
  });

  it('distinguishes unreachable, authenticated, configured, and server failures', () => {
    expect(getGoogleCalendarApiErrorCode({ isAxiosError: true })).toBe('api_unreachable');
    expect(
      getGoogleCalendarApiErrorCode({ isAxiosError: true, response: { status: 403 } }),
    ).toBe('session_expired');
    expect(
      getGoogleCalendarApiErrorCode({
        isAxiosError: true,
        response: { status: 400, data: { code: 'not_configured' } },
      }),
    ).toBe('not_configured');
    expect(
      getGoogleCalendarApiErrorCode({ isAxiosError: true, response: { status: 503 } }),
    ).toBe('server_error');
  });
});
