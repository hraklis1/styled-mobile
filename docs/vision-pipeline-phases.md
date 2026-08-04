# Vision Pipeline — Phase Handoff

Cross-repo work: `Styled-mobile` (this repo) and the sibling backend `../Styled`.
Both on `main` — the `experiment/photo-algorithm` branch was merged and deleted
on 2026-08-02, so everything here is normal `main` work now.

This file exists so each phase can be picked up in a **fresh session** without
re-deriving context or quietly re-deciding something that was already settled.
Read "Locked decisions" before changing anything; it is the part that prevents
drift. If a phase forces you to break a locked decision, say so explicitly and
update this file in the same change — don't silently diverge.

---

## Where things stand (2026-08-02)

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

**Polish** regenerates one garment as a catalog flat-lay
(`POST /api/items/:id/polish`), quota'd, writing to its own `polished_url`
column. It shipped under a different name, dropped on 2026-08-02 because that
name is another app's trademark; `migrations/0029_rename_to_polish.sql` carries
the columns and the cost-ledger rows over. Migration 0027, which created them
under the old name, is left as-is — it is the record of what was applied.

### Status by area

| Area | State |
|---|---|
| `../Styled/server/vision/` | Built, typechecks, benched, simulator-verified |
| Migrations | 0027 (cost + Polish columns), 0028 (`scan_telemetry`), 0029 (Prettify→Polish rename). **All three applied to the DB**, rename verified against `information_schema` on 2026-08-02 |
| Both repos | Phases 0–5 committed and **pushed to `origin/main`**. Working trees clean |
| Pipeline | **`sam3`, and now the only one.** Phase 5 removed the legacy branch and the `VISION_PIPELINE` lever on 2026-08-02; the rollback is `git revert` |
| Eval set | **25 labelled cases / 85 items**, recall 0.988 / IoU 0.759 / precision >=0.866 (2026-08-02). Phase 1 target met |
| `python_service` | **Deleted (2026-08-02).** Every endpoint it served now runs in `server/vision`. `start.sh` launches one process; there is no venv, no ONNX, no MediaPipe, no 60s health-check wait |
| Localisation | **One SAM 3 path for both pipelines** — the closet scan and the outfit log call the same `scanPhoto`. No LLM-estimated bounding boxes anywhere |

---

## De-conflating the axes (2026-08-04)

`style` was doing three jobs. `bottom/Denim` listed `Slim Fit, Straight Leg,
Skinny, Relaxed Fit, Wide Leg, Bootcut, Flared, Cropped` — every one of them
also a value in `FIT_OPTIONS_BY_CATEGORY.bottom`. `top/T-Shirts` listed
`Crew Neck` and `V-Neck` (necklines), `Oversized`, `Fitted` and `Longline`
(fits), and `Graphic` (a pattern).

**The same fact could be stored in either of two columns, and whichever one the
user did not fill stayed null.** The live data proves it: of the 7 rows whose
style no longer exists in the tree, **5 already hold the identical value in the
correct column**. One (`id=34`, `Denim/Flared`) had `fit = "Fitted"` — which is
not even a legal bottom fit — while the style column held `Flared`, the right
answer, in the wrong place.

The rule applied: **a value that names a garment you would buy is a `style`; a
value that names a property of a garment belongs to its own facet.** So
`Pocket Tee`, `Polo`, `Henley`, `Turtleneck` and `Crewneck Sweater` stay — they
are nouns for things you own — while bare `Crew Neck`, `Wide Leg` and `Graphic`
move out.

`shoes/Sneakers/Running` and `shoes/Athletic Shoes/Running Shoe` were the same
garment in two branches; merged into the latter.

**Nothing is dropped on the floor.** `snapToTaxonomy` now returns a `recovered`
facet alongside `{subcategory, style}`: anything that fails to snap to a style
is offered to `fit`, `neckline` and `pattern`, and the sanitizer uses it only
where the model gave that field nothing directly. This is deliberately *not* a
retirement table — a general rule survives the next tree change, and the model
will keep answering "wide leg" because that is how garments are sold.

A facet value in the style slot also yields `style: null`, never `"Other"`.
`"Other"` asserts the item HAS a style outside the list, which is a different
claim from "that word belongs in another column".

**Two deviations from the plan, both deliberate:**

- The plan said `Polo`, `Henley`, `Turtleneck` and `Mock Neck` would come *out*
  of `NECKLINE_OPTIONS`. They did not. A shirt can have a polo collar without
  being a polo shirt and a dress can have a turtleneck neckline, so removing
  them loses real expressiveness while fixing nothing measurable. The harmful
  overlap was style-vs-fit and style-vs-bare-neckline, not these.
- `bottom/Denim` was going to be left thin. It got `Raw / Selvedge`, `Acid Wash`
  and `Coated` — genuine denim identities, not fit values under new names.
  `top/T-Shirts` is down to four and is honestly thin: most "t-shirt styles"
  really *are* the facets.

**Extraction accuracy is unchanged, and confirming that took two runs.** The
first post-change run read 94.9% against 96.6%, which looks like a regression
and is not: a re-run returned exactly 96.6%. The swing is ±2 items on `pattern`,
entirely on textured-but-single-colour things (a heather hoodie, ribbed socks,
a woven belt) where `Solid` versus `Textured` is genuinely arguable and my
ground-truth labels chose `Solid`. This is the same non-determinism recorded in
Finding 2 — **do not read one bench run as a regression.**

The runs did surface one real gap, consistently and with different values each
time: `MATERIAL_OPTIONS` was garment-fabric only, so a watch case, sunglasses, a
straw hat and a canvas tote had no describable material. Nine non-textile values
were added; `Canvas` was the clearest case, since `Canvas Belt` is already a
style in the accessory branch. **That closed it — material off-vocabulary went
1.2% → 2.4% → 0.0%**, and every field is now clean.

Three runs, for the record:

| | scalar overall | material off-vocab |
|---|---|---|
| run 1 | 94.9% | 1.2% (`Resin`) |
| run 2 | 96.6% | 2.4% (`Canvas` ×2) |
| run 3, materials added | **97.5%** | **0.0%** |

Three misses remain in the whole run: one category (pink checked bottoms on a
rail read as a top), one sleeve length, and one `Solid` vs `Textured`.

---

## Vocabularies: one source of truth (2026-08-04)

`../Styled/shared/attributes.ts` is now the only definition of every garment
attribute vocabulary — pattern, fit, neckline, material, seasons, occasions,
colours, warmth, sleeve length, condition, care. It has **zero imports**, and
that is load-bearing: it is mirrored byte-for-byte to `src/lib/attributes.ts`
here, and `npm run check:vocab` in the backend fails when the two diverge.

**That check is the entire price of keeping the repos decoupled.** It is
verified to fail, not just to pass — both halves were tested by injecting real
drift (a `"Checkered"` spelling into the mirror, a `"Bobble Hat"` style into the
mobile taxonomy). It compares `attributes.ts` and `sizes.ts` by bytes and the
taxonomy tree by value, because the backend taxonomy legitimately also carries
`snapToTaxonomy`.

Where the copies used to live, and what each was doing wrong:

| was | now |
|---|---|
| `EditItemModal.tsx` owned the whole `fit` vocabulary | imported |
| `ALLOWED_*` in the scan sanitizer | aliases of the shared lists |
| The scan prompt restated them in prose | **generated** from the module |
| `wardrobeOptions.ts` (web) had `["summer","winter","spring_fall","all"]` | imported — this was the source of the ten `spring_fall` rows |
| `ScanItemDialog.tsx` offered a "Fall/Spring" pill writing `spring_fall` | derived |
| `shared/routes.ts` declared the scan response's seasons as `summer\|winter\|spring_fall` | `z.enum(SEASON_OPTIONS)` |

The scan response contract was also missing `sleeveLength`, `notableDetails` and
`bbox` entirely — three fields the endpoint has always returned.

**Fixing the web client mattered more than it looks.** Without it, the Phase 6
migration that cleans up `spring_fall` would have been undone by the next item
saved from the web.

---

## Attribute extraction — baseline (2026-08-04)

Everything above measures **localisation**: was the garment found, was the box
right. Attribute extraction — the stage that fills every column in the closet —
was covered by no eval at all, which is why a cap recorded as a sun hat and a
striped shirt recorded as checked both reached the database looking healthy and
were found weeks later by eye, in a generated image.

`scripts/bench-attributes.ts` closes that. It crops each item from its
**hand-labelled ground-truth bbox** and calls the extractor on it, so a bad score
is an extraction failure and never a segmentation one. Read it as an upper bound
on production: "how well do we describe a garment we cropped correctly."

```sh
npx tsx scripts/bench-attributes.ts --manifest eval/scan/manifest.json --out /tmp/attr
```

| field | labelled | baseline | after one source of truth |
|---|---|---|---|
| category | 85 | 98.8% | 98.8% |
| subcategory | 10 | 100% | 100% |
| style | 4 | 100% | 100% |
| neckline | 3 | 100% | 100% |
| material | 1 | 100% | 100% |
| sleeveLength | 6 | 83.3% | 83.3% |
| **pattern** | 9 | **66.7%** | **77.8%** |
| scalar overall | 118 | 95.8% | **96.6%** |

**Off-vocabulary is the number that moved most, and it went from unmeasurable to
zero.** At baseline it read 0% on every field that had a server-side vocabulary
and `n/a` on four that did not — **pattern, fit, neckline and material were
enumerated only in the mobile client**, so nothing could check them and a value
the app's own picker cannot display reached the column unchallenged. After
`shared/attributes.ts`, with the prompt generated from it rather than restating
it, all four report **0.0% across 85 items**.

That distinction matters more than the accuracy delta. A wrong-but-legal value
costs the user one tap in the review UI; an off-vocabulary value renders as *no
selection at all* and no filter will ever match it. `pattern`'s one recovered
miss was exactly this — the model said `"Graphic"` where canon is
`"Graphic / Print"` — and the two that remain are genuine perception
disagreements about whether a small embroidered logo makes a garment
`Graphic / Print` rather than `Solid`. All four remaining misses across the whole
run are now perception, not vocabulary.

**The cap bug does not reproduce, and that is now measured rather than asserted.**
Fed the crop with a deliberately wrong detection guess, the extractor corrects it:

```
poison="Sun Hat"          -> Hats & Headwear / Baseball Cap
poison="White Bucket Hat" -> Hats & Headwear / Baseball Cap
poison=null               -> Hats & Headwear / Baseball Cap
```

That is commit `43088c2`'s rewrite of the target hint from a decision to obey
into a region pointer to correct, working. `worn-hat-tee-01` carries a genuine
bucket hat and `flat-lay-carpet-cap-belt-01` a genuine baseball cap, so the pair
tests the distinction in both directions.

**Two traps, both hit while building this:**

- **The EXIF trap again, one level down.** `metadata()` on an unresolved
  `sharp().rotate()` pipeline reports the **stored** dimensions, not the rotated
  ones, so measuring from the pipeline transposes W and H on any portrait phone
  photo. The first baseline scored `worn-suit-mirror-01` at 3/5 on category with
  one crash; the crops were wall and carpet. Rotate to a buffer, *then* measure.
  Same fixture, same bug shape, third time — see Finding 7.
- **Coverage is 12 attribute-labelled items across 4 cases**, not 85. Every
  unlabelled field is skipped, never scored as a miss, so `subcategory 100%` means
  10 for 10 — not that subcategory is solved. `category` is the only field
  labelled on all 85. Worth labelling next, in value order: the two two-piece
  suit cases (the only formal fixtures), a bottom with an unambiguous fit, and
  more of `worn-suit-mirror-01`, the sole photo from the user's own camera.

---

## Locked decisions

Settled with evidence. Do not re-open casually.

**Rollout**
- **There is no `VISION_PIPELINE` lever, and there is no env-var rollback.**
  It defaulted to `sam3` on 2026-08-01 and was deleted in Phase 5 on
  2026-08-02 together with the Python stack it selected. `sam3` is not the
  default pipeline; it is the only one.
  <br>*This entry used to say "setting `legacy` is the rollback lever — keep it
  working", and that survived here for a while after it stopped being true.
  Worth noticing how it read: a stale line in the section headed "do not
  re-open casually" is more dangerous than a stale line anywhere else in this
  file, because it is the part written to be obeyed without re-checking. If you
  are reaching for a rollback mid-incident, the answer is `git revert`, not an
  environment variable.*
- A deployment that still sets `VISION_PIPELINE` gets a **one-time startup
  warning** saying the variable no longer does anything. That is deliberate: a
  flag that is silently ignored lets someone believe they rolled back.
- The `/api/scan-vision-pose` response is **byte-compatible** with the Python
  service's shape. That contract is why the mobile client needed no changes,
  and it still holds — keep it. Breaking it means touching `ScanItemSheet`,
  `BatchScanSheet` and the backfill.

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
  always look free to delete. `glasses` (2026-08-02) is the third phrase added
  for this exact reason, after `bag` and `tie`. Default is
  `clothing,shoe,bag,accessory,tie,glasses`.
- Pairs (left/right shoe) are merged via the labeller's `pairGroup`, **not**
  geometry. Hand-tuned size/adjacency heuristics are exactly what made the old
  pipeline unmaintainable. Verified merging clipped and unclipped pairs alike on
  2026-08-02; `ScanItem.pairGroup` / `.regionCount` and the bench's `merged` /
  `orphanPg` columns exist so this stays observable.

**Models**
- **BiRefNet is off on purpose.** Measured worse than SAM 3's instance masks —
  halo on crops, alpha bleed through garment interiors. `MATTE_REFINE=birefnet`
  re-enables it as an intersection (can only remove pixels).
- **Polish uses `fal-ai/nano-banana/edit`, sourced from the ORIGINAL photo.**
  Qwen-Image-Edit (Apache 2.0) turned a plain heather-grey crewneck into a teal
  colour-blocked sweatshirt with invented lettering. It stays selectable via
  `POLISH_MODEL` for anyone who needs open weights.
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
- `polished_url` is a **third** column. Never overwrite `cutout_url` or
  `image_url` — Polish is generative and the faithful cutout must survive it.
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

### Phase 2 — Soak and tune on real photos ✅ Done (2026-08-02)
**Depends on:** Phase 1.

Miss and false-positive rates are quantified and every config change is recorded.
`bench-vision.ts` gained `prec` and `unmatched` columns plus item-weighted totals
to make this measurable at all, and on 2026-08-02 `merged` / `orphanPg` to make
the pair-merge step observable (see Finding 2).

**Final state, all 25 cases** (`clothing,shoe,bag,accessory,tie,glasses`, label
prompt `vision-label-2`, EXIF normalisation on):

| | Phase 1 config | 2026-07-31 | final (2026-08-02) |
|---|---|---|---|
| Recall | 0.918 (78/85) | 0.976 (83/85) | **0.988** (84/85) |
| Precision | >=0.867 (78/90) | >=0.865 (83/96) | >=0.866 (84/97) |
| Mean IoU | 0.759 | 0.759 | 0.759 |
| Striping guard | 0 | 0 | **0** |
| Median latency | 6.5 s | 6.8 s | 9.5 s |
| Cost | $0.006/photo | $0.010/photo | $0.012/photo |

Recall 0.918 → **0.988** at +$0.006/photo, precision flat throughout. The extra
spend is three concept phrases (`bag`, `tie`, `glasses`) that each recover items
nothing else sees.

Treat that median latency with suspicion rather than as a regression: the
2026-08-02 run coincided with the labelling provider shedding load (see
"Provider flakiness" below), and `segMs` moved with it on the same cases whose
config did not change. `glasses` is one more concurrent SAM 3 call, not a serial
one.

**One item in 85 is now missed, and it is not really a miss:**

| case | item | best IoU | what it is |
|---|---|---|---|
| `worn-polo-belt-trousers-01` | black smartwatch | 0.14 | detected as `Black Watch`; boxed on the face, ground truth includes the strap |

**The glasses blind spot is closed** (2026-08-02). `accessory` already caught
sunglasses *on a face* — both worn fixtures returned them — but a folded pair
lying in a flat lay was proposed by nothing at all: the standalone-bag and tie
failure shape for the third time. Adding `glasses` took
`flat-lay-loafers-glasses-01` from recall 0.80 to **1.00** at precision 1.00,
with the pair coming back as `Tortoiseshell Eyeglasses` and **13 → 13 unmatched
predictions across the whole set**, i.e. no precision cost that the eval can see.

That is now three phrases added for the same reason. The generalisation worth
keeping: **`accessory` covers a category worn, not the same category alone in
frame.** Expect the next gap to look identical, and reach for the `raw` column
before touching prompts.

Judge small accessories on recall, not IoU — at that size a tight-vs-loose box
swings IoU past the 0.3 threshold on its own.

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
fragments and cost no recall.

The rest persist, and they are the whole of the remaining precision gap:
`Crossbody Bag Strap` and `White Shirt Collar` were both still standing alone on
2026-08-02, with `pairGroup` null rather than pointing at the garment they
belong to. Note this is the *part-and-whole* half of `pairGroup` — the
*two-halves-of-a-pair* half works (Finding 2). Whether it is worth closing is a
judgement about one extra tap in a review UI, not a correctness question.

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

**Finding 2 — the clipped-pair merge failure did not survive instrumentation.
CLOSED (2026-08-02), and the lesson is about the measurement, not the model.**

The instrumentation was built first, exactly as the previous note demanded:
`ScanItem` now carries `pairGroup` (the labeller's raw answer, unrenumbered) and
`regionCount` (how many SAM 3 regions were fused), and `bench-vision.ts` reports
`merged` and `orphanPg`. Those two columns separate the failure modes the merged
item list cannot: the model never setting the field (both columns 0) from the
model setting it but splitting one pair across two numbers (`orphanPg` > 0).

With that in place the bug would not reproduce. `worn-suit-twopiece-01` was run
**5 times** and merged both pairs every time — including the brown loafers at the
very bottom edge, which are the frame-clipped pair the finding was about:

```
Black Dress Shoes   pg=1  n=2
Brown Loafers       pg=2  n=2     ← clipped at y=96..100%, merged anyway
```

Across the full 25-case set, `orphanPg` is 0 on 24 cases and 1 on one, and every
footwear pair merges. So `vision-label-2` does handle clipping; the earlier
conclusion came from watching the merged output, where "not grouped" and
"grouped wrongly" look the same. **Do not re-open this on a single-run
observation** — check `merged` / `orphanPg` first, and re-run, because the
labeller is non-deterministic and the previous finding is what that looks like.

**Finding 5 — the misses are always at the SEGMENT stage, never the label
stage.** Every recall failure across all three phases has the same shape: SAM 3
proposes no region, so nothing downstream can recover it. Footwear before
`shoe`, accessories before `accessory`, standalone bags before `bag` was
restored, ties before `tie`. **The diagnostic is the `raw` column** — when `raw`
sits at or below `items` on a case that is missing something, it is a
segmentation gap and no amount of label-prompt work will touch it. Glasses were
the last open instance and are closed as of 2026-08-02; **no known segmentation
gap remains**, which means the next one will be a class the eval set does not
cover rather than one it does.

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

**Provider flakiness — an operational finding, not a pipeline one (2026-08-02).**
Across ~35 scans during this session the `tagging` provider (`google` /
`gemini-3.6-flash`) returned **503 "high demand"** on roughly 1 call in 8, in
bursts: 2 of 3 consecutive single-case runs at one point, then 1 of 25 on a full
sweep half an hour later. Nothing here is wrong — `labelError` caught every one,
the bench refused to score those cases and exited non-zero, and the user-facing
path degrades to an empty scan rather than an error. But it is the first
measured evidence of how often that happens, and it means:

- **A soak will see empty scans that are not regressions.** `label err` in
  `show-scan-health.ts` is the column that separates them; a rise in `empty
  scans` with `label err` flat is a real regression, and the two moving together
  is the provider.
- **Bench runs need re-running, not interpreting, when a case reports
  `LABEL_ERR`.** Comparing two sweeps with different label-failure counts also
  changes the denominator — the 2026-08-02 baseline scored 80 items and the
  `glasses` run 85 for exactly this reason.
**Retry landed 2026-08-02**, in `server/llm/index.ts` rather than in the vision
code — `completeStructured` is the single chokepoint every non-streaming call
goes through, so tagging, stylist and summarization all get it at once.

- Retries 408/409/429/5xx and connection-level errors; **never** 4xx like a bad
  schema, where a retry only spends the same money twice.
- Two retries by default (`LLM_MAX_RETRIES`, 0 disables), honouring `Retry-After`
  when sent and otherwise backing off exponentially **with jitter** — a scan's
  label pass runs concurrently with other calls, and retrying in lockstep would
  re-spike the load that caused the 503.
- `completeStream` is deliberately excluded: by the time most stream failures
  surface, tokens are already on the wire and restarting would duplicate them
  mid-sentence. Retrying there means buffering to the first chunk, a separate
  change.
- Verified by injecting the failures, since a 503 burst cannot be summoned on
  demand: `scripts/check-llm-retry.ts` covers recovery, non-retry of 400,
  rethrowing the original error when exhausted, `limit 0`, connection errors,
  the untouched happy path, and `Retry-After`. 7/7.

This changes how `label err` reads: it now counts calls that failed *after* the
retry gave up, so a rise there means the provider is down rather than busy.
Transient 503s that recovered appear only in the server log.

**Done when:** false-positive and miss rates are quantified on the Phase 1
manifest, and any threshold change is recorded in this file. ✅ Done at n=25 on
2026-07-31, and the two follow-ups it left — Finding 2 and the glasses blind
spot — are both closed as of 2026-08-02.

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
(`vision/scan/segment` $1.31, `vision/polish` $0.23, `vision/cutout` $0.19),
$0.11 token-billed, with 316 calls flagged unpriced.

**Done when:** one command reports spend per endpoint over a date range,
including scan and polish. ✅

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

**The diagnosis columns are sam3-only, and used not to be (fixed 2026-08-02).**
The legacy proxy exposes no raw region count, so `routes.ts` writes `raw_count:
0` for every legacy scan — which the report then read as "no regions proposed
(segmentation gap)". The first real comparison showed **27 of 27 legacy scans
diagnosed as segmentation gaps while averaging 3.3 items found**. A diagnosis
column that fires on healthy rows is worse than no column at all, exactly the
authoritative-looking-but-wrong shape as costing unpriced models at zero, so
`no regions` now reports `—` on legacy and the per-failure line says the proxy
reports no stage detail. The comparable legacy columns are scans, avg items,
empty scans and latency.

**Still blind:** the striping guard (`alphaLooksStriped`) lives in
`scripts/bench-vision.ts`, not in the production path, so shredded alpha would
still ship unseen. Moving it would mean an alpha scan on every cutout — a real
CPU cost per scan, and a deliberate deferral rather than an oversight. The
health script says so in its own output.

---

### legacy vs sam3 — measured at last (2026-08-01)

Every quality number in this document had been **sam3 in isolation**. The claim
that it beats `legacy` was architectural — 2 model calls instead of 6–12, no
hand-tuned geometry — and nobody had run the comparison.

**The tool for it already existed:** `scripts/bench-vision.ts --legacy <url>`
calls the Python service on the same fixtures and scores it with the same
`scoreCase` matcher. Use it; do not write a second harness, because two
scorers that drift apart produce incomparable numbers.

```sh
npx tsx scripts/bench-vision.ts --manifest eval/scan/manifest.json \
    --legacy http://localhost:5001/scan-vision-pose
```

| | legacy | sam3 |
|---|---|---|
| Recall | 0.46 – 0.51 | **0.976** (83/85) |
| Mean IoU | ~0.48 | **0.759** |
| Median latency | **~8 s** | ~9.5 s |

**Roughly 2× the recall and 1.6× the IoU.** Legacy wins one column, being about
1.5 s faster at the median.

**Legacy is quoted as a range on purpose.** Two runs over identical fixtures
scored 0.506 and 0.459 and **disagreed on 10 of 25 cases** — its GPT-4o-mini
micro-passes are stochastic, so any single legacy number carries about ±5
points. sam3 returned 0.976 on three separate runs across two different code
paths (in-process bench, and HTTP through the route). Reproducibility is itself
part of the result: you can regression-test sam3 and you cannot really
regression-test legacy.

**Why the gap is what it is, and it is not a labelling-convention artifact.**
Legacy names items well and localises them barely at all. On
`worn-hat-tee-01` it returned the right three garments with these boxes:

```
Bucket Hat   x=10.0  y= 0.0  w=80.0  h=20.0
T-Shirt      x=10.0  y=20.0  w=80.0  h=40.0
Watch        x=70.0  y=30.0  w=10.0  h=10.0
```

Every value is round. That is a templated layout — hat in the top 20%, shirt in
the next 40% — not a measurement of the image. On `single-turtleneck-01`, one
garment filling the frame, it returned a 9%×10% box near the bottom edge
against a ground truth of 55%×74%. The classification is decent; the geometry
is largely synthetic, which is the "hand-tuned geometry heuristics" problem in
Locked decisions showing up as a number.

**This matters because boxes drive cutouts.** A template box crops the wrong
region, so the gap is not academic — it is what the user sees in their closet.
It also explains the non-determinism: when geometry comes from a template
chosen per photo rather than measured from it, which template gets chosen can
flip between runs.

Re-run the command above before Phase 5 — "can we delete the Python service
yet" is the same question, and it is already tooled.

---

### The flip ✅ Done (2026-08-01)

`sam3` became the code default once the pipeline could report on itself. Held
until then on purpose: with no production telemetry, "no complaints" would not
have meant "no problem" — every failure this pipeline has produced was silent.

Verified with **no `VISION_PIPELINE` set at all**: the scan returned 7 items
with `detectionSource: sam3`, and `scan_telemetry` recorded `pipeline='sam3'`.
The full resolution matrix was exercised — unset/empty/`sam3`/`SAM3`/` sam3 `
→ sam3; `legacy`/`LEGACY` → legacy; `legcy`/`nonsense` → legacy plus a
one-time warning.

**This was the code default only.** At the time, a deployment that explicitly
set `VISION_PIPELINE=legacy` was unaffected until the variable was removed.
*Superseded a day later: Phase 5 deleted the variable and the legacy path, so
setting it now only produces a startup warning.*

**Watch the rollout:**

```sh
./node_modules/.bin/tsx --env-file=.env scripts/show-scan-health.ts --days 7
```

`label err` and `empty scans` are the columns that move on a regression;
`no regions` vs `all rejected` says which half of the pipeline to look at.

~~Roll back by setting `VISION_PIPELINE=legacy` — no deploy required.~~
**No longer true.** Phase 5 removed the lever and the pipeline behind it; the
rollback is `git revert`. The monitoring command above is still correct.

---

### Phase 5 — Delete the Python detection stack ◐ TypeScript half done (2026-08-02)

**The soak gate was waived deliberately, and by whom matters.** The owner is the
only person testing the app, so waiting for production evidence would have meant
waiting for evidence that was never going to arrive. The decision was: open the
phase, accept that issues get troubleshot as they surface. Recorded here so
nobody later reads the missing soak as an oversight.

What made that defensible rather than reckless is that Phase 5's *own* stated
bar — "the bench shows parity or better" — was already cleared twice over
(recall 0.988 vs 0.46–0.51), and the deleted branch is one `git revert` away.

**Done — the routing layer no longer knows about Python detection:**

- `/api/scan-vision-pose` is `scanPhoto` unconditionally; the proxy to
  `python_service/scan-vision-pose`, including its ECONNREFUSED-retry, is gone.
- `/api/cutout` is `matteGarment` unconditionally; the 503 "Segmentation busy"
  passthrough went with it, since only the Python inference gate ever produced
  one.
- `VISION_PIPELINE` is retired. A deployment that still sets it now gets a
  startup warning instead of silence, because the failure mode of a lever that
  quietly does nothing is someone believing they rolled back.
- `detectionSource: "sam3"` is **kept** on the cutout response even though it is
  now the only possible value. Shipped clients read it to pace the backfill and
  fall back to conservative legacy pacing when it is absent, so removing it
  would silently slow every app already installed.

**The goal changed, because the original one was unreachable.** Phase 5 was
written as "the app runs with no Python service at all". Tracing callers on
2026-08-02 showed that cannot follow from deleting the detection stack: two live
features depend on code that was itself *on the deletion list*.

| endpoint | caller | needs |
|---|---|---|
| `/crop-items` | `/api/crop-items` + `/api/items/cropSingle` (web add-to-closet) | **MediaPipe pose machinery** — was on the deletion list |
| `/rescan-crop` | web `use-scan-item.ts` | **`gpt_classify_single_item`** + outfit extractor — was on the deletion list |

The note that `/crop-items` "may survive" understated it: both must, and so must
the service hosting them.

### What `python_service` is now

**A legacy microservice retained for exactly two web callers.** Not a component
of the vision pipeline — nothing in the scan or cutout path reaches it any more.
Read it as a holding pen: it exists so the web client's add-to-closet and
manual-recrop flows keep working, and it should shrink to nothing when a future
sub-phase ports those two endpoints to the hosted stack. Until then, treat any
code in it that is not reachable from `/crop-items` or `/rescan-crop` as dead
weight awaiting removal rather than as a working alternative to `server/vision`.

The mobile app does not call it at all.

### Deletion pass 1 — strictly dead code (2026-08-02)

The garment-gate calibration work that blocked this was abandoned as moot (the
gate it calibrates is no longer reachable in production) and stashed rather than
discarded — `git stash list` in `../Styled` still has it.

Removed, each verified as having no caller in either repo or the web client:

- **`/detect-and-crop`** and its request/response models — the TFLite
  EfficientDet / OpenCV contour detection path.
- **`/video/upload`** and the whole video pipeline behind it: `extract_frames`,
  `laplacian_blur_score`, `identify_items_with_gpt`, `normalize_items`,
  `deduplicate_items`, `frame_to_base64`, plus the now-unused `uuid`, `shutil`,
  `File` and `UploadFile` imports.
- In `processor.py`, the subsystem that only `/detect-and-crop` reached:
  `process_image`, `get_detector_source`, `np_to_b64_jpeg`, `detect_garments`,
  `person_to_garment_regions`, `_detect_mediapipe`, `_detect_tflite`,
  `_detect_selective_search`, `_detect_edges`, and `_pose_garment_regions`.

**993 lines gone.** `main.py` 3,329 → 2,920, `processor.py` 2,087 → 1,504.

Deliberately kept, because the surviving endpoints need them:
`pose_square_crop_for_category` and `_load_detector` (`/crop-items`),
`semantic_square_crop` and `sample_bg_np` (shared), and
`_pose_garment_regions_extended` (still referenced by the Python
`/scan-vision-pose`, which is dead but not yet removed — see below).

Verified: both files compile, `main.py` imports and exposes exactly
`/crop-items`, `/rescan-crop`, `/cutout`, `/scan-vision-pose` and `/health`, the
80 unit tests pass, and no dangling references remain. (`_np_to_b64_jpeg` in
`main.py` is a *different* function from the deleted `np_to_b64_jpeg` and is
still used.)

### Deletion pass 2 ✅ Done (2026-08-02)

Removed the Python `/scan-vision-pose` and `/cutout` endpoints and everything
that only they reached: the GPT identify / flat-lay / `_MICRO_*` prompts,
`_cv_flat_lay_boxes` and the watershed splitter, the dedup and NMS helpers, the
rembg sessions, `_INFERENCE_GATE` / `run_gated`, `MaskCache`,
`build_cutout_webp`, and — as whole files — `cutout_quality.py`,
`garment_gate.py` and `scan_pipeline_utils.py` with their tools and tests.

Done by reference count rather than by eye, iterating until the set was stable.
**Two lessons from doing it that way**, both worth keeping:

- A regex-based pass left `build_cutout_webp` alive on a single *docstring*
  mention in `garment_gate.py`. Counting identifiers from the parsed AST instead
  of the text is what actually finds dead code.
- The first pass nearly removed `_startup`, a FastAPI `@app.on_event` hook that
  is referenced by the framework and never by name. Any pruner has to excuse
  `app.*`-decorated definitions or it will delete the service's lifecycle.

`/health` was rewritten in the same pass. It reported ONNX session residency,
free inference slots and garment-gate mode — all describing machinery that had
just been deleted, and all of it a reliable way to send someone debugging in the
wrong direction.

### Porting the survivors

**`/rescan-crop` ✅ ported (2026-08-02)** to `server/vision/identifyCrop.ts`.
Same two vision calls run concurrently (classify + 3-tier extract), same
response keys, so `client/src/hooks/use-scan-item.ts` is untouched. Going
through `server/llm` means it now inherits the 503 retry and lands in the cost
ledger — the Python path had neither. Verified live: `single-tie-01` →
"Navy and Pink Plaid Necktie" (silk, plaid) in 2.6 s, `single-handbag-01` →
"Black Leather Top-Handle Handbag" with the brand read off the print.

**`/crop-items` ✅ resolved by deleting it (2026-08-02) — see Phase 6 below.**
The analysis that follows is why a straight port was the wrong move, and is
kept because it is what pointed at the right one.

**`/crop-items` — blocked on a missing model, not on effort.**

Its primary path is `pose_square_crop_for_category`: MediaPipe Pose landmarks,
with padding offsets scaled to the subject's torso length and per-category
region rules. There is no MediaPipe in the TypeScript stack.

The obvious shortcut does not work, and the reason is written in the caller.
`client/src/components/LogOutfitOverlay.tsx` says plainly that when the crop
fails it shows the full image with a focus pin, because **"LLM bbox coords are
spatially unreliable for hard crops"**. So falling back to a bbox-only crop is
not a graceful degradation — it ships exactly the output that comment rejects.

Real options, in preference order:

1. **SAM 3.** The hosted pipeline already segments garments better than pose
   landmarks localise them. Costs ~$0.002 per crop where the current path is
   free local CPU, and `/crop-items` is called per item in a batch — so this is
   a real per-use cost on a currently-free operation, and it needs its own eval
   before replacing a working feature.
2. **Hosted pose model** — closest to parity, same per-call cost objection.
3. **Leave it in Python**, which is where it is.

**Parity testing was the wrong frame here and the fixtures say so.** Any of
these changes the geometry, so byte-parity against the Python output is
unachievable by construction; the fixtures assert *behaviour* instead.

### Crop fixtures (2026-08-02)

`eval/crop/fixtures.ts` + `scripts/check-crop-fixtures.ts`, 20 assertions, no
network or keys. Payload shapes are taken from the real callers, including
`bbox: item.bbox ?? null` — a null bbox is a normal payload, not an error.

The test image is a gradient encoding its own coordinates (red = x, green = y),
so decoding a pixel from the output says exactly which part of the source it
came from. That matters because the dangerous crop bug is not an exception, it
is landing on the wrong pixels while returning a perfectly valid JPEG.

It earned its keep immediately: the first run failed 6 of 20 and found a real
defect in the new code — **sharp applies `resize` before `composite` regardless
of chain order**, so canvas-space offsets were being applied to an already
shrunk canvas. That silently mis-centred every padded crop and threw outright on
a full-frame bbox. Composite and resize have to be two passes.

Covered: typical/full-frame/scaled boxes; clips at the left and bottom edges;
boxes overflowing past 100%; negative origins; and the malformed set that must
fall through to the centre square — null, zero-area, negative size, NaN,
entirely off-screen, missing fields, and string-typed numbers.

`server/vision/cropGeometry.ts` ports tiers 2 and 3 of the chain (bbox square
crop, centre square) and is what the fixtures exercise. **Tier 1 is the gap.**

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

~~Retire the `VISION_PIPELINE` branch in the same change **only if** the Python
service is gone entirely; otherwise keep the lever.~~ **Overtaken by events, and
worth recording why.** The lever was retired on 2026-08-02 while
`python_service` was still running, which this rule said not to do. The rule
assumed the lever pointed at something worth keeping; by then it pointed at a
pipeline measured at half the recall, and the surviving Python endpoints
(`/crop-items`) had nothing to do with pipeline selection. Keeping a switch
whose other position is strictly worse is not optionality.

**Done when:** the app runs with no Python service at all, both repos typecheck,
mobile tests pass, and a simulator scan of each of the three scenes still works.
✅ **Met 2026-08-02 by Phase 6**, which removed the reason `/crop-items` existed
rather than porting it.

---

### Phase 6 — Unify localisation on SAM 3 ✅ Done (2026-08-02)

`python_service` is **deleted**. The thing that unblocked it was noticing that
`/crop-items` was solving a problem the outfit log had given itself.

**The old outfit-log scan made up to four LLM calls**, and two of them existed
only to produce bounding boxes:

1. a category-detect call, to shrink the wardrobe catalogue,
2. a matching call that also had to identify and locate every garment,
3. `runBboxLocalize`, a second pass to fix the boxes call 2 got wrong,
4. a `gpt-4o` retry of the whole thing when call 2 came back empty,

then one `/crop-items` round trip **per garment**, each running MediaPipe Pose,
to produce a crop the boxes were too unreliable to cut directly.

**Now: two passes, neither guessing coordinates.**

1. `scanPhoto` — the same SAM 3 call the closet scan uses. Returns real boxes
   *and* a per-garment crop cut from the mask, one flat charge per photo
   regardless of garment count.
2. `server/vision/matchWardrobe.ts` — one call whose only job is matching the
   found garments against the wardrobe. It is given the boxes; it is explicitly
   told not to produce any.

Everything else fell out of that. The category-detect call is gone because SAM 3
already labels each garment, so the catalogue filters for free. `runBboxLocalize`
is gone because nothing estimates boxes. The `gpt-4o` fallback is gone because
finding garments is no longer the LLM's job. The per-item crop round trip is
gone because the pixels were already cut during localisation — the crop rides
back on the scan response as `crop`.

**Measured end to end** on `worn-suit-twopiece-01` against a four-item test
catalogue with deliberate decoys: 5 garments localised in 10.7 s for $0.012,
matched in 7.9 s. The black tee matched "Black Crew Tee" at 0.85 and the jacket
matched "Brown Suit Jacket" at 0.88, while the brown loafers and brown trousers
were correctly returned as **new items** rather than being forced onto the
red-shoe and green-shorts decoys. Real crops for every garment, 199×131 up to
382×512.

Latency is not the win here and should not be claimed as one — the old path was
never measured end to end, and this one is ~18 s. The wins are correctness
(boxes come from segmentation, not estimation), one localisation path shared
with the closet scan, and a deployment with no Python in it.

**Also deleted:** `/api/items/crop-single`, which was registered but called by
nothing in either client; `/api/crop-items`; the `tryPythonCrop` client; and
`server/vision/cropGeometry.ts` with its fixtures — that was groundwork for
porting `/crop-items`, and unifying on SAM 3 removed the endpoint it was for.
Deleting work from the previous session was the right call: keeping it would
have meant keeping a second, unused crop path.

`start.sh` no longer bootstraps a venv or blocks up to 60 s on a health check.

**One thing to watch:** the outfit log now pays SAM 3's per-photo charge
($0.012) where it previously paid for cheaper text-heavy LLM calls. It is a flat
charge per photo rather than per garment, so it does not scale with outfit
complexity — but it is a real change in cost shape, and `show-scan-health.ts`
now sees outfit-log scans too, since both pipelines write to `scan_telemetry`.

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

Simulator: start the backend on port 3001 (see `docs/local-development.md`),
then `npm run ios:sim`. No `VISION_PIPELINE` — it was removed in Phase 5, and
setting it now just prints a warning. Simulator taps are in **points** — divide
screenshot pixels by ~2.29.
