# AI stylist repair audit — 2026-10-12

## Scope and status

Changes are uncommitted on main in Styled-mobile and sibling Styled. Existing working changes were preserved. No deployment, push, model upgrade or full 144-request evaluation occurred. This repair is ready for review, **not broad rollout acceptance**: the bounded pilot establishes useful behavior on synthetic fixtures, not end-to-end reliability against real accounts or live retailers.

Repository flags retain the opt-in defaults; local backend configuration explicitly enables v3 at 100%. The configured flagship adapter uses OpenAI gpt-5.4-mini with reasoning disabled. Deployment configuration is unknown. Local configuration is not evidence of production rollout.

## Confirmed defects and repairs

| Evidence | Repair |
| --- | --- |
| A failed outfit could suppress all prose, including independent advice. | Validate blocks independently; use explicit outfit dependencies plus defensive checks to remove dependent claims. Keep independent grounded advice. |
| Optional insight/tag cards could survive without an answer. | Require meaningful primary content; remove orphan adjuncts during recovery. |
| Repair repeated the whole invalid output. | Send concise specific errors; retain one repair and four-generation ceiling. |
| Rolling client history and summary cache failures could lose continuity. | Read authenticated persisted history before appending the request; compact full history into cached notes and recent turns. Rebuild from full persisted history during cache outages. |
| Persisted text was truncated while rich authoritative blocks remained available. | Recover full block text and compact historical product references, anchors and delivery status from payloads. |
| Baseline pilot replaced the explicitly selected sneakers with loafers. | Add a backward-compatible explicit anchor ID and reject outfits omitting it. Previous attachments remain evidence without permanently locking later topic pivots. |
| Shortlists could produce several tall individual cards. | Group consecutive recommendations into one list; show three initially, expand already fetched options and personal rationale on demand. |
| Profile evidence duplicated some facts and omitted useful collected details. | One canonical personal context includes fit, comfort, exclusions, shopping preferences and tentative taste, with revision fingerprints. |

The screenshot responses match the old generic validation/budget fallbacks. Their exact original provider events are unavailable, so their individual causes remain hypotheses. The offline banner uses device connectivity separately from model delivery; no banner appeared during current simulator inspection. Network interruptions now have distinct retry copy.

## Architecture and boundaries

Profile/feedback collection → canonical context → bounded diverse wardrobe seed → one conversational agent with read-only evidence tools → refreshed wardrobe validation → ordered text/card response → persisted authoritative blocks → SSE completion → mobile rendering/history. No classifier or predefined answer route was introduced.

Ownership, current availability, explicit exclusions, product IDs and weather remain application boundaries. Styling judgments remain with the LLM. Conceptual alternatives must be labelled and cannot imply ownership. Explicit closet-only constraints remain protected. Delivery status distinguishes complete, partial and failed; failure codes distinguish malformed, truncated, evidence, provider, budget and validation failures. Diagnostics stay server-side.

Inputs retain the existing 12,000 estimated text-token ceiling and 2,500 output ceiling. Evidence compaction reserves tool/repair space before rejecting a request. Images are separate and their costs cannot be inferred from text estimates. Summary cache identities are v4; prompts and schema affect response identities. User and conversation scopes isolate cached state. Explicit preferences are not silently sliced; unknown values and inferred provenance remain explicit.

## Collected personal fields

| Fields | Treatment |
| --- | --- |
| Style preferences, fit/silhouette, favorite palette | Explicit preference evidence; derived palette labelled inferred. |
| Avoided colors/styles/materials/patterns/brands | Explicit exclusions, retained independently of tentative taste. |
| Body descriptors, fit notes, sensitive-fit proportions/comfort/coverage/notes | Canonical practical context; no invented measurements. |
| Standard sizes, suit jacket, height/chest/waist/hips/inseam, extra sizes, sizing region | Known string values retained; unknown fields remain absent rather than guessed. |
| Occasions, material/pattern likes, undertone/contrast/metal preference | Canonical profile evidence. |
| Budget labels/category budgets, preferred retailers, shopping priorities, currency | Retained without translating vague labels into invented numeric budgets. |
| Stylist tone, adventurousness, shopping-links preference | Resolved service preferences included in canonical context. |
| Fingerprint, positive/negative taste signals, shopping taste | Tentative evidence; explicit instructions take precedence. |
| Feedback/calibration and logged wear | Bounded recent feedback/calibration and frequent IDs; sparse logging is not proof of disuse. |
| Location/date/weather | Request session context with source/date checks; not duplicated in stable profile. |
| Identity/authentication, account metadata, notification/theme settings | Excluded from styling decisions; authentication still scopes retrieval and caches. |
| Custom occasion vocabulary | Used to label collected occasions elsewhere; not an independent preference. |

## Validation and pilot

The original targeted baseline suite passed 50 tests despite live quality defects. Latest backend targeted run: **77 passed**. Earlier expanded run: 80 passed. Mobile full suite previously passed **143 suites / 1,066 tests**; added focused history/retry/shortlist checks passed **3 suites / 15 tests**. Type and lint results are recorded in the completion report. Native iOS build succeeded with zero errors using `npm run ios`; existing Metro was verified. Restored history was inspected after the Mac unlocked. A new live shortlist has not yet been visually verified.

Sanitized per-attempt prompt footprints, finish reasons, usage/cost, latency and validation results are in [pilot data](stylist-repair-pilot.json). Fixtures contain synthetic clothing and profiles, not user account data.

The pilot used the production orchestrator, context builder, provider adapter and evidence tools, with synthetic wardrobe fixtures and an empty product-search fixture. It did **not** execute endpoint persistence, paid summaries, embeddings, audio or deferred jobs; those costs are zero for these runs, and their live behavior is unverified. Each request reserved a conservative uncached text/output estimate before calling the provider; automatic provider retries were disabled. The cap was US$5. Total estimated token spend across baseline, intermediate and final runs was **US$0.2308278**. This is repository list-price accounting, not a provider invoice. Two configuration probes rejected reasoning with function tools before generation; no token usage was returned. The working model setting was retained.

| Final comparison | Baseline | Repaired |
| --- | --- | --- |
| Eight cases, token cost | $0.04192 | $0.04951 |
| Median latency | 5.25 sec | 4.73 sec |
| Dinner anchor | Replaced sneakers | Kept sneakers |
| Lunch anchor | Kept sneakers | Kept sneakers |
| Empty retailer evidence | Honest prose, legacy success state | Honest advice, explicit partial/evidence-unavailable |
| Paired preferences | Different outfits | Different outfits |

Manual review: both Thanksgiving answers are actionable; no empty successful replies, invented owned pieces or unverified product offers were observed. Sparse-closet alternatives are labelled unconfirmed. Paired profiles change garment choices. The final answers are generally shorter and more focused, but consultant voice still needs work: one response split a sentence awkwardly across text blocks, one sparse response concatenated an owned-item label awkwardly, and unavailable-shopping copy mentioned internal product IDs. These prevent a premium-quality acceptance claim. The final service-preference inclusion and persistence guard were deterministic-tested after the paid run and were not rerun live.

## Outstanding acceptance gates

Before broader rollout: run authenticated end-to-end screenshot replays, long restored conversations and interrupted SSE recovery; verify real retailer availability/price/currency and compact shortlist accessibility on device; evaluate summary/deferred accounting; assess paired profiles over repeated samples and fix remaining prose artifacts. Daily Look and unrelated shopping remain outside redesign. Compatibility is supported by retained envelopes and passing checks, not a comprehensive live workflow certification.

Final follow-up: fixed missing whitespace at owned-reference boundaries and tightened prompt guidance against split sentences and internal identifiers. These final changes passed deterministic checks but have not been re-evaluated live. Backend/mobile type checks and mobile lint passed. Premium voice and live end-to-end acceptance remain pending.

## Local serving correction — 09:54 Toronto

A subsequent screenshot exposed that the simulator was still reaching a non-watching backend started at 09:18. The updated watcher repeatedly failed with EADDRINUSE, so earlier native inspection did not establish that the repaired backend was serving. Stopped both stale processes and restarted through `scripts/ensure-local-api.mjs`; startup confirmed serving on port 3001 at 09:54:38, with one new listener. The screenshot request itself has not yet been replayed against this process.

## Real retrieval overflow correction

The next screenshot confirmed a separate live defect: four wardrobe searches inflated tool history to 6,490 estimated tokens and total input to 16,490 despite the existing compactor. Protected profile/request context was only 3,759 tokens and dialogue 118. Tight compaction now retains three garments per retrieved batch with identity, availability and relevant garment/weather facts, marks partial evidence, and disables further tool definitions near the ceiling to reserve answering room. Added a four-batch regression; all nine repair tests passed and the related 55-test run passed before the new regression. The source watcher confirmed serving the fix at 09:58:53. No live replay has yet verified the resulting recommendation.

## Shopping follow-up request validation

The 4,000-character error was the client-history transport field, not generated-answer persistence. Rich shopping evidence appended to a previous assistant turn could exceed its limit before the server loaded persisted history. Saved-chat requests now omit duplicate client history; the backend also strips it before parsing for enabled conversational requests with a valid positive conversation ID. Existing ownership checks remain required before persisted messages are read. Legacy requests retain their validation. Added regression: ten repair tests passed; both type checks passed. Live replay remains pending.
