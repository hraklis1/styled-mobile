# Lending v2 — plan

Follow-up to the Oct 9 2026 lending release (backend 90fb8de, mobile 78fc521,
migration 0065). The base is sound: `item_loans` history, one open loan per
item, transactional lend/return, and a contact picker that needs no
permission. This plan covers correctness, discoverability, multi-item
lending, reminders and data fetching.

Phases ship in order. Each one leaves `main` releasable. Backend phases deploy
before the app build that depends on them. New behaviour is on by default (see
AGENTS.md).

---

## Phase 1 — Correctness (backend + mobile)

**Status (Oct 13 2026):** implemented, uncommitted. 0071 applied on dev only.
The batch endpoints are named `POST /api/loans/return` and `POST /api/loans/reopen`
(both take `{ itemIds, today }`); the single-item return route is kept for old
builds. Backfilled loans are dated the migration day (the real start is unknown).
Tests: `npm run test:lending` (backend, dev DB) and
`src/hooks/__tests__/useLendContacts.returns.test.tsx`.

**1.1 One way into `lent`.** Today the item PATCH can set `availability='lent'`
without a loan row, which is why Lent Out has a "No name given" group.
- `server/routes.ts` item PATCH: when the item moves *into* `lent` and has no
  open loan, insert one (`contactId: null`, `lentAt: today`). Do it in the same
  transaction as the update. Add `openLoan(tx, itemId, today)` to
  `lendContacts.ts` and use it from both routes.
- Accept an optional `today` (YMD) on the item PATCH. Pass it to
  `closeOpenLoan` and the new insert, so evening returns in the Americas aren't
  dated the next UTC day. Mobile `useUpdateItem` sends `localYmd()` whenever the
  patch contains `availability`.
- Migration **0071_backfill_open_loans.sql**: insert an open loan for every
  `lent` item that has none, using `lent_at = COALESCE(updated_at::date,
  CURRENT_DATE)`. The script is safe to run twice because the partial unique
  index blocks duplicates (use `ON CONFLICT DO NOTHING`).

**1.2 Undo for "Returned".**
- New `POST /api/items/:id/reopen-loan`: reopens the most recent loan if it
  was returned today, clearing `returned_at` and setting availability back to
  `lent`. Returns 409 if another loan has been opened since.
- Mobile `useReturnItem` → shows `UndoToast`
  (`src/components/primitives/UndoToast.tsx`) with "Returned · Undo". Undo
  calls reopen and restores the cached item and loans.
- Applies to the Lent Out rows, "All returned" (one toast for the batch), and
  "Mark as returned" on Item Detail.

**1.3 Batch return.** `POST /api/loans/return` with `{ itemIds, today }`
closes the loans in one transaction and calls `onItemsChanged` once.
"All returned" makes this single call. Undo reopens the same ids in one batch
call (`POST /api/loans/reopen`).

**1.4 Deleting a lent-out item.** In the Item Detail delete confirm, when the
item is lent, add "Maya still has this. Its lending history will be deleted
too." No server change.

**Tests:** server tests for PATCH entering and leaving `lent`, the backfill
running twice, the reopen window (and the 409), and the batch return.
Mobile: unit tests for the hooks' optimistic updates and rollback.

---

## Phase 2 — Leaner data fetching (backend + mobile)

**Status (Oct 13 2026):** implemented, uncommitted. Differences from the plan:
- The open-loan summary is on `GET /api/items` only. There is no single-item
  GET route.
- `openLoan` also carries `contactRelationship`.
- `/api/loans` rows now include `contactName`.
- The next-page cursor is sent in an `X-Next-Cursor` header, so the response
  body stays the array older builds expect.
- Item Detail fetches `?itemId=` as soon as it opens. It's one small query, so
  it isn't held back until the history section is visible.
- Lent Out fetches `?status=returned` once. There's no paging UI yet; the
  cursor is ready for when the history outgrows one page.
- The reminder sync uses `?status=open`.

**2.1 Open-loan summary on items.** Add `openLoan: { id, contactId,
contactName, lentAt, dueBack } | null` to the item list and detail payloads
(left join on the partial index; cheap). Then:
- Closet strip, Item Detail status line, the Lent Out "out now" groups and the
  reminder sync read `item.openLoan`. They no longer need `/api/loans` or
  `/api/lend-contacts`.
- Delete the duplicated "open loan for this item + person" lookup in
  ClosetScreen and LentOutScreen. Add a `useOpenLoans()` selector over the
  items query.

**2.2 Paged, filtered history.** `GET /api/loans` takes `?itemId=`,
`?contactId=`, `?status=open|returned`, plus a `limit`/`before` cursor.
- Item Detail fetches `?itemId=` only when the "Lending history" section is
  displayed.
- Lent Out fetches `?status=returned` lazily when a person's history is
  expanded, or a single page on first load.
- Set `staleTime: 5 min` on the loan and contact queries, and invalidate them
  from the mutations as today.

**2.3** `useLendContacts()` on Item Detail is enabled only once the LendSheet
opens. The sheet already fetches it, so remove the screen-level call.

Old app builds keep working: the existing `/api/loans` response doesn't change
when no query parameters are sent.

---

## Phase 3 — Discoverability & bulk lending (mobile)

**Status (Oct 13 2026):** implemented, uncommitted.
- `POST /api/loans` (`{ itemIds, contactId, dueBack, today }`) and the
  single-item lend route share `lendItems()`. A back-by date before any
  loan's start rejects the whole batch.
- The "Lent" filter reuses the closet's existing but unused `selectedStatuses`
  state, as a full Availability section: Available, Lent out, In the wash,
  Stored.
- In the Closet, "Lend…" sits in the selection overflow menu. "Lend N pieces"
  becomes the primary action only when the Closet was opened from Lent Out
  (`ClosetMain` `lend` param).
- The Profile hub row and the settings-search entry close the Profile modal
  and open Lent Out in the Closet tab.
- Sim-verified: Lent Out button, selection → lend 2 pieces → toast, Item
  Detail Lend/Lent button + Returned/Edit loan pills + undo bar.
- Not sim-verified: Outfit Detail "Lend this outfit", Profile row, settings
  search, Availability chips (unit-tested).

**3.1 Permanent entry point.**
- Add a "Lent" filter chip in the Closet pieces filters. It shows lent items
  and has a header link to Lent Out.
- Add a "Lending" row in the Profile hub (and in settings search,
  `settingsSearch.ts`) that opens Lent Out even when nothing is lent.
- Keep the Closet strip as the highlight when something is lent.

**3.2 Empty state on Lent Out.** When nothing is out, show a short sentence
plus "Lend something". History and "Your people" stay visible.

**3.3 Lend several pieces.**
- Add "Lend" to `SelectionActionBar` in Closet multi-select.
- LendSheet accepts `items: {id, name, uri}[]` and shows a thumbnail stack in
  the header instead of one item.
- New `POST /api/loans` with `{ itemIds, contactId, dueBack, lentAt, today }`
  creates the loans in one transaction. Items that are already out are moved
  to the new person (the loan is edited, not duplicated).
- Add "Lend this outfit" on Outfit Detail, which pre-selects the outfit's
  pieces.
- Add "Lend something" on Lent Out, which opens the closet picker in
  selection mode.

**3.4 Make lending visible on Item Detail.** Add "Lend" to the action row
under the hero (not only in the ⋯ menu) while the item is available. When it's
lent, the status sentence gets inline "Returned" and "Edit" buttons.

---

## Phase 4 — Loan details (backend + mobile)

**4.1 Lent-on date.**
- LendSheet gets a "Lent on" row. It defaults to today and is editable, but
  can't be later than today.
- The server takes `lentAt` on create and on edit of an open loan, and checks
  `due_back >= lent_at`. Back-by presets count from `lentAt`.

**4.2 Note.**
- Migration **0072_loan_note.sql**: `item_loans.note text` (max 140,
  validated in zod).
- Optional "What's it for?" field in LendSheet.
- The note shows in history rows and the reminder body.

**4.3 Relationship.** Keep it, but make it optional and collapsed under "More"
when adding someone new. Group the people in "Your people" by relationship.
(The alternative, dropping the field entirely, is open question 1.)

---

## Phase 5 — Reminders that follow through (mobile, small backend)

**5.1 Overdue follow-up.** `syncLoanReminders` also schedules a reminder 3 days
after the back-by date: "Maya has had your blazer 3 days past the date." Then
it stops (no nagging loop). Reminders are still rebuilt from scratch, still
under the `styled-loan` tag, and still capped (raise the cap to 40).

**5.2 Open-ended nudge.** Loans with no back-by date get one reminder at 30
days: "Your blazer has been with Maya a month."

**5.3 Message them.**
- Migration in Phase 4's file: `lend_contacts.device_contact_id text`, saved
  when the person was picked from Contacts. Only the id is stored, never
  numbers.
- The "Remind Maya" button opens the share sheet with a pre-written message
  (`Share.share`). That needs no permission and works for typed names too.
- Notification action "Remind them" deep-links to `styled://lent-out?nudge=<loanId>`,
  which opens the share sheet.

**5.4 Turning it on.** The setting still turns on automatically on the first
back-by date. With 5.2, it also offers to turn on after the first lend with no
date, using the same inline permission flow.

---

## Phase 6 — Stylist & calendar awareness (backend + mobile)

**6.1 Calendar conflicts.** When a planned outfit for an upcoming event
contains a lent item:
- The calendar agenda row shows a "With Maya" chip, using
  `item.openLoan` from Phase 2.
- The morning-of reminder (existing `syncReminders`) adds "Get your blazer back
  from Maya first."

**6.2 Stylist.** The prompt's existing availability context says *who* has the
piece and since when. Only the name and date are sent; the note is not. When
the stylist would have picked a lent piece, it can say so and suggest a swap
instead of silently leaving it out. Bump the prompt version and update the
evals.

---

## Phase 7 — UI polish

- Lent Out rows:
  - "Returned" becomes a real pill button, and a trailing swipe action does
    the same thing.
  - Overdue rows get a destructive-tinted date and sort first (already true).
- `accessibilityLabel` on "All returned", "Show history" and person headers.
- "No name given" group: an inline "Add a name" opens LendSheet in edit mode.
- Haptics on return and undo.
- Account export: add the note and `device_contact_id` (lending data is already
  exported).

---

## Rollout & verification

| Phase | Migration | Deploy order | Sim check |
|---|---|---|---|
| 1 | 0071 backfill | backend first | return → undo; lend via edit modal shows person row |
| 2 | — | backend first (additive fields) | Item Detail opens without `/api/loans` in the network log |
| 3 | — | backend (`POST /api/loans`) first | multi-select lend 3 pieces to one person |
| 4 | 0072 note + device id | backend first | backdated loan, note in history |
| 5 | — | app only | schedule list shows overdue + 30-day entries |
| 6 | — | backend (prompt) then app | planned outfit with lent piece shows chip |
| 7 | — | app only | VoiceOver pass on Lent Out |

- Migrations go through `scripts/apply-migration.ts` (dev, then prod), never
  `db:push`.
- Each backend deploy is tagged `styled-api-lending2-<sha>`, and the previous
  revision is kept as the rollback.
- Phases 1–2 can ship in the current build cycle. Phases 3–7 need the next
  TestFlight build.

## Open questions

1. Keep the relationship field, or drop it?
2. Undo window: toast only (about 5s), or also "reopen" from history for that
   whole day? The plan assumes the whole day on the server and the toast in
   the UI.
3. Should the overdue follow-up repeat weekly, or stop after one?
