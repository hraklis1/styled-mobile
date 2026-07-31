# Vision Pipeline — Phase Handoff

Cross-repo work: `Styled-mobile` (this repo, branch `experiment/photo-algorithm`)
and the sibling backend `../Styled`.

This file exists so each phase can be picked up in a **fresh session** without
re-deriving context or quietly re-deciding something that was already settled.
Read "Locked decisions" before changing anything; it is the part that prevents
drift. If a phase forces you to break a locked decision, say so explicitly and
update this file in the same change — don't silently diverge.

---

## Where things stand (2026-07-30)

Garment detection was moved off `../Styled/python_service` onto hosted SAM 3.
`../Styled/server/vision/` now does in two model calls what the Python service
did in six to twelve:

1. **SAM 3** (`fal-ai/sam-3/image`) — every garment's mask and box, one flat
   charge regardless of garment count.
2. **One labelling pass** — names, categories and pair-grouping for all detected
   regions at once, through the existing `server/llm` `tagging` route.

Everything else is local pixel work in `server/vision/mask.ts`.

Measured on a real worn-outfit photo: **3 items, 3.6 s, $0.006**, against 20–60 s
before. Full attribute extraction (`POST /api/items/scan`) is unchanged.

**Prettify** regenerates one garment as a catalog flat-lay
(`POST /api/items/:id/prettify`), quota'd, writing to its own `prettified_url`
column.

### Status by area

| Area | State |
|---|---|
| `../Styled/server/vision/` | Built, typechecks, benched, simulator-verified |
| Routes wiring, migration 0027 | Built; **migration already applied to the DB** |
| Mobile client | Committed on `experiment/photo-algorithm` (`78d4d9c`) |
| `../Styled` working tree | Phase 0 committed (`a1eb08d`), unpushed. **Phase 1 changes uncommitted:** `eval/scan/**`, `scripts/bench-vision.ts`, `server/vision/scanPhoto.ts` |
| Eval set | 9 labelled cases, recall 0.763 / IoU 0.777 — short of the ~25 Phase 1 asks for |
| `python_service` | Untouched and still the default. Its unrelated garment-gate edits are still dirty in that tree — don't sweep them in |

---

## Locked decisions

Settled with evidence. Do not re-open casually.

**Rollout**
- `VISION_PIPELINE=legacy|sam3`, default `legacy`; anything unrecognised falls
  back to `legacy`. This is the rollback lever — keep it working.
- The `/api/scan-vision-pose` response is **byte-compatible** with the Python
  service's shape. That contract is why the mobile client needed no changes.
  Breaking it means touching `ScanItemSheet`, `BatchScanSheet` and the backfill.

**SAM 3 API** (verified by experiment; all three cost real debugging time)
- `masks[]` is **positionally aligned** with `metadata[]`/`boxes[]`/`scores[]`.
  `metadata[].index` is **not** a `masks[]` index — using it paired 7 of 8
  garments with the wrong mask and still produced plausible-looking output.
- Boxes are normalised **`[cx, cy, w, h]`** (centre-based), not `[x, y, w, h]`.
- The prompt `"clothing"` does **not** match footwear. Default is several concept
  phrases (`clothing,shoe,bag`) run in parallel and merged by IoU.

**Thresholds**
- `SEGMENT_MIN_SCORE` is deliberately low (0.55). A genuine NY cap scored 0.63;
  an "obviously safe" 0.85 silently drops real items. Semantic rejection is the
  label pass's `isGarment`, not a score cut-off.
- Pairs (left/right shoe) are merged via the labeller's `pairGroup`, **not**
  geometry. Hand-tuned size/adjacency heuristics are exactly what made the old
  pipeline unmaintainable.

**Models**
- **BiRefNet is off on purpose.** Measured worse than SAM 3's instance masks —
  halo on crops, alpha bleed through garment interiors. `MATTE_REFINE=birefnet`
  re-enables it as an intersection (can only remove pixels).
- **Prettify uses `fal-ai/nano-banana/edit`, sourced from the ORIGINAL photo.**
  Qwen-Image-Edit (Apache 2.0) turned a plain heather-grey crewneck into a teal
  colour-blocked sweatshirt with invented lettering. It stays selectable via
  `PRETTIFY_MODEL` for anyone who needs open weights.
- fal 422s on any source under **256×256**; real cutouts often are. Sources are
  flattened onto off-white and fitted to 1024 first.

**sharp** (both silently produce plausible-looking garbage)
- `dest-in` blend and `joinChannel()` do **not** apply a 1-channel mask as alpha
  — output stays 3-channel and fully opaque. Use the explicit RGB+mask → RGBA
  interleave in `applyMaskAsAlpha()`.
- Blurring a 1-channel raw buffer returns a **3-channel** result. Assuming
  stride 1 striped every cutout into transparent scanlines. `alphaLooksStriped()`
  in the bench guards this and is verified to fire.

**Data**
- `prettified_url` is a **third** column. Never overwrite `cutout_url` or
  `image_url` — Prettify is generative and the faithful cutout must survive it.
- Schema changes go in `../Styled/migrations/` and are applied by direct SQL.
  **Never `npm run db:push`** in `../Styled` — it drops the session table.

**Benching** (cost an afternoon in Phase 1; the failure is silent by design)
- A failed labelling call degrades to "every region is a non-garment", which is
  byte-identical to an empty scan. `.env` has `TAGGING_PROVIDER=google`, and the
  **Gemini free tier allows 20 requests/day** — the bench spends one label call
  per photo, so a 25-photo run exhausts it. Seventeen consecutive photos
  reported `0 items` while SAM 3 was returning healthy detections, and it read
  exactly like a model regression.
- `scanPhoto` now records `telemetry.labelError` and the bench prints
  `LABEL_ERR`, **withholds** recall/IoU for that row rather than scoring the
  failure as 0.00, and exits non-zero. The user-facing degradation is
  unchanged — a scan still returns empty rather than 500ing.
- Before reading any bench result as a regression, check that column. A 25-photo
  run needs paid Gemini quota, or `TAGGING_PROVIDER` pointed elsewhere — but
  note that benching a different labeller than production runs makes recall and
  IoU non-transferable.
- **At n=9, the reported p95 is just the maximum** (`floor(9 × 0.95) = 8`, the
  last index), so the "p95 under 10 s" gate is really "no single photo over
  10 s" and one slow LLM response fails it. Compare **medians** across runs
  instead: labelling latency swings several seconds run to run on identical
  input — the same photo measured 14.2 s and 5.8 s on consecutive runs. Getting
  the fixture set to ~25 would make p95 mean what it says.

---

## Phases

Each phase is self-contained. Preconditions are real; don't skip them.

### Phase 0 — Land the backend changes ✅ Done (2026-07-30)
**Precondition for every other phase.**

Landed as `a1eb08d` on `../Styled`'s new `experiment/photo-algorithm` branch,
mirroring this repo's branch name. Unpushed, and `main` there is untouched.
`python_service/`'s unrelated garment-gate changes (including untracked
`tools/probe_cutout.py`) were left out and are still uncommitted on that branch.

Note: `../Styled` has no `AGENTS.md` — only this repo does.

Files: `server/vision/**`, `server/routes.ts`, `server/storage.ts`,
`shared/schema.ts`, `migrations/0027_vision_cost_and_prettified.sql`,
`scripts/bench-vision.ts`, `.env.example`.

Note: `python_service/` also has unrelated pre-existing modifications in that
working tree. Don't sweep them into this commit.

**Done when:** the vision module is committed somewhere durable and `git status`
in `../Styled` is clean of vision-pipeline files.

---

### Phase 1 — Make the bench actually gate ⚠ Partly done (2026-07-30)
**Depends on:** Phase 0.

`manifest.json` now exists with **9 labelled cases / 38 items**, and the bench
reports real numbers:

| | at Phase 1 | after the Phase 2 prompt fix |
|---|---|---|
| Overall recall | 0.763 (29/38) | **0.974** (37/38) |
| Mean IoU | 0.777 | 0.733 |
| Striping guard | 0 / 34 cutouts | **0** |
| Median latency | 5.9 s | ~7.3 s |
| Cost | $0.006/photo | $0.008/photo |

All three done-conditions hold — but on 9 cases, not the ~25 asked for, so this
is not closed. Blocking the rest: the user's first batch was 14 thumbnail-sized
files (126×168 to 516×387) and 2 watermarked Alamy stock photos, all held in
`eval/scan/images/incoming/rejected/`. **Still missing: real flat lays** (the
only stand-in is `rail-shirts-01`, a drying rack) **and a tie** (zero coverage).

The two original fixtures were dropped: `flat-lay-layered-01` was a screenshot
with a crop-tool overlay burned into it, and both were replaced on the user's
call. They are recoverable from git history.

Label boxes **by eye**, never from SAM 3's own output — ground truth taken from
the model under test scores its boxes against themselves and yields an IoU near
1.00 that means nothing. A percentage-grid overlay read at ~1300px gets to about
±1.5%, ample at an IoU threshold of 0.3. Omit items too small or too clipped to
label honestly and say so in the case's `_notes`; a guessed box is worse than a
missing one.

The photos have to come from the user; ask rather than inventing fixtures.

Run: `npx tsx scripts/bench-vision.ts --manifest eval/scan/manifest.json --out /tmp/bench`

**Done when:** the set reaches ~25 cases covering all three scenes plus belts,
watches, hats, ties, two-piece suits and footwear — recall and IoU are already
real, the striping guard already reports 0, and p95 is already under 10 s.

---

### Phase 2 — Soak and tune on real photos ⚠ Mostly done (2026-07-30)
**Depends on:** Phase 1.

Miss and false-positive rates are now quantified and the threshold change is
recorded, so the done-condition is met — but on the nine-case set, not ~25, and
two items below are still open (`pairGroup`, and the unverifiable
false-positive issue). `bench-vision.ts` gained `prec` and `unmatched` columns
plus item-weighted totals to make this measurable at all.

Run the user's actual closet photos through the pipeline and tune the two knobs
that decide precision: `SEGMENT_MIN_SCORE` and the labeller's `isGarment`
prompt in `server/vision/label.ts`.

**Finding 1 — small accessories are missed at the SEGMENT stage, not the label
stage.** This is the answer to "whether any garment class is still being missed
the way footwear was", and yes: hats, belts and watches are. From the Phase 1
run, note `raw` is at or barely above `items`, meaning SAM 3 never *proposed* a
region for them, so no amount of label-prompt work can recover them:

| case | recall | raw | never proposed |
|---|---|---|---|
| `worn-hat-tee-01` | 0.33 | 1 | bucket hat, bracelet |
| `worn-polo-belt-trousers-01` | 0.40 | 2 | belt, watch, bracelet |
| `worn-tee-chinos-watch-01` | 0.60 | 3 | watch, sunglasses, bag |

**Fixed (2026-07-30).** The default is now `clothing,shoe,bag,accessory`.
Overall recall **0.763 → 0.974** (29/38 → 37/38); eight of nine cases are at
1.00, and `worn-polo-belt-trousers-01` at 0.80 is the only one left short.

One generic phrase beat four specific ones outright — `hat,belt,watch,sunglasses`
scored 0.77 on the three accessory-heavy cases where `accessory` alone scored
0.92, at twice the added cost and ~4s more latency. **Prefer the general term**;
adding phrases is not free.

Cost $0.006 → $0.008/photo, median latency 5.9s → ~7.3s. Mean IoU dips
0.760 → 0.705 because more small items now match and small boxes score lower
IoU — that is more found, not worse boxes.

It costs some precision: **>=0.879 → >=0.804** (29/33 → 37/46). Of the 13 extra
predictions, 8 are correct and 5 match nothing labelled — and several of those 5
are garments the manifest omits on purpose, so the real cost is smaller.

Taken deliberately, because **the trade is asymmetric**: this pass only fills a
review UI, so a spurious item costs the user one tap, while a garment SAM 3
never proposes can never reach the closet at all. Do not "fix" the precision
number by making segmentation stricter — that trades a cheap error for an
unrecoverable one.

**Finding 2 — `pairGroup` did not merge a pair.** In `worn-suit-twopiece-01`
the two brown loafers came back as two separate "Brown Leather Loafer" items.
Both were clipped at the frame edge, which may be the cause. Fix in the label
prompt, not with geometry — see Locked decisions.

The old known issue — the single-garment fixture yielding a false-positive
fabric sliver labelled "Blue Top" — **is no longer reproducible**: that fixture
(`single-blazer-01`) was replaced in Phase 1. Its successor,
`single-turtleneck-01`, scores recall 1.00 from 1 raw region with no false
positive, so the fabric-sliver problem is unverified rather than fixed. Treat
`single-turtleneck-01` as the case to watch: a hand, a vase and a side table are
in frame and must not come back as items.

**Done when:** false-positive and miss rates are quantified on the Phase 1
manifest, and any threshold change is recorded in this file.

---

### Phase 3 — Retire the legacy client-side throttling
**Depends on:** Phase 0. Independent of 1 and 2.

The client still self-throttles for an inference gate that no longer exists on
the `sam3` path. In `src/lib/cutoutBackfill.ts`: `PACE_MS = 600`, one request in
flight, exponential backoff to 30 s on 503, hard stop after 5 consecutive
failures. `../Styled/server/routes.ts` no longer returns 503 on `/api/cutout`
under `sam3`.

Make the pacing conditional rather than deleting it outright — the legacy path
still needs it while `VISION_PIPELINE=legacy` remains reachable.

**Done when:** a large-closet backfill runs materially faster on `sam3` and is
unchanged on `legacy`.

---

### Phase 4 — Cost visibility
**Depends on:** Phase 0. Independent of the rest.

Migration 0027 added `ai_token_log.cost_usd`, and `server/vision/cost.ts` writes
it for per-call models (tokens are zero — an image endpoint has no prompt or
completion tokens). **Nothing reads it yet.**

Extend the usage reporting in `../Styled/scripts/` to aggregate dollars, so
per-call vision spend and token-billed LLM spend appear side by side. Token rows
leave `cost_usd` null and are still costed from model + token counts.

**Done when:** one command reports spend per endpoint over a date range,
including scan and prettify.

---

### Phase 5 — Delete the Python detection stack
**Depends on:** Phases 1 and 2, plus a real soak period on `VISION_PIPELINE=sam3`.
**Do not start this early.** It is irreversible-ish and unblocked only by evidence.

Once the hosted pipeline has been the default for a while and the bench shows
parity or better, `../Styled/python_service` loses the large majority of
`main.py` (3,379 lines) and `processor.py` (2,087 lines):

- `_GPT_IDENTIFY_PROMPT`, `_FLAT_LAY_PROMPT`, the `_MICRO_*` prompts
- `gpt_flat_lay_items`, `gpt_identify_items`, `gpt_classify_single_item`
- `_cv_flat_lay_boxes` and the watershed instance splitter
- `_dedup_gpt_items`, `_nms_bbox_pct`, `_landmark_in_bbox_pct`, `_is_skin_dominant`
- all three rembg sessions, `_INFERENCE_GATE`, `run_gated`
- `cutout_quality.py`, `garment_gate.py`, the MediaPipe pose-region machinery

`/crop-items` may survive. Check callers before removing any endpoint.

Retire the `VISION_PIPELINE` branch in the same change **only if** the Python
service is gone entirely; otherwise keep the lever.

**Done when:** the app runs with no Python service at all, both repos typecheck,
mobile tests pass, and a simulator scan of each of the three scenes still works.

---

## Verification (any phase)

```sh
# backend
cd ../Styled && npm run check
npx tsx scripts/bench-vision.ts --images eval/scan/images --out /tmp/bench

# mobile
npm run typecheck && npm run lint && npm test
```

Backend has no `lint` or `test` script; `npm run check` is tsc.

Simulator: start the backend with `VISION_PIPELINE=sam3` on port 3001 (see
`docs/local-development.md`), then `npm run ios:sim`. Simulator taps are in
**points** — divide screenshot pixels by ~2.29.
