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
| `../Styled` working tree | Phase 0 `a1eb08d`, Phase 1 `0c2b7fa`, Phase 2 `bc0a03e` — all on `experiment/photo-algorithm`, unpushed. **2026-07-31 changes uncommitted:** `eval/scan/**`, `server/vision/{label,config,scanPhoto}.ts`, `.env.example` |
| Eval set | **25 labelled cases / 85 items**, recall 0.976 / IoU 0.759 / precision >=0.865. Phase 1 target met |
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
- **Phase 2 re-examined this at n=25 and left it at 0.55, now with direct
  evidence.** Lowering it to **0.05 — eleven times lower — recovered nothing**
  on the cases that were missing items. The misses are not low-scoring regions
  being filtered out; SAM 3 proposes *no region at all*. The threshold is not
  the knob those failures respond to, and the knob that does work is the concept
  prompt list.
- Separately, every false positive measured was a *fragment of a real garment*
  (a sleeve, a strap, a waistband), never a low-scoring non-garment, so raising
  the cut-off would drop real items to fix a problem it does not address. Zero
  non-garment objects were returned across all 25 cases.
- Concept phrases are not free (~$0.002 each) and must pay for themselves in
  recall — **but measure that on a fixture where the item stands alone.** `bag`
  was removed in Phase 2 on an A/B showing 16/16 recall either way, then
  **restored the same day** when standalone-bag fixtures were added: without it,
  a tote, a backpack and a handbag each returned **zero regions**. The original
  A/B only had crossbody bags worn on a dressed person, where `clothing` already
  covered them. A phrase measured only where another phrase overlaps it will
  always look free to delete. Default is `clothing,shoe,bag,accessory,tie`.
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

**EXIF orientation** (found 2026-07-31; the worst silent failure yet)
- **fal applies EXIF orientation; sharp does not.** On a photo tagged
  orientation 6 — the normal case for a portrait phone shot — SAM 3 returns
  boxes in upright space while `metadata()`, `extract()` and every local mask
  operation work in stored space. They disagree by 90°.
- The result looks completely healthy: a real 4000×3000 fixture produced **nine
  confidently-named items** whose cutouts were bathroom wall and ceiling, with
  the striping guard clean, the bench reporting `1/1 ok`, and normal cost and
  latency. Nothing downstream can detect it.
- Fixed in `normalizeImage()` (`scanPhoto.ts`), which now bakes the rotation
  into the pixels with `sharp().rotate()` before anything else runs. Only images
  that need it are re-encoded. `worn-suit-mirror-01` is the regression fixture —
  the only one in the set with a rotation tag.
- **Ground-truth boxes must be read off an EXIF-corrected render** (PIL
  `ImageOps.exif_transpose`) or they are silently transposed.

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
  input — the same photo measured 14.2 s and 5.8 s on consecutive runs.
  At n=25 `floor(25 × 0.95) = 23`, the second-to-last index, so p95 finally
  means something — it now tolerates exactly one outlier.
- **The bench has no HTTP timeout and will hang forever on a dead socket.** If
  the machine sleeps mid-run, the fal connections die and the run blocks
  silently rather than failing. Observed: 18 minutes with an empty output
  directory on a run that normally takes two. Symptom is an out dir with no
  per-case JSON in it. Kill and restart — and **do not pipe the bench through
  `tail`**, which buffers all progress output until the pipe closes and hides
  exactly the per-case lines you need to tell a hang from a slow run.

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

### Phase 1 — Make the bench actually gate ✅ Done (2026-07-31)
**Depends on:** Phase 0.

`manifest.json` holds **25 labelled cases / 85 items** — the ~25 asked for.
Scenes: `worn_outfit` 9, `single_garment` 9, `flat_lay` 7. Every class the
done-condition names is covered: belts, watches, hats, **ties**, two-piece suits
(×2) and footwear (five unclipped pairs), plus tote / backpack / handbag, socks
and glasses.

**The last ten cases paid for themselves immediately** — they overturned a Phase
2 conclusion (the `bag` removal) and exposed the EXIF bug in Locked decisions.
Both were invisible at n=15 because no fixture isolated the failure. Coverage is
not box-ticking; it is what makes a wrong conclusion falsifiable.

Caveats, all recorded in the manifest `_comment`:
- **Only `worn-suit-mirror-01` is the user's own camera photo.** The rest are
  web-sourced, and many fall below the ≥1200px short-edge floor the original
  nine meet (577×767 upward). The styled shots are evenly lit with
  well-separated garments, so recall on them reads **optimistic** against a real
  scan. `flat-lay-carpet-cap-belt-01` and `worn-suit-mirror-01` are the honest
  baselines.
- Boxes are in **display orientation**; read them off an EXIF-corrected render.
- Every box was re-rendered over its photo and checked by eye. That pass caught
  **five wrong boxes** that would otherwise have been scored as model failures —
  a watch off by 8%, and a whole lower body off by ~25% on the EXIF fixture.
  Do not skip it; an unverified box is indistinguishable from a real miss.

The Phase 1 numbers below are the historical nine-case figures:

| | at Phase 1 | after the Phase 2 prompt fix |
|---|---|---|
| Overall recall | 0.763 (29/38) | **0.974** (37/38) |
| Mean IoU | 0.777 | 0.733 |
| Striping guard | 0 / 34 cutouts | **0** |
| Median latency | 5.9 s | ~7.3 s |
| Cost | $0.006/photo | $0.008/photo |

All three done-conditions hold, now at n=25. Rejected material lives in
`eval/scan/images/incoming/rejected/`, accepted originals in `incoming/accepted/`:
14 thumbnail-sized files (126×168 to 516×387), 2 watermarked Alamy stock photos,
and a watermarked depositphotos flat lay. A sixth flat-lay candidate was also
rejected — an Instagram carousel screenshot whose next-arrow chevron is burned
in **on top of the t-shirt**, the same defect that dropped `flat-lay-layered-01`.

**Worth adding next**, in value order: more of the user's **own** camera photos
at full resolution (only one in the set, and it is the fixture that found the
EXIF bug); a second **EXIF-rotated** photo, ideally orientation 8, since one
regression fixture for a bug that silently destroyed every cutout is thin; and
a **tie worn under a jacket collar**, the framing where a tie is smallest.

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

### Phase 2 — Soak and tune on real photos ⚠ Mostly done (2026-07-31)
**Depends on:** Phase 1.

Miss and false-positive rates are quantified and every config change is recorded,
so the done-condition is met — but on 15 cases, not ~25, and one item below is
still open (`pairGroup`). `bench-vision.ts` gained `prec` and `unmatched` columns
plus item-weighted totals to make this measurable at all.

**Final state, all 25 cases** (`clothing,shoe,bag,accessory,tie`, label prompt
`vision-label-2`, EXIF normalisation on):

| | Phase 1 config | final |
|---|---|---|
| Recall | 0.918 (78/85) | **0.976** (83/85) |
| Precision | >=0.867 (78/90) | >=0.865 (83/96) |
| Mean IoU | 0.759 | 0.759 |
| Striping guard | 0 | **0** |
| Median latency | 6.5 s | 6.8 s |
| Cost | $0.006/photo | $0.010/photo |

Recall 0.918 → **0.976** at +$0.004/photo, precision flat. The extra spend is
two concept phrases (`bag`, `tie`) that each recover items nothing else sees.

**Only two items in 85 are now missed**, and one is not really a miss:

| case | item | best IoU | what it is |
|---|---|---|---|
| `flat-lay-loafers-glasses-01` | tortoiseshell glasses | 0.00 | genuine — no region proposed |
| `worn-polo-belt-trousers-01` | black smartwatch | 0.14 | detected as `Black Watch`; boxed on the face, ground truth includes the strap |

So the one true remaining blind spot is **glasses**. Judge small accessories on
recall, not IoU — at that size a tight-vs-loose box swings IoU past the 0.3
threshold on its own.

**`SEGMENT_MIN_SCORE` was re-examined and deliberately left at 0.55** — see
Locked decisions. Nothing in the measured failure set argues for changing it.

**Finding 3 — the false positives are fragmentation, not hallucination.**
Across all 15 cases the pipeline returned **zero non-garment objects**. The
lamp, ceramic vase, coffee cup, books, nightstand, knit throw, Bleu de Chanel
bottle, hand, vase, side table, hangers, bedding and carpet in the fixtures were
all correctly rejected by `isGarment`. Every false positive was instead a *part
of a real garment* returned as its own item: `Grey Waist Portion Trousers`,
`Blue Plaid Shirt Sleeve`, `Crossbody Bag Strap`.

This reframes the knob. Precision here is not an `isGarment` problem and not a
score-threshold problem — it is a *grouping* problem, which is why the fix went
into `pairGroup` rather than `isGarment`. Generalising `pairGroup` from "two
halves of one item" to also cover "a part and its whole" removed 2 of the ~5
fragments and cost no recall. The rest persist; see Finding 2.

**Finding 4 — `bag` was removed on good-looking evidence, and that was wrong.**
Keep this one; it is the most transferable lesson in the phase.

The removal A/B covered the only three bag cases then in the set, all crossbody
bags worn on a dressed person. Recall was 16/16 with and without `bag`, so it
read as pure waste and was dropped to save $0.002/photo. The caveat written at
the time — "all three are crossbody bags, re-test before extending this" — was
correct, and the re-test inverted the result:

| case | without `bag` | with `bag` |
|---|---|---|
| `single-tote-01` | 0.00 | **1.00** |
| `single-backpack-01` | 0.00, **0 raw regions** | **1.00**, IoU 0.89 |
| `single-handbag-01` | 0.00, **0 raw regions** | **1.00**, IoU 0.92 |

Not low scores — *no regions at all*. `clothing` finds a bag hanging off an
outfit; nothing but `bag` finds a bag on its own. **The generalisable point: a
concept phrase measured only on fixtures where another phrase already covers the
item will always look free to delete.** Before removing one, check the eval set
actually isolates it.

**Finding 6 — `tie` added; the threshold was ruled out as the cause.**
`single-tie-01` puts a tie alone, filling the frame, and it returned **0 raw
regions**. Two probes:

- `SEGMENT_MIN_SCORE` 0.55 → **0.05**, eleven times lower: still 0 regions. The
  threshold is not what gates these misses, which settles the Phase 2 brief's
  question about that knob (see Locked decisions).
- Adding a `tie` phrase: `single-tie-01` 0.00 → **1.00** (IoU 0.94) and
  `flat-lay-tie-knit-01` 0.80 → **1.00**, both at precision 1.00 with no new
  false positives.

Phase 1's "prefer the general term" still holds where a general term works —
`accessory` simply does not cover ties, so this is the case for a specific one.

**Finding 7 — EXIF orientation destroyed every cutout, silently.** Found by the
first real camera photo in the set. Full write-up in Locked decisions; the short
version is that fal honours EXIF rotation and sharp does not, so boxes and mask
math disagreed by 90°, and the run reported nine confidently-named items whose
cutouts were bathroom wall. Fixed in `normalizeImage()`; `worn-suit-mirror-01`
now scores recall 1.00 and is the regression fixture.

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

**Finding 2 — `pairGroup` still does not merge a clipped pair. STILL OPEN.**
In `worn-suit-twopiece-01` the two brown loafers still come back as two items,
and the `vision-label-2` prompt did not fix it despite explicitly telling the
model that a frame-clipped half is the same pair. The three *unclipped* pairs
added on 2026-07-31 (`flat-lay-loafers-glasses-01`, `flat-lay-wood-halfzip-01`,
`flat-lay-navy-sneakers-01`) all merge correctly and score recall 1.00 on
footwear — **so clipping is confirmed as the trigger**, which was only a guess
before. That is the thing to attack next, still in the prompt, not geometry.

Note `scanPhoto` does not emit `pairGroup` in its output, so the bench can only
observe the merged result, not whether the model set the field. Instrument it
before the next attempt or you will be debugging blind.

**Finding 5 — the misses are always at the SEGMENT stage, never the label
stage.** Every recall failure across all three phases has the same shape: SAM 3
proposes no region, so nothing downstream can recover it. Footwear before
`shoe`, accessories before `accessory`, standalone bags before `bag` was
restored, ties before `tie`. **The diagnostic is the `raw` column** — when `raw`
sits at or below `items` on a case that is missing something, it is a
segmentation gap and no amount of label-prompt work will touch it. Glasses are
the one instance still open.

The old known issue — the single-garment fixture yielding a false-positive
fabric sliver labelled "Blue Top" — **remains unreproducible and is now largely
answered.** That fixture (`single-blazer-01`) was replaced in Phase 1;
`single-turtleneck-01` still scores recall 1.00 from 1 raw region with the hand,
vase and side table correctly rejected. More to the point, Finding 3 shows the
whole *class* of error — a non-garment sliver named as a garment — did not occur
once in 15 cases. The one sliver-shaped detection
(`flat-lay-navy-sneakers-01`, a 53×6% strip labelled `White T-shirt`) is a real
layered garment the manifest omits on purpose. Treat the "Blue Top" bug as
resolved by the `isGarment` prompt rather than merely unverified — while noting
`single_garment` is still n=1, which is too thin to call a rate.

**Done when:** false-positive and miss rates are quantified on the Phase 1
manifest, and any threshold change is recorded in this file. ✅ Done at n=25 on
2026-07-31. Still open and worth a follow-up: **Finding 2** (`pairGroup` will
not merge a frame-clipped pair) and the glasses blind spot.

---

### Phase 3 — Retire the legacy client-side throttling ✅ Done (2026-07-31)
**Depends on:** Phase 0. Independent of 1 and 2.

**The original premise here was wrong, and measuring first is what caught it.**
This phase assumed the 600 ms client pace was the thing holding a backfill back.
Measured against the live endpoint, `/api/cutout` under `sam3` takes **~9.7 s
median** (8–24 s observed), so `PACE_MS` was about **6% of cycle time**.
Deleting it is a rounding error. The endpoint's 60/min rate limit is not binding
either — at ~10 s a cutout the client sits near 6/min.

The only lever that moves the number is overlapping requests. Measured, same
four items:

| concurrency | wall | throughput | per-item latency |
|---|---|---|---|
| 1 (before) | 40.8 s | 1.00× | ~10.2 s |
| 2 | 30.9 s | 1.32× | ~15.2 s |
| 3 | *shipped* | — | — |
| 4 | 23.5 s | 1.74× | ~18.8 s |

Scaling is **sublinear** — 4× the concurrency buys 1.74×, and per-item latency
roughly doubles — so something upstream saturates (fal-side queueing, or the
local sharp compositing serialising on the event loop) and past ~3 you are
buying latency rather than speed. Shipped at 3.

What changed:
- `/api/cutout` now returns **`detectionSource`** (`sam3` | `legacy`) beside the
  cutout, so the client learns the pipeline from a request it was making anyway
  rather than probing a capability endpoint. A client that ignores the field, or
  a server too old to send it, both keep the conservative legacy behaviour.
- `cutoutBackfill.ts` starts single-flight and paced — the only safe assumption
  against a `legacy` inference gate — then adapts once a response identifies the
  pipeline: `legacy` unchanged, `sam3` drops the pause and opens to 3 in flight.
- With several requests in flight the cursor advances over the completed
  **contiguous prefix** only. Persisting the highest finished id would skip an
  item still in flight below it if the app died mid-run.
- Backoff and the failure cap are retained on both paths. `sam3` returns no 503,
  but the abuse rate limit still returns 429 and is handled identically.

**Done when:** a large-closet backfill runs materially faster on `sam3` and is
unchanged on `legacy`. ✅ ~1.7× on `sam3`; `legacy` provably untouched by test
(`stays single-flight on the legacy pipeline`).

**Worth a follow-up:** find out *why* concurrency scales so poorly. If the
~9.7 s per cutout is mostly fal queueing on our account, that is the real
ceiling and it dwarfs everything this phase touched.

---

### Phase 4 — Cost visibility ✅ Done (2026-07-31)
**Depends on:** Phase 0. Independent of the rest.

`scripts/show-ai-spend.ts` reports spend per endpoint (or `--by model`) over a
date range, reconciling the ledger's two row shapes: per-call rows carry an
exact `cost_usd` written by `server/vision/cost.ts`, token rows are costed from
a `TOKEN_PRICING` table.

```sh
./node_modules/.bin/tsx --env-file=.env scripts/show-ai-spend.ts --from 2026-07-01 --to 2026-07-31
```

Two things worth knowing before touching it:

**`cachedTokens` is a subset of `promptTokens`, not a sibling.** The Anthropic
adapter deliberately normalises to OpenAI semantics
(`server/llm/providers/anthropic.ts`), so costing `promptTokens × inputRate`
bills the cached portion twice over at up to 10× its real price. The script
splits them. (Known approximation: Anthropic cache *writes* land in
`promptTokens` but not `cachedTokens` and cost 1.25×, so they read slightly
low — small next to per-call vision spend and not worth a schema change.)

**An unpriced model is reported, never costed at zero.** Models absent from
`TOKEN_PRICING` are excluded from the total and listed separately with their
call and token volumes. A cost report that silently prices unknown models at
zero is worse than no report, because it reads as authoritative — this is the
same silent-failure shape as the EXIF and striping bugs in Locked decisions.

OpenAI and Google models are deliberately left unpriced rather than guessed:
they are the largest token consumers in the ledger (~1.5M tokens across
`gpt-4o-mini`, `gemini-3.6-flash`, `gpt-4.1-mini`), so a wrong number there
would dominate the report. Fill them in from the provider pricing pages and
they light up with no other change.

First run, 2026-06-01 → 2026-08-01: **$1.85 total** — $1.74 per-call
(`vision/scan/segment` $1.31, `vision/prettify` $0.23, `vision/cutout` $0.19),
$0.11 token-billed, with 316 calls flagged unpriced.

**Done when:** one command reports spend per endpoint over a date range,
including scan and prettify. ✅

---

### Observability — the soak precondition ✅ Done (2026-08-01)
**Depends on:** Phase 0. **Blocks:** any meaningful soak, and therefore Phase 5.

`scanPhoto` already computed everything needed to detect a regression, and
`routes.ts` already logged it — to `console.info`, where nothing read it. There
is no Sentry, Datadog or metrics anywhere in the server. `labelError` is the
sharpest example: it exists *specifically* to stop a 429 degrading into an
indistinguishable "0 garments found", and it was write-only. Same shape as
`cost_usd` before Phase 4.

Flipping `VISION_PIPELINE=sam3` without this would have been soaking blind —
every failure this pipeline has produced so far was silent (see Locked
decisions), so "no complaints" would not have meant "no problem".

- **`scan_telemetry`** (migration `0028`) — one row per scan, distinct from
  `ai_token_log`, which is one row per *model call*. Written on the sam3 happy
  path, the sam3 throw path (an outage otherwise reads as a dip in volume, not
  as errors), and the legacy path, so a soak compares pipelines on one table.
  Fire-and-forget with a swallowed error: the code that reports failures must
  not be able to cause one.
- **`scripts/show-scan-health.ts`** — summary by pipeline, day-over-day (so a
  regression arriving with a deploy shows as a step change rather than being
  averaged away), and the most recent failures with a diagnosis.

The diagnosis follows Phase 2's Finding 5: **`raw_count` vs `item_count` is the
signal.** `raw=0` is a segmentation gap that no label-prompt work can fix (the
shape that hid ties and standalone bags); `raw>0, items=0` is labelling
rejecting everything, and `label_error` says whether that was deliberate or a
failure. Verified live — a garment-free photo was correctly reported as
`no regions proposed (segmentation gap)`, not as a labelling rejection.

```sh
./node_modules/.bin/tsx --env-file=.env scripts/show-scan-health.ts --days 7
```

**Still blind:** the striping guard (`alphaLooksStriped`) lives in
`scripts/bench-vision.ts`, not in the production path, so shredded alpha would
still ship unseen. Moving it would mean an alpha scan on every cutout — a real
CPU cost per scan, and a deliberate deferral rather than an oversight. The
health script says so in its own output.

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
