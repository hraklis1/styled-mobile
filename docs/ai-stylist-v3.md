> Repair status (2026-10-12): repository defaults and local rollout configuration differ. See [repair audit](ai-stylist-repair-audit.md) for current behavior, pilot evidence, and outstanding acceptance checks. Deployment has not been verified.

# Editorial AI Stylist v3

Implemented as an opt-in candidate on October 11, 2026. V2 remains the default; no paid capture, production deployment or rollout has been performed.

## Architecture and contracts

The backend retains the existing `stylist_flagship` model route. Static editorial policy is in `server/stylistEditorialPrompt.ts`; the normalized evidence contract is `shared/stylistContext.ts`, built by `server/stylistContext.ts`. Explicit preferences, calibrated wear feedback, revision hashes, exhaustive category counts, the twelve-piece nonexhaustive sample and current session context remain separate from the static prompt. Explicit unknowns stay null. Preference update dates are nullable because the existing database does not record field-level update timestamps. Budget labels and category budgets are retained as supplemental explicit facts rather than guessed numeric prices.

`shared/stylistV3.ts` is the source for both strict model JSON Schema and server parsing. It retains trip, audit and item-comparison blocks. Outfit cards retain occasion and saved-event association to preserve factual event validation. Read-only evidence tools remain function calls; the final answer uses structured output. Personal data, item descriptions and retrieved text are evidence, not instructions.

V3 supports segmented owned references, outfit and product cards, expandable style insights, proposed aesthetic tags, and one targeted clarification. The server resolves garment names, supplies selected garment snapshots, and hydrates products with verified merchant, price, image and URL data. The wire presentation intentionally reuses the existing text/card envelope so saved actions and historical v2 conversations remain usable. Consecutive outfit cards form a carousel. Tags are saved through the authenticated profile API only after a tap; failed updates retain the proposal for retry.

## Grounding, retrieval and limits

Wardrobe search filters category/availability before ranking. Cross-category search interleaves ranked categories so a large top-heavy closet cannot crowd shoes and bottoms out of the first thirty results. There are still at most sixty inspected owned pieces per turn. A coverage check does not inspect items implicitly.

`check_wardrobe_requirements` searches the complete active authenticated wardrobe using canonical category keys and exact structured attributes. It returns matched, confirmed_absent or unknown, available counts, bounded matching IDs, unknown metadata counts and a revision. Unavailable owned matches are not purchasing gaps. Unsupported requirements, invalid category names and ambiguous descriptive text mismatches stay unknown. Numeric/boolean attributes can establish definite mismatches; descriptive metadata is deliberately conservative.

V3 refreshes owned data before final validation, rejects unsupported ready claims and uninspected references, and withholds dependent outfit prose when a card fails. Confirmed structured gaps require exhaustive coverage evidence. Foundations must explain missing requirements; available uninspected requirement matches must be inspected first. Specific possessed garments in text must use owned segments. Targeted prose checks are defense in depth, not a claim of perfect natural-language verification.

Ready stylist saves opt into a fresh ownership/availability check. General user-authored outfits and saved foundations retain their existing behavior. Event attachment retains existing validation.

V3 executes at most three independent tools concurrently and applies weather evidence after the batch, retaining explicit user conditions. Unrelated locations/dates do not alter the current look's weather. Forecast-unavailable responses are labelled seasonal guidance. V2 retains sequential tool behavior.

Limits remain two tool rounds, six requests, three normal generation calls plus one repair, 12,000 estimated input text tokens and 2,500 output tokens. Image usage is separate. Retrieved evidence is compacted before protected user context. Tool failures mark a delivery degraded even when useful general advice survives. V3 fingerprint refresh starts from observed feedback/session evidence rather than its previous generated fingerprint.

## Delivery and observability

Only validated complete blocks are published. Each v3 turn has a server UUID; blocks carry `turnId`, `blockId` and sequence. Clients reject inconsistent identities, ignore duplicate blocks and late blocks after done, and replace streamed state with authoritative done. Interrupted streams retain validated content and existing retry behavior. Persistence precedes done; persistence failure is surfaced rather than reported as a successful durable reply.

The usage ledger records prompt/model versions, bounded generation/tool counts, repair attempts, validation/evidence failures, time to first validated delivery, and ready-look count. These are operational measures, not usefulness scores. Exact completion caching remains user/revision/evidence scoped, with the candidate prompt/schema included in cache identity. The model's schema-valid completion is revalidated against current ownership even on cache hits.

## Evaluation and rollout

The free manifest now contains 72 cases: the original sixty plus twelve editorial scenarios including olive overshirts, Lisbon in November, large closets, rain coverage, roasts, sparse logs, shopping restraint and shoe-only follow-ups.

From the sibling backend:

```sh
node --import tsx scripts/eval-stylist-conversation.ts --check
node --import tsx --test server/stylistEditorial.test.ts server/stylistConversation.test.ts server/stylistConversationEvaluation.test.ts
```

Paid capture requires four dedicated premium fixture accounts (`standard`, `sparse`, `large`, `cold`), their bearer tokens in environment variables, owned selected IDs and the labelled photo/board fixtures documented in `flexible-ai-stylist.md`. It sends 144 fixture requests comparing v2 baseline against v3 candidate. Both capability paths are verified; an incorrect rollout refuses the comparison. Freeze wardrobe, preferences and learned taste during capture. Keep version snapshots and private answer assignments away from reviewers.

```sh
node --import tsx scripts/eval-stylist-conversation.ts --capture --accounts /private/tmp/stylist-accounts.json --api-url http://localhost:5000 --out /private/tmp/stylist-evaluation-v3
node --import tsx scripts/eval-stylist-conversation.ts --score --out /private/tmp/stylist-evaluation-v3 --ratings /private/tmp/stylist-evaluation-v3/ratings.json
```

Every side needs 1–5 scores for relevance, personalization, grounding, usefulness, editorialVoice, taskCompletion, clarificationFriction and shoppingRestraint. Higher is better for all: 5 friction means no unnecessary questioning; 5 restraint means shopping serves the request. Record ownership violations, invalid complete looks, winner and core-outfit regression. Review prose as well as cards against fixture wardrobes.

Release requires all 72 reviews, zero observed ownership/complete-look violations, no core-outfit regression, at least 60% wins among non-ties, mean candidate editorial voice ≥4, no average task-completion decline, complete cost accounting, and candidate average known cost/p95 latency ≤1.5× baseline. Missing rubric fields, failed candidate interactions or unknown costs block a pass. A fixed suite cannot prove zero production hallucinations.

Backend controls (candidate remains disabled by default):

```dotenv
STYLIST_V3_ENABLED=true
STYLIST_V3_USER_IDS=123,456
STYLIST_V3_PERCENT=0
```

Replace IDs with fixture/internal users. The v2 master switch, supported provider and client capability checks still apply. After review, manually advance stable cohorts through 5%, 25%, and 100%; do not advance automatically. Set `STYLIST_V3_ENABLED=false` to return capable clients to v2. Historical v3 messages remain readable. Never use production customers as capture fixtures.
