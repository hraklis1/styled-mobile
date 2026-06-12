# Release Checklist

## Required Configuration

- Configure every value documented in `.env.example` for preview and production EAS environments.
- Confirm EAS `development`, `preview`, and `production` environments point to their matching hosted APIs. Preview and production must never use localhost.
- Publish working Privacy Policy, Terms, Support, and external account-deletion pages.
- Configure App Store Connect and Google Play submission credentials in EAS before running `eas submit`.
- Configure `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` before enabling Sentry source-map uploads.

## Google Calendar OAuth

- Enable the Google Calendar API in the production Google Cloud project.
- Publish the OAuth consent screen and approve the calendar scopes requested by the hosted API.
- Configure the hosted API's Google client ID, client secret, callback URL, and token-encryption secret.
- Register the exact `<APP_URL>/api/calendar/google/callback` URL in Google Cloud for every backend environment.
- Confirm the hosted API redirects mobile success to `styled://calendar?cal_connected=google`.
- Confirm failures redirect to `styled://calendar?cal_error=<stable-code>`.
- Verify `GET /api/calendar/google/mobile-token` returns a short-lived token only for authenticated users.
- Verify `/api/calendar/google/mobile-connect` consumes that token once, completes Google consent, and never exposes Google credentials to the app.

## Automated Gates

- Run `npm run check`.
- Run `npx expo-doctor`.
- Confirm the Native Smoke Builds workflow produces both iOS and Android preview builds.

## Physical Device Verification

- Complete email, Google, and Apple sign-in flows and verify sign-out/account switching clears prior user data.
- Verify camera, photo library, microphone, and location permission prompts and denied-permission recovery.
- Scan one item, batch scan multiple items, create an outfit, log an outfit, and generate an AI suggestion.
- Verify offline messaging, app restart behavior, password recovery deep links, and calendar connection callbacks.
- Using a brand-new user on physical iOS and Android devices, connect Google Calendar, import events, sync again, handle expired access, disconnect, and switch accounts.
- Purchase and restore a subscription using store sandbox accounts.
- Complete in-app account deletion and confirm the external deletion page works without reinstalling the app.
- Test VoiceOver and TalkBack, large text, reduced motion, and common phone screen sizes.
