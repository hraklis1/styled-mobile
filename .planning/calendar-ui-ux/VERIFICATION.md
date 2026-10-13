# Calendar UI / UX verification

Date: 2026-10-13
Status: Implementation ready on main, uncommitted. Automated integration checks passed; default iPhone walkthrough passed. Broader visual/accessibility/platform verification is outstanding as listed below.

## Delivered

- Explicit Upcoming/Day views; date selection filters immediately from top or pinned scroll positions, month selections collapse to the correct week, Today resets the selected day, and empty days retain date-specific add/log actions.
- One date heading per group; all-day events first, timed events ascending, deterministic ties. Past-only calendars retain useful empty-upcoming copy and history access.
- Compact no-look featured event with Plan my look; planned collages/generated photography retained. Ordinary rows use smaller serif titles and readable metadata.
- Details use full serif titles, essential context then planned look, with notes/source afterward. Honest weather assumptions and concise source navigation remain accessible.
- One Choose a look entry for saved outfits/items/board inspiration; compact opt-in calendar menus preserve other shared-menu callers. Forms and confirmations use consistent wording.
- Board save waits for success and retains selection on failure; item/outfit selection survives optimistic refresh for retry. Save/planning handoff guards prevent rapid duplicate actions.
- Sync management leads with connected calendars for returning users; introduction only after confirmed empty loaded state. Choose calendars, unavailable provider guidance, and empty-provider refresh are explicit.
- Outfit return preserves calendar view/scroll; date identity respects all-day source metadata; Sunday-to-Monday rollover keeps the browsed week anchored.

## Automated checks

- `npm run check`: PASS — typecheck, full lint, 152 suites / 1,119 tests at the integration run.
- Three additional CalendarScreen regressions were added after that run (past-only agenda, outfit-return view preservation, midnight week anchoring). The final screen suite passes all 9 tests; together these cover 1,122 test cases across the project. The complete suite was not rerun solely for these test-only additions.
- Targeted calendar/helper tests passed. New detail interaction suite: 5 tests covering real menu dismissal handoffs, board entry consolidation, planned-look ordering, viewing without mutation, and double-tap protection.
- `git diff --check`: PASS.
- Native iOS build via `npm run ios`: PASS, installed/launched on iPhone 17 / iOS 26.5. Existing Metro confirmed running. One existing Sentry build-script dependency warning; no native build errors.
- Existing test console warning: missing PostHog key in test environment disables analytics; tests pass.

## Live walkthrough

Inspected running app through Device Hub accessibility state and screenshots:

1. Upcoming: no giant empty image; current/future day headings and compact planning action visible.
2. Select Wednesday: only Wednesday events remain, ordered all-day then timed; no Tuesday hero.
3. Planned detail: full long serif title, context, look before imported notes, View outfit and Refine my look visible.
4. Choose a look: compact grouped entries, saved outfit and item pickers open after menu dismissal; cancel restores the event and prior plan.
5. Board chooser: search, inspiration explanation, board rows and explicit confirmation visible; opened/cancelled without changing a board.
6. Month grid: selecting empty Sunday collapses to its week and shows that day’s empty state.
7. Add from Sunday: new-event date defaults to October 18; cancel preserves selected Sunday.
8. Tools/sync: compact tools menu opens connections-first management; Choose calendars loads existing selected calendars; navigation back/close preserves Calendar context.
9. Open assigned outfit from Upcoming and return: Upcoming remains selected, no unrelated Day filter or detail sheet introduced.
10. Unplanned detail and imported-event options: accurate date/context, Ready to style, Plan my look, Edit styling details, Open calendar, Remove from Styled.

No production-like calendar events were created, removed, or reassigned during UI verification. Provider consent and disconnect were not exercised. Screenshots were inspected inline; durable screenshots with personal calendar data were not saved.

## Verified removal contract

Read-only backend inspection: `../Styled/server/routes.ts` inserts imported source identity into `calendar_ignored_events` before deleting the Styled event. `calendarReconcile.ts` skips ignored IDs (including legacy IDs). Confirmation therefore states that identified imports remain removed through sync; missing-identity legacy events use the truthful may-return wording. Source calendars stay unchanged. No backend files changed.

## Remaining verification limits

- Compact-device layout, largest accessibility text, spoken VoiceOver focus/navigation, Reduce Motion behaviour, and Android runtime parity were not exercised. Accessibility semantics/44-point targets are implemented, but those checks cannot be represented as passed.
- Live provider consent, revoked permission/auth/offline scenarios and failed saves were covered where existing automated tests support them; no real account failures or destructive writes were induced in the running app.
- The planning primary action’s handoff and duplicate guard are tested; a paid/remote outfit generation was not triggered during this UI-only walkthrough.

Existing untracked `polish-bench/` was left untouched. No branch, commit, push, PR, dependency install, or production deployment was performed.

## Follow-up: date selection scroll stability

User reported the masthead disappearing when moving from a short day to a busy day. `revealAgenda` always requested the masthead-height scroll offset; short content clamped that request, while longer content honoured it. Date/view changes now preserve the current offset while the masthead is visible, and return only to the agenda start if already scrolled beyond the pinned calendar. Confirmed Tuesday → Wednesday in the running iPhone app: heading and controls remain in place. Added a short/busy-day regression and exact top/pinned offset assertions. All 10 CalendarScreen tests, typecheck and targeted lint pass.
