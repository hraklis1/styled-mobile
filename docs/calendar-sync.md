# Calendar sync

Calendar access is read-only. Styled does not create, change, or delete source-calendar events.

## Connections

- Google uses the existing hosted OAuth flow with `calendar.readonly`. Users choose primary, secondary, and shared calendars. All pages of results are fetched, and recurring events are expanded by Google.
- Outlook uses Microsoft authorization-code OAuth with PKCE and delegated `Calendars.Read` plus `offline_access`. Personal Microsoft accounts and Microsoft 365 accounts use the `common` tenant. Configure `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and `APP_URL` on the backend; register the web callback `<APP_URL>/api/calendar/outlook/callback`. Tenant policies can require administrator consent.
- Device calendars use the SDK 56 `expo-calendar` shared-object API. Permission is requested only when users choose this connection. Users choose calendars exposed by iOS/Android, including private iCloud and configured Outlook accounts. The OS supplies expanded recurring occurrences. Each installation has its own connection identity; other devices cannot submit its snapshots through the UI. Do not select the same calendar in both a direct cloud connection and a device connection.
- Calendar feeds accept secure HTTPS/webcal links. URLs stay on the server. Fetches use the existing public-host/redirect checks, a timeout, and a 5 MB limit. `node-ical` handles named time zones, DST, recurrence exceptions, and overrides. Extremely frequent recurrence rules are rejected instead of producing unbounded snapshots.

The OS may grant broader calendar permission than Styled uses. The implementation only calls read APIs.

## Sync behavior

Selecting calendars and saving performs the first sync. Automatic syncing is enabled by default; users can choose manual syncing instead. An empty selection imports nothing and does not delete existing imports.

Cloud connections poll every 15 minutes while the backend instance is running. The mobile app catches up on launch/foreground and every five minutes while active. Device calendars can only refresh while Styled runs on the connected device. These are periodic snapshots, not provider push subscriptions. Cloud Run CPU suspension/scale-to-zero can delay cloud polling; foreground catch-up remains available. Always-on processing or an external authenticated scheduler is needed for guaranteed syncing while every app/server instance is asleep.

Snapshots cover the past 30 days and next 365 days. Pagination finishes before reconciliation. A failed provider request never reconciles a partial snapshot. Requests serialize per user/provider using PostgreSQL advisory locks, and reconciliation commits atomically.

Source titles, dates, locations, descriptions, and cancellation state follow the source. Occasion, environment, personal styling notes, item selections, outfit, and board associations stay in Styled. Source-owned fields display read-only in the edit form. Source descriptions live in calendar metadata, separate from personal notes.

Cancellations/missing occurrences inside the selected snapshot window are hidden from active event lists without deleting their rows or outfit associations. A source event that reappears restores its existing row. Moving an event out of the snapshot window hides its previous in-window representation. Deleting an imported event in Styled records an ignore entry so the next sync does not recreate it. Disconnect keeps imported events and plans.

Legacy Google and feed connections are adopted. Existing Google imports retain the primary-calendar alias; brand-new Google connections wait for calendar selection. Previously imported feed instances are adopted by UID and start date so an outfit is not attached to a different recurrence.

## Development and release

Backend migrations: `../Styled/migrations/0069_calendar_sync.sql` and `0070_calendar_oauth.sql`, applied using the backend's guarded `scripts/apply-migration.ts`. They add connection/ignore tables, nullable event metadata, and durable, hashed, expiring OAuth tokens. Apply these additive migrations before deploying the backend changes to other environments. No production deployment is part of this change.

Native dependency: `expo-calendar`, with calendar usage descriptions in app.json. Expo core/worklets build from source to match the React Native debug ABI and avoid stale precompiled binaries. A new native build is required; this is not a JavaScript-only update. Launch local iOS with `npm run ios`.

Validation:

- Mobile: all 1,095 tests pass, alongside typecheck and lint. Calendar tests cover save/retry, empty selection, denied/revoked permission, unavailable calendars, recurrence identity, existing Google OAuth, and event presentation.
- Backend: typecheck and `tsx --env-file=.env scripts/test-calendar-sync.ts`. The integration test refuses production and rolls back its temporary account and event changes. It checks pagination, failed snapshots, DST/overrides, all-day dates, updates, cancellation/restoration, duplicate prevention, planning preservation, ignore entries, and deselection.
- Live Google/Microsoft consent and physical Android calendar behavior require device/account verification before release. OAuth state and mobile tokens are stored as hashed, expiring, single-use PostgreSQL records, so sign-in can complete across backend instances and restarts.

Simulator walkthrough: the rebuilt iOS app launches; Calendar → tools → Calendars & sync opens after native menu dismissal; the overview and feed form were inspected; invalid feed submission retained its draft; denying calendar permission displayed recovery guidance. The iOS `styled` URL scheme is explicitly registered alongside Google sign-in so calendar callbacks return to the app. Live source-account consent was not granted during this walkthrough.
