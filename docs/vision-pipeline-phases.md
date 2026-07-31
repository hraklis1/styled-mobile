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
| `../Styled` working tree | **Uncommitted — that repo is on `main`** (see Phase 0) |
| `python_service` | Untouched and still the default |

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

---

## Phases

Each phase is self-contained. Preconditions are real; don't skip them.

### Phase 0 — Land the backend changes
**Precondition for every other phase.**

`../Styled` is on `main` with the whole `server/vision/` module uncommitted, and
project rules forbid committing to `main` unprompted. Decide with the user
whether that work goes on a branch mirroring `experiment/photo-algorithm` or
straight to `main`, then commit it. Nothing pushes without an explicit ask.

Files: `server/vision/**`, `server/routes.ts`, `server/storage.ts`,
`shared/schema.ts`, `migrations/0027_vision_cost_and_prettified.sql`,
`scripts/bench-vision.ts`, `.env.example`.

Note: `python_service/` also has unrelated pre-existing modifications in that
working tree. Don't sweep them into this commit.

**Done when:** the vision module is committed somewhere durable and `git status`
in `../Styled` is clean of vision-pipeline files.

---

### Phase 1 — Make the bench actually gate
**Depends on:** Phase 0.

`eval/scan/` has **2 fixtures and no `manifest.json`**, so `bench-vision.ts`
reports `—` for recall and IoU. Until that changes there is no objective
evidence for deleting anything in Phase 4.

Build a labelled set of ~25 photos under `../Styled/eval/scan/images/` spanning
the three scenes — worn outfit, flat lay, single garment — including the cases
the old pipeline special-cased: belts, watches, hats, ties, two-piece suits, and
at least two with footwear. Copy `manifest.example.json` to `manifest.json` and
label each case with `expectedItems` and percentage `bbox`es.

The photos have to come from the user; ask rather than inventing fixtures.

Run: `npx tsx scripts/bench-vision.ts --manifest eval/scan/manifest.json --out /tmp/bench`

**Done when:** recall and IoU are real numbers, the striping guard reports 0, and
p95 latency is under 10 s.

---

### Phase 2 — Soak and tune on real photos
**Depends on:** Phase 1.

Run the user's actual closet photos through the pipeline and tune the two knobs
that decide precision: `SEGMENT_MIN_SCORE` and the labeller's `isGarment`
prompt in `server/vision/label.ts`.

Known issue to fix here: the single-garment fixture yields one false positive (a
fabric sliver labelled "Blue Top"). Fix it in the label prompt, not with a
geometry rule — see Locked decisions.

Also worth measuring: whether the `bag` concept prompt earns its charge, and
whether any garment class is still being missed the way footwear was.

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
