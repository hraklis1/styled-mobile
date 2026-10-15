# Look card — input → output redesign

The "needs a piece" look card (`StylistLookResponseCard`) is dense, repeats
itself and stacks four action styles. Most of that is not a styling problem; it
is the pipeline handing the card overlapping or contradictory data. This plan
fixes each layer at its source and then restructures the card.

Status: Phases 1–3 implemented Oct 15 2026, uncommitted; backend not deployed.
Phase 4: eval done; backend deploy pending (user runs gcloud).

Phase 4 eval (Oct 15 2026, synthetic wardrobe, 6 look cases each, $0.11 total):
| | v9 | v10 |
|---|---|---|
| Replies with an opener | 4/6 | 6/6 |
| Mean opener words | 39.8 | 25.7 (max 33) |
| Mean card pieces named in opener (floor) | 1.0 | 0.8 |
| Rain case | incomplete + weather_layer, rationale, "Rain layer" | same |
Decision: keep v10; no repair-round enforcement (piece naming is ~1, a repair
would add a round trip for little gain). New eval case `style-today-rain`.
`openerMetrics` also counts unbound mentions by two consecutive name words
(still a floor: "olive chinos" vs "Olive Straight Chinos" is missed).

Phases 1 and 3 as built:
- `TODAY_REQUEST` ("What should I wear today?") is what the card sends;
  `buildTodaySubtitle` is display-only. `stageSuggestion` no longer stacks the
  same suggestion twice.
- Card order: label · serif title · one meta line → tappable grid
  (`ResolvedOutfitCollage.onSlotPress` → item sheet) → rationale
  (`payload.rationale ?? text`) → gap rows → one action row. Ledger,
  `NEEDS N PIECES` and the single-gap summary button removed; "Find N missing
  pieces" only for 2+ gaps. Weather add-on: "The look", "From your wardrobe ·
  add a rain layer if you're out in it", saves as a finished outfit.
- `GapCard`: label, then "Weather · for today's rain" as one meta line;
  `humanizeGeneratedCopy` is sentence case.
- Verified in the simulator: the old saved foundation renders through the
  fallbacks. Not yet seen live: a weather add-on card (the first v10 reply
  chose prose + a checklist, so no card). Covered by unit tests.

Phase 2 as built:
- `completion: "weather_layer"` and `rationale` on `StylistMessagePayload`
  (shared/schema.ts); rationale rides the existing `metadata` side-map in
  stylistConversationTools.ts. Card `text` is unchanged for older clients.
- Gap labels: "Rain layer", "Warm coat", "Lighter layer" (lookReadiness.ts and
  the weatherOnly fallbacks).
- Prompt `client-relationship-v10`: opener in 1–2 sentences, under 35 words,
  names at most one piece, weather caveats go in the rationale.
- `openerMetrics()` in stylistConversation.ts, logged on `validated_delivery`
  (`openerWords`, `openerNamesCardPieces`) and recorded per row by
  scripts/eval-stylist-client.ts. No repair-round enforcement yet.
- Tests: stylistRepair.test.ts covers completion, labels, rationale and
  opener metrics; full server suite 445 pass / 1 pre-existing skip.

## How a look reaches the screen today

```
App starter / composer                     buildTodayPrompt()  (stylist-empty-state.ts)
  "Mild and pleasant at 11°C — what should I wear Thursday?"
        │   ← weather adjective comes from the app's *current* conditions
        ▼
POST /api/stylist/ask (v3 transport, prompt v5: stylistClientPrompt.ts)
  model returns schema-v4 blocks:
    text  { segments … }                         → opening paragraph
    WardrobeOutfitCard { title, rationale, itemIds,
                         claimedStatus, missingRequirements[] }
        ▼
stylistConversationTools.ts
  convert:  note = rationale + "Missing: …" lines (joined into one string)
  makeLook: validateOwnedLook / validateFoundationSelection
            weatherOnly downgrade: a *ready* look missing only a rain/warm layer
            the closet can't supply → readinessStatus "incomplete"
            missingEssentials = explainSelectionGaps()  (lookReadiness.ts)
              labels are fixed strings: "A rain layer", "A warm coat", …
        ▼
payload { readinessStatus, lookName, itemIds, foundationItemIds,
          missingEssentials[], … }  + card text = note
        ▼
App: ChatMessageBubble → StylistLookResponseCard (status ≠ ready)
     GapCard title-cases the label ("A Rain Layer") via humanizeGeneratedCopy
     gap.label also becomes the Shop priority label (shoppingPriorityFromDailyLookGap)
```

## What the screenshots show, traced to its source

| Symptom | Source layer | Cause |
|---|---|---|
| Opening paragraph is six lines and lists every piece | Model output | Prompt says "short opening decision… do not list the same selection again", but nothing measures or enforces it |
| Opener says "mild… though the forecast now shows rain" | **Input** | `buildTodayPrompt` bakes in a weather description from current conditions; the server reads the day's forecast and contradicts it |
| Rain is said in prose *and* as a "needs 1 piece" gap | Server | The model wrote a ready look and handled rain in prose; `makeLook`'s weatherOnly rule then downgraded it to a foundation after the prose was written |
| "LOOK FOUNDATION · NEEDS 1 PIECE" for a look you can wear today | Server → client | A weather downgrade is shown with the same treatment as a genuinely unfinished look |
| Pieces shown in the grid and again under "What already works" | Client | The card renders a thumbnail ledger of the same `foundationItemIds` |
| Title appears *after* the photos | Client | Card order differs from the complete-look card (`ChatOutfitCard`) |
| "A Rain Layer Weather" reads as one phrase | Server + client | Article in the server label; client title-cases it; reason tag styled like the title |
| Big "Find missing pieces" plus "Find ›" on the only gap row | Client | Primary CTA always renders for incomplete looks |
| Model foundations repeat "Missing: …" in the rationale *and* as gap rows | Server | `note` concatenates `missingRequirements` into the card text |

## Phase 1 — Input: the request shouldn't argue with the forecast (app)

- `buildTodayPrompt` sends a weather-neutral request ("What should I wear
  today?"; "today" instead of the weekday when it is today). The card subtitle
  may still *display* the weather lead; it just isn't sent as a claim.
- The server already resolves the day's forecast into readiness context, so no
  backend change is needed.
- Tests: `stylist-empty-state.test.ts` cases for the sent prompt vs the
  displayed subtitle.

## Phase 2 — Server output contract (backend, additive only)

All fields are optional additions to `StylistMessagePayload`, so current app
builds keep working and saved threads still render.

1. **Weather add-on, not a foundation.** When `makeLook` takes the weatherOnly
   path, also set `completion: "weather_layer"` on the payload. Readiness stays
   `incomplete` for older clients; new clients render the look as wearable with
   a weather note (Phase 3). Interaction telemetry still counts it as incomplete.
2. **Separate rationale from requirements.** Keep `note`/card text exactly as
   today for old clients, and add `rationale` (the model's rationale alone) to
   the payload. New clients read `rationale` and show requirements only as gap
   rows, which removes the duplicated "Missing: …" paragraphs.
3. **Gap labels as noun phrases.** In `explainSelectionGaps`: "Rain layer",
   "Warm coat", "Lighter layer" (drop the article). These labels also seed the
   Shop priority search, where the article is noise too. Check `TripPlanCard`
   and the daily-look gap surfaces that show the same labels.
4. **Opening decision discipline (prompt v6).** In `stylistClientPrompt.ts`
   EDITORIAL DELIVERY: the opening decision is one or two sentences; never
   enumerate the look's pieces; weather caveats go in the card rationale, not
   the opener. No schema change, so no edit to the strict schemas in
   `routes.ts`. Bump the prompt version string so cache and telemetry split
   cleanly.
5. **Measure it.** Add deterministic checks to the stylist eval harness
   (`scripts/eval-stylist-client.ts` and `stylistConversation.test.ts`
   fixtures): opener word count, and the number of the card's pieces named in
   the opener (owned_item segments overlapping the card's `itemIds`). Telemetry
   field on `validated_delivery`: `openerWords`, `openerNamesCardPieces`.
   Enforce with a repair round only if the eval shows the prompt alone doesn't
   hold. Repairs cost latency and money.

Tests: `stylistRepair.test.ts` / `stylistConversation.test.ts` for the
weatherOnly path (`completion` set, readiness unchanged), `rationale` present
and free of "Missing:", and the new labels.

## Phase 3 — Card restructure (app)

Order, matching `ChatOutfitCard`:

1. Eyebrow (one, caps): `THE LOOK`, or `LOOK FOUNDATION` for a genuine foundation.
2. Serif title (`lookName`).
3. One meta line, sentence case, replacing `NEEDS 1 PIECE`:
   - foundation: "4 pieces from your wardrobe · needs shoes"
   - weather add-on: "From your wardrobe · add a rain layer if you're out in it"
4. Grid, with tappable tiles that open the item sheet. Add an optional
   `onSlotPress` to `ResolvedOutfitCollage` (additive; calendar and outfit
   surfaces are unaffected).
5. Rationale (`payload.rationale ?? text`).
6. "Complete the look": gap rows, foundation only. A weather add-on shows its
   single row inline under the meta line instead.
7. One action row: Save outfit/foundation (outlined `PressableScale`); Listen as
   a quiet icon action. The big "Find missing pieces" button only when 2+ gaps;
   otherwise each row's own "Find ›" is the action.

Remove: the "What already works" ledger, the duplicate `NEEDS N PIECES` caps
label, and the extra gap between Save, Refine and Listen.

`GapCard` (shared with advice replies): two lines, label then
"Weather · for today's rain" in meta; `humanizeGeneratedCopy` keeps sentence
case instead of title case. Update `GapCard.test.ts`.

Motion: wire the card into `Reveal` / `freshMessages` like the complete card.

Fallbacks: no `rationale` → card text; no `completion` → foundation treatment;
old labels with an article still render (sentence case only).

Tests: `StylistLookResponseCard.test.tsx`: ledger gone, order, one gap = no
primary Find button, weather add-on variant, save still saves only owned
foundation pieces (existing case).

## Phase 4 — Verification and release

1. Backend unit tests + `tsc`; app `tsc`, lint, jest.
2. Eval run (paid; needs your go-ahead, capped as the harness already does):
   compare opener length and piece enumeration, prompt v5 vs v6, on the
   existing cases plus a rainy-day fixture.
3. Simulator: "Style me today" on a rainy forecast (weather add-on), a
   foundation that genuinely lacks shoes, an old saved thread (fallbacks).
4. Release order: deploy backend first (additive fields + prompt v6), then the
   app build. Either order is safe, but backend-first lets the new card light
   up immediately. The rollback is the previous Cloud Run revision; the app
   tolerates missing fields.

## Out of scope / decided elsewhere

- Serif opening paragraph: deliberately removed in 2a47c32; stays body type.
- Collage mat and cover-image choice: deliberate (`ResolvedOutfitCollage`,
  `itemImage.ts`).

## Incident — look cards lost to the repair round (Oct 15 2026)

Symptom: "What should I wear today?" came back as prose + a checklist, no photos.
Cause: the model's look failed composition validation (missing shoes / missing
top and bottom, plus no rain layer). The weatherOnly path only rescues
weather-only failures, and the single repair round used `CLIENT_REPAIR_SCHEMA`,
which has no cards (47d5b4f), so the look was rewritten as prose.

Live sample (dev, real wardrobe): v10 2 failed then 2 clean; v9 2 clean. Read
as model variance rather than a v10 regression, so v10 stays.

Fix (stylistConversation.ts): `isCompositionRepair()`. When every validation
error is a composition error (shoes/top+bottom/weather layer/heat/shorts/dress
code/shoe formality/pattern or knit clash), the repair keeps
`CLIENT_REPLY_SCHEMA` and asks for the corrected card from inspected pieces; the
result is validated again (and still rescued by weatherOnly). Any other error
keeps the prose/checklist-only repair. `diagnostics.repairKeptCards` records it.
Tests: stylistRepair.test.ts (classifier + scripted missing-shoes → corrected card).
Not yet seen live: an actual corrected-card repair (the clean v10 runs needed none).
