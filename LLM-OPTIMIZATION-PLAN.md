# LLM pipeline optimization implementation plan

Prepared October 8, 2026. Primary implementation repository: `../Styled`.

Implementation progress, delivered changes, verification, and remaining release gates are recorded in [LLM-OPTIMIZATION-STATUS.md](LLM-OPTIMIZATION-STATUS.md).

## Objective and scope

Reduce cost and latency per successful stylist interaction while preserving model routes, stylist voice, explicit preferences, outfit usefulness, and validation behavior. Deliver structural improvements first; tune output budgets only after measuring real distributions.

The supplied audit is the design input, not a verified description of the current checkout. A limited planning inspection found existing implementations of category selection, final request hashes, prompt layers, bounded memory, distributed cache leases, and cache-storage pricing. Each phase therefore begins by verifying coverage and changes only missing or incorrect behavior. No production data or deployed configuration was inspected.

Keep existing models and reasoning defaults. Defer cheaper-model experiments, frontier escalation, personalized semantic response caching, Redis, and vector indexing. Preserve the 30-minute outfit and seven-day knowledge cache policies unless verification identifies a correctness issue.

Work directly on `main`; leave implementation changes uncommitted until explicitly requested. Backend database changes must follow its migration workflow, not `db:push`. Mobile changes, if needed, require reading the exact Expo SDK 56 documentation before coding.

## Delivery sequence

| Phase | Result | Dependency | Release gate |
|---|---|---|---|
| 0 | Verified inventory of existing work and remaining gaps | None | Every audit recommendation mapped to evidence and an owner |
| 1 | Complete interaction accounting and baseline | 0 | Costs reconcile across calls, retries, caches, and failures |
| 2 | Balanced candidates and correct final cache identity | 1 | Outfit and cache correctness fixtures pass |
| 3 | Reliable deduplication and safe early cache lookup | 2 | Concurrency, recovery, and invalidation checks pass |
| 4 | Stable provider prompt layers and shared Gemini caches | 1, 3 | Prefix stability, isolation, and lifecycle checks pass |
| 5 | Bounded incremental conversation memory | 1, 4 | Constraints survive long sessions and summary failures |
| 6 | Measured output tuning and eligible background batching | 1–5 | Quality preserved; savings demonstrated after all costs |

Phases 2–5 can be released separately after their gates pass. Do not bundle output tuning with structural fixes: independent releases make regressions attributable and rollback useful.

## Phase 0 — Establish the actual starting point

**Deliverables**

- Build a route inventory for daily outfits, pairing/chat, knowledge, shopping, trips/capsules, vision, summaries, and background tasks. Record model resolution, prompt builder, candidate limits, output cap, cache identity, validation, and accounting path.
- Mark each recommendation as complete, partial, missing, or needing production evidence. Verify callers use existing helpers, including streaming and correction paths.
- Inspect applicable backend instructions, migrations, configuration overrides, and existing test conventions. Record unrelated local changes before editing.
- Capture synthetic or existing sanitized fixtures for representative closets and conversations. No paid model experiments are required for this inventory.

**Starting points:** `server/routes.ts`, `server/stylistPrompt.ts`, `server/llm/{types,config,index,optimization,cache,memory}.ts`, provider adapters, `server/pricing.ts`, `server/storage.ts`, and existing optimization tests.

**Acceptance:** a traceable gap checklist replaces assumptions from the earlier static audit. Existing behavior has a reproducible fixture before any change.

## Phase 1 — Measure complete interaction cost

**Implementation**

1. Assign one interaction ID at the route boundary and propagate it through classification, retrieval embeddings, summaries, generation, corrections, streaming, and background work triggered by that interaction.
2. Record task, endpoint, resolved provider/model, prompt/schema versions, effective provider output ceiling, latency, finish reason, validation outcome, response-cache result, and correction attempt.
3. Normalize ordinary input, cache reads, cache writes by duration, output, and reasoning usage without double counting. Track Gemini cache creation/storage as separate lifecycle expenses, allocated consistently rather than charged in full to every reader.
4. Record provider failures and billable usage when supplied. Represent unavailable usage or rates as unknown; do not invent zero cost.
5. Produce aggregate views for cost per successful interaction, failed-interaction spend, correction rate, cache hit rate, incomplete looks, and p50/p95 latency. Define success separately from HTTP success.

**Tests:** extend `pricing.test.ts` and `llm/optimization.test.ts` with provider usage fixtures, cache-write durations, reasoning inclusion, storage allocation, unknown rates, retry grouping, and streaming completion/failure.

**Gate:** reconciliation fixtures match expected ledger totals. Baseline collection covers representative traffic and reports sample sizes; rollout thresholds are set from that baseline before optimization is enabled.

## Phase 2 — Protect category coverage and cache correctness

**Implementation**

1. Verify eligibility precedes ranking: ownership, archive state, laundry/lending availability, explicit exclusions, and board scope. Unknown metadata remains eligible. An anchor never overrides ownership or availability.
2. Apply the same category-aware selector to ranked and missing-embedding fallbacks. Target 20 candidates and expand to at most 25 for required coverage. Preserve eligible anchors; reserve shoes and weather-required layers, with tops/bottoms or full-body alternatives.
3. Verify hard dislikes stay excluded except an explicit user-selected anchor where product policy permits it. Use color, silhouette, and fabric compatibility as ranking signals.
4. Return the existing clarification or incomplete-look shape when compatible slots are unavailable. Keep trip/capsule pools task-specific, with wardrobe aggregates and representative candidates.
5. Assemble the generation request once, after selection. Hash its effective provider inputs/settings plus user identity and server validation constraints. Include model route, prompt/schema identity, history, anchors, board scope, and output controls; exclude telemetry IDs and timestamps.
6. Revalidate ownership and current availability on every cached response. Reject stale hits and regenerate through the normal validation path.

**Tests:** tops-dominated closets; dresses versus separates; shoes/layers; anchors; missing embeddings; unknown attributes; hard dislikes; archive/laundry changes; weather transitions; board isolation; trip behavior. Hash tests must distinguish meaningful changes while ignoring changes to garments absent from the effective request when validation semantics are unchanged.

**Gate:** required slots survive selection whenever eligible options exist; candidates remain bounded; personal cache entries cannot cross users; stale results cannot be served.

## Phase 3 — Avoid duplicate work safely

**Implementation**

1. Verify existing PostgreSQL leases support atomic acquisition, owner-checked renewal/release, expiry, and recovery from worker failure. Bound waiter time and cancellation. Recheck the cache after acquiring a lease.
2. Generate and store only validated results under the final request identity. Keep one bounded correction attempt and share the validated result with waiters.
3. Reuse query embeddings under keys that include exact input and embedding model/version. Verify existing reuse before extending it.
4. Add an early application cache only for routes with trustworthy wardrobe/profile/conversation revisions. First inventory every relevant mutation path; use transactional revision updates. Skip early lookup where complete invalidation cannot be proven.
5. Include task, user, versions, locale, occasion, anchors/board, route, prompt/schema versions, and conversation state. The weather signature includes precipitation, relevant lows, and comfort-adjusted decision tiers.

**Tests:** simultaneous identical requests across two independent workers; differing requests; lease expiry; slow generation/renewal; crashed owner; cancelled waiter; storage failure; no partial-result caching; revision updates for all mutations. A storage outage must have a documented bounded fallback and observable duplicate risk.

**Gate:** concurrent identical requests execute once during a healthy lease; recovery cannot allow an expired owner to overwrite the new owner's result. Every early-hit path passes isolation and stale-result checks.

## Phase 4 — Make stable prefixes reusable

**Implementation**

1. Verify callers use `staticPrefix`, `stableUserContext`, `requestContext`, then conversation memory/messages. Preserve wording and whitespace where practical; keep compatibility with legacy `dynamicContext` until all callers migrate.
2. Put only stable profile facts and wardrobe aggregates in the stable layer. Keep weather, candidate garments, current constraints, and changing summaries in the request layer. Version prompt/schema changes.
3. Verify adapter request snapshots and current official provider requirements before changing caching controls. Keep implicit caching for current OpenAI routes; apply Anthropic breakpoints only to eligible prefixes.
4. Verify Gemini shared handle keys include model and exact prefix identity, with distributed creation locks. Handle expiry, provider deletion, failed creation, and fallback without caching a broken handle. Never share personalized prefixes across users.
5. Use measured reuse and storage expense to decide Gemini cache creation/retention. Record lifecycle cost and cleanup behavior explicitly.

**Tests:** identical stable prefix across volatile-context changes; profile changes alter the correct layer; unchanged assembled prompt semantics; adapter snapshots; Gemini multi-worker reuse, expiry and failure; disabled-feature fallback.

**Gate:** prefix reuse is visible in provider usage and reduces total cost for eligible traffic. Current model routing and caller/provider ceilings remain unchanged.

## Phase 5 — Preserve useful memory within a budget

**Implementation**

1. Verify both message count and token-estimated budgets apply. Define the total prompt budget, reserving space for rules, candidates, summary, current request, and output.
2. Reuse the durable summary and summarize only newly expired messages at six-message boundaries. Key state by user and conversation; handle client rolling windows, edits, and deleted history safely.
3. Preserve constraints, explicit references, exclusions, decisions, and relevant dates. Do not restate garment inventories. Keep recent turns verbatim where the budget permits.
4. Handle oversized individual turns and summary failure explicitly. Preserve essential constraints/current intent in a deterministic fallback; never silently lose a hard exclusion merely to meet the budget.

**Tests:** long sessions; oversized turns; edited history; rolling windows; multiple conversations; concurrent summary updates; empty/failed summaries; anchors and hard exclusions originating early in the conversation.

**Gate:** ordinary long sessions stay within the defined prompt budget, incremental work is demonstrated, and important constraints survive trimming and failure paths.

## Phase 6 — Tune outputs and batch only economical work

**Implementation**

1. Start with existing output ceilings. Compare visible output, effective ceilings, finish reasons, correction rate, and user outcomes by task before adjusting them.
2. For ready outfits, generate only required IDs, status, look name, and concise explanation; resolve display metadata on the server. Preserve separate clarification/incomplete schemas and richer chat/trip responses.
3. Tighten one task at a time behind a separate switch. Preserve schema validation, ownership/availability/composition checks, and the bounded correction path.
4. Inventory non-urgent attribute backfills, weekly summaries, and opted-in capsule work. Batch only eligible work using current models; include job state, idempotency, retries, cancellation, and result validation.
5. Pilot daily pre-generation only after measuring likely consumption. Revalidate weather and inventory on delivery; include unused results and synchronous fallback in the savings calculation.

**Tests:** truncated/invalid JSON; missing essentials; schema variants; large trip requests; duplicate batch delivery; cancelled jobs; stale generated outfits; partially failed batches.

**Gate:** lower cost per successful interaction without worsening usefulness or correction/truncation rates beyond the agreed baseline tolerances. Batch savings remain positive after unused results, storage, invalidation, and fallback expenses.

## Verification and rollout

- Extend existing backend tests and sanitized fixtures. Use provider stubs for deterministic request/usage/concurrency tests; use a real test database for cross-worker lease and revision checks.
- Run targeted tests for each change, then the repository's required type and build checks. No new model comparison suite is needed.
- Use existing optimization configuration where available. Verify switches permit independent rollback; do not enable unfinished changes by default.
- Progress from offline fixtures to shadow comparison, then a small production cohort and wider release. Shadow comparisons of payloads/cache decisions should not issue duplicate paid generations by default.
- Agree numeric tolerances after baseline collection. Block expansion for stale or cross-user responses, ownership violations, missing required slots despite eligible inventory, or lost hard constraints. Review cost, latency, corrections, incomplete looks, and user rejection/swap outcomes together.
- Database migrations should be additive during rollout. Rollback disables behavior while retaining compatible storage and historical accounting.

## Definition of done

The route inventory and gap checklist are complete; applicable acceptance tests pass; required repository checks pass; cache isolation and recovery are demonstrated; independent rollback works; and representative measurements show lower cost per successful interaction with acceptable quality. Document delivered changes, remaining deferred work, and measurement limits.

Treat the audit's savings percentages as scenarios, not acceptance guarantees. The first concrete work package is Phase 0 followed by any accounting gaps in Phase 1; implementation should not begin by replacing helpers that already exist.
