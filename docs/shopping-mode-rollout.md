# Shopping Mode: rollout and verification

Implemented September 16, 2026. Changes are uncommitted on `main` in the mobile and sibling `Styled` repositories.

## Delivered

- Original-currency purchase details, editable corrections separate from raw OCR, price suggestions, product links and cover selection.
- Account-scoped metadata, capture queues, ordered idempotent mutations, conflict choices, and immediate local editing/decisions/grouping. Unsynced originals stay outside the bounded 250 MB per-account preview cache.
- Persistent “Add photo to this piece” mode, capture-ID-based automatic tag attachment with undo, optional store identification, and immediate visit completion.
- Pieces/Visits shortlist, search, Favorites, category/store/date/decision/currency-specific price filters, newest/oldest sorting, item selection and comparison.
- Considering/Bought/Passed labels with legacy storage compatibility. Optional wardrobe handoff retains form drafts, uses the existing item-create entitlement path, copies a garment image into wardrobe storage and enforces one source find per user.
- Shopping/stylist context carries original currencies. Comparison remains usable without AI. Shopping analytics use event counts/outcomes, excluding photos, OCR, notes and precise location.

## Deployment order

Do not ship the updated backend against its old database schema: ORM item reads include the new columns.

1. Apply outstanding Supabase shopping migrations in filename order, including the existing catalog and visit-lifecycle migrations. The review environment currently lacks the older capture-group catalog columns. Finish with `supabase/migrations/202609160001_shopping_decisions.sql`.
2. Apply `../Styled/migrations/20260916_shopping_wardrobe.sql` to the backend items database. The partial unique index is also represented in the Drizzle schema.
3. Deploy the backend changes, then the mobile client. Keep the legacy status values (`wishlist`, `closet`) readable during rollout.

Neither shared database migration nor a remote deployment was performed during this implementation. The simulator can read legacy shopping photos through its compatibility fallback; remote mutation replay and live wardrobe creation require the migrations. Running the updated local backend against the unmigrated items database currently returns missing-column errors for item reads and the shopping brief.

Local persistence migrates without dropping queued photographs. Existing unscoped capture data is assigned once to the first authenticated account; subsequent accounts have independent persistence keys. Interrupted OCR is marked incomplete for review rather than keeping an upload blocked forever. Missing originals stay visible as actionable failures rather than silently disappearing from the queue.

## Verification performed

- Full mobile check: TypeScript, ESLint, 55 suites / 419 tests passed before the final wardrobe-draft regression was added. Final targeted shopping checks: 14 suites / 147 tests passed, including that regression.
- Backend `npm run check -- --incremental false` passed.
- Disposable PostgreSQL-compatible database tests passed for authenticated ownership, operation replay, independent field edits, same-field conflicts, atomic regrouping/rollback, grouping conflict resolution, cover ownership, price validation, per-user wardrobe uniqueness and independent wardrobe lifecycle. Run `node scripts/test-shopping-mutations.mjs /path/to/@electric-sql/pglite/dist/index.js`; no app credentials or live database are used.
- A fresh `npm run ios` build succeeded, installed and launched on iPhone 17 / iOS 26.5. Raw Xcode output reported `BUILD SUCCEEDED`; the formatter emitted two misleading “exit code 0” error lines from the Expo bridge build.
- Simulator walkthrough: populated and empty shortlist, first photograph row visible on initial load, store search (19 pieces narrowed to 3 Zara pieces), search preserved between Pieces and Visits, two-piece comparison without AI, purchase editor and multiple OCR price suggestions, camera-unavailable Library action, Camera Close restoring dark status-bar text, and labeled Shop entry points ahead of the brief.
- Accessibility inspection confirmed named controls; this is not a full VoiceOver usability test.

## Native build fixes

RevenueCat packages were updated together to 10.3.0, which includes the iOS 5.78 compatibility fix. A narrowly scoped `patch-package` patch for `expo-modules-jsi@56.0.10` replaces a conditional C callback expression with direct function references accepted by the installed Swift compiler. The patch contains source only, applies through the existing postinstall hook, and was verified against the installed module.

Sources: [Expo SDK 56](https://docs.expo.dev/versions/v56.0.0/), [RevenueCat React Native 10.3.0](https://github.com/RevenueCat/react-native-purchases/releases/tag/10.3.0), [RevenueCat iOS 5.78.0](https://github.com/RevenueCat/purchases-ios/releases/tag/5.78.0).

## Release validation still required

After migrations, run a full authenticated capture → offline edit → restart → reconnect → regroup → Bought → wardrobe handoff walkthrough. Include two-device conflicts, partial upload failures and repeated wardrobe requests. The isolated tests cover the underlying rules, but live storage/entitlement integration has not been exercised against the migrated services.

On a physical phone, verify repeated garment/tag capture, low light, autofocus, OCR accuracy, denied location, airplane mode and background/resume. Use realistic garment/tag fixtures, long labels, maximum text sizes, reduced motion and VoiceOver. Existing simulator sample photos include scenery and are insufficient to certify real garment-cropping quality.

Price tracking, retailer matching, conversion, reminders and a broader saved-stylist redesign remain outside this change.
