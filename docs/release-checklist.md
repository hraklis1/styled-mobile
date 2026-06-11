# Release Checklist

## Required Configuration

- Configure every value documented in `.env.example` for preview and production EAS environments.
- Publish working Privacy Policy, Terms, Support, and external account-deletion pages.
- Configure App Store Connect and Google Play submission credentials in EAS before running `eas submit`.
- Configure `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` before enabling Sentry source-map uploads.

## Automated Gates

- Run `npm run check`.
- Run `npx expo-doctor`.
- Confirm the Native Smoke Builds workflow produces both iOS and Android preview builds.

## Physical Device Verification

- Complete email, Google, and Apple sign-in flows and verify sign-out/account switching clears prior user data.
- Verify camera, photo library, microphone, and location permission prompts and denied-permission recovery.
- Scan one item, batch scan multiple items, create an outfit, log an outfit, and generate an AI suggestion.
- Verify offline messaging, app restart behavior, password recovery deep links, and calendar connection callbacks.
- Purchase and restore a subscription using store sandbox accounts.
- Complete in-app account deletion and confirm the external deletion page works without reinstalling the app.
- Test VoiceOver and TalkBack, large text, reduced motion, and common phone screen sizes.
