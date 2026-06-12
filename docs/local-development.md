# Local Development

## Mobile API URLs

`EXPO_PUBLIC_API_URL` is compiled into the mobile app and must be reachable from the device running it.

- iOS simulator: `http://localhost:<port>` reaches the Mac.
- Android emulator: use `http://10.0.2.2:<port>` to reach the Mac.
- Physical iOS or Android device: use a hosted HTTPS API or a LAN URL reachable from the phone.
- EAS preview and production builds: always use a hosted HTTPS API configured in the matching EAS environment.

Restart Metro and rebuild the app after changing an `EXPO_PUBLIC_*` variable.

## Local API Startup

`npm run ios` checks `EXPO_PUBLIC_API_URL` before launching Expo. When it points
to localhost and the API is not reachable, the pre-launch script starts the
sibling `../Styled` backend and waits for it to become ready. Backend output is
written to `/tmp/styled-api-<port>.log`.

If the backend is stored elsewhere, set `STYLED_BACKEND_DIR` to its absolute
path before running `npm run ios`.

## Google Calendar Mobile OAuth Contract

The mobile app requests `GET /api/calendar/google/mobile-token`, then opens
`/api/calendar/google/mobile-connect?token=<short-lived-token>` in an auth session.
The hosted API owns Google OAuth credentials and token storage.

Google exchanges its authorization code with the hosted API, not with the mobile
deep link. The Google Cloud OAuth client's authorized redirect URI must exactly
match:

`<APP_URL>/api/calendar/google/callback`

For the current local mobile setup, the backend runs with
`APP_URL=http://localhost:3001`, so Google Cloud must include:

`http://localhost:3001/api/calendar/google/callback`

Changing the backend port or `APP_URL` requires adding the new exact callback URI
in Google Cloud Console. A missing URI causes Google's `Error 400:
redirect_uri_mismatch` before the app receives a callback.

The hosted API must finish by redirecting to one of:

- `styled://calendar?cal_connected=google`
- `styled://calendar?cal_error=<stable-code>`

Supported stable error codes are `access_denied`, `not_configured`, `state_mismatch`,
`token_exchange`, `token_exchange_failed`, `missing_refresh_token`, `no_token`, and
`no_code`.
