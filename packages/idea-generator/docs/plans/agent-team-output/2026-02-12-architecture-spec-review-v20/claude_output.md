VERDICT: NOT_READY

## Blockers

### B1. `campaign.resume` from `exhausted` state: spec vs OpenRPC contradiction

The architecture spec §2.4 states:
> 若对 `status=exhausted` 调用 `campaign.resume`，必须返回 `budget_exhausted`（不改变状态）

But the `campaign.resume` OpenRPC description says:
> "If the campaign budget is exhausted (i.e., any BudgetEnvelope dimension has remaining <= 0), the engine MUST reject with budget_exhausted (-32001) without changing state **(this includes status=exhausted, and also paused|early_stopped with exhausted budget)**"

The problem: The state machine §2.4 "allowed explicit transitions" lists `campaign.resume` as only `paused|early_stopped → running`. The `exhausted` state is **not** in the domain. But the OpenRPC description implies `campaign.resume` may be called in `exhausted` and must return `budget_exhausted`. This is fine semantically, but the **error code listing** for `campaign.resume` does not include `campaign_not_active (-32015)` for the `completed` case *explicitly documented in the description*. Wait — it does list `-32015`. OK, the real issue is: what error do you return for `campaign.resume` when `status=exhausted`? Is it `budget_exhausted` or `campaign_not_active`? The spec says `budget_exhausted` but the state machine says `exhausted` is not a valid source state for `resume`. These need to be unified. 

**Fix**: Either (a) add `exhausted` to `campaign.resume`'s valid source states with a guaranteed `budget_exhausted` rejection, or (b) explicitly state that calling `resume` on `exhausted` returns `campaign_not_active`. The current spec says (a) but the transition table omits it. Pick one and make both documents agree.

### B2. `campaign.topup` on `early_stopped`: state transition inconsistency

§2.4 transition table: `campaign.topup`: `running|paused|early_stopped → (same state)` ∪ `exhausted → running|exhausted`.

But the OpenRPC `campaign.topup` description says:
> "If status is early_stopped (policy halt, not budget), topup adds budget but does NOT change the status; the caller must explicitly campaign.resume to re-enter running."

This is consistent with the transition table. **However**, the `campaign.topup` error list does **not** include `budget_exhausted (-32001)`. If a topup on `running` results in the campaign still being below some threshold (partial topup), should the engine signal this? More critically: the spec states topup is permitted on `running|paused|early_stopped|exhausted`, but the error list only has `schema_validation_failed`, `campaign_not_found`, and `campaign_not_active`. There is no mechanism to report a **failed topup** (e.g., invalid add amounts, negative values). The `budget_topup_v1.schema.json` uses `exclusiveMinimum: 0` for `add_cost_usd` and `add_wall_clock_s` but `minimum: 1` for integer fields — this is fine for schema validation, but the OpenRPC should explicitly list `schema_validation_failed` as the catch for malformed topups (it does, via `-32002`). This one is borderline OK but needs a note.

**Actual blocker**: `campaign.topup` lacks `budget_exhausted` in its error list. Per the spec §2.4, after topup on `exhausted`, the engine evaluates whether budget is still exhausted. But what if `campaign.topup` is called on `running` and the topup itself is valid but the engine detects the campaign is *already* `exhausted` due to a race (single-writer assumed, but still)? The error contract is underspecified. Add `budget_exhausted` to the error list or explicitly document it's never returned by topup.

### B3. `search.step` idempotency for non-deterministic operations: storage contract undefined

The spec requires:
> "For non-deterministic methods (e.g., LLM generation), this MUST be implemented by storing and replaying the first response, not by re-execution."

But there is **no schema or storage contract** for the idempotency store itself. For `search.step`, the stored response includes `new_node_ids`, `island_states`, `budget_snapshot` — all of which could be large. Without specifying:
1. Maximum response size that the idempotency store must handle
2. Whether the store is in-memory, on-disk, or pluggable
3. Whether `budget_snapshot` in the replayed response reflects the **original** snapshot or the **current** snapshot

This is a blocker because implementers will diverge. Specifically: if `budget_snapshot` is replayed from storage but the budget has since changed (e.g., via `campaign.topup`), the replayed `budget_snapshot` will be stale. The spec must clarify: **does replayed response use the original budget_snapshot or the current one?** (I recommend: original, since "all other fields MUST match the first response" implies original.)

### B4. Missing `created_at` / `updated_at` requirement on `IdeaNode`

`idea_node_v1.schema.json` has `created_at` and `updated_at` as optional (not in `required`). But §5.2 says the node "必须包含" `campaign_id`, `idea_id`, `node_id`, etc. — and the mutability contract in the schema description says `created_at` is IMMUTABLE after creation. If it's immutable after creation, it should be required at creation time.

**Fix**: Add `"created_at"` to `required` in `idea_node_v1.schema.json`.

### B5. `node.list` pagination: `total_count` semantics under concurrent writes undefined

`node_list_result_v1.schema.json` requires `total_count`. But §2.3.1 says "single-writer per campaign." Even under single-writer, `total_count` can change between pages. The spec doesn't clarify whether `total_count` is a snapshot at query time or the count matching the filter at cursor creation. For testing, this must be pinned. Additionally, if `total_count` doesn't match `nodes.length` on the last page (because of concurrent writes or filter changes), the contract is ambiguous.

**Fix**: Add a note: `total_count` reflects the count at the time of the query (not cursor creation) and may differ across pages.

### B6. `eval.run` atomicity vs idempotency interaction: unspecified

If `eval.run` fails partway (e.g., 3 of 5 nodes evaluated, then budget exhausted), the spec requires atomicity ("no partial writes"). But what is stored in the idempotency store? If the error is stored, a retry with the same key replays the error. But what if the caller wants to retry with fewer nodes? They need a new `idempotency_key`. This is covered by the spec. **However**: what if the engine returned `budget_exhausted` but actually wrote scorecards for 3/5 nodes before detecting the exhaustion? The atomicity guarantee says "no partial writes," but the idempotency store records an error. On retry with new key, do the 3 already-written scorecards get written again (duplicates)? 

**Fix**: Clarify that atomicity means either all scorecards are written and the response is success, OR no scorecards are written and the response is an error. The engine must roll back partial writes before storing the error in the idempotency store.

---

## Non-blocking

### N1. `EvaluatorConfig` dimension weights don't constrain sum or normalization

`evaluator_config_v1.schema.json` allows `weights` as `additionalProperties: { type: number, minimum: 0 }` but doesn't require keys to match `dimensions`. An implementer could provide weights for dimensions not in the `dimensions` array, or omit weights for listed dimensions.

**Suggestion**: Add a note (or ideally a `dependentRequired`) that `weights` keys SHOULD be a subset of `dimensions`, and missing weights default to equal weighting.

### N2. `BudgetSnapshot` doesn't expose which dimension triggered exhaustion

When a campaign transitions to `exhausted`, the snapshot shows all dimensions, but there's no field indicating *which* dimension(s) triggered the transition. This makes debugging harder.

**Suggestion**: Add optional `exhausted_dimensions: string[]` to `budget_snapshot_v1.schema.json` (e.g., `["tokens", "cost_usd"]`).

### N3. `IdeaCard.claims` `evidence_uris` allows empty array for literature/data/calculation types

The conditional `allOf` in `idea_card_v1.schema.json` correctly requires `evidence_uris` with `minItems: 1` for `literature|data|calculation|expert_consensus`. But the `then` clause places the constraint via `properties.evidence_uris.minItems` — this is correct in JSON Schema draft 2020-12 (it overrides/narrows the property within the `then` subschema). Verified: this works as intended. No action needed, but worth a test case.

### N4. `island_state_v1.schema.json` missing `operator_distribution` or `operator_ids`

The island state has no reference to which operators are active/available on that island, making it hard for the adapter to reason about what search is actually doing. Consider adding an optional `active_operator_ids: string[]`.

### N5. `campaign_charter_v1.schema.json` missing `search_policy_id` / `team_policy_id` enforcement

Both fields are optional (not in `required`), but the spec §3.2 and §3.4 imply that a campaign without these would use defaults. This is fine, but the schema should document the default behavior.

### N6. `formalism_registry_v1.schema.json` merge semantics aren't schema-enforceable

The OpenRPC description says entries are merged with caller precedence on `formalism_id` collision. This can't be enforced by schema alone — it's runtime logic. Document this as a MUST in the spec body and add a test case requirement.

### N7. Version field missing from all schemas

None of the schemas have a `schema_version` or `$version` field. When schemas evolve (v2), there's no way to distinguish v1 vs v2 instances at the data level. Adding `"schema_version": { "const": "1" }` to each schema would be cheap insurance.

### N8. `RationaleDraft` missing `operator_id` / `origin` back-reference

`RationaleDraft` is produced by an Operator, but the schema doesn't link back to which operator produced it. The `IdeaNode` wraps it and has `operator_id`, but if `RationaleDraft` is stored as a standalone artifact (the spec mentions "artifact reference"), it loses context.

**Suggestion**: Add optional `operator_id` and `origin_node_id` to `rationale_draft_v1.schema.json`.

### N9. `elo_config_v1.schema.json` too minimal for reproducibility

The spec §6.3 says "pairing rules must be written into the ranking artifact for replay." But `elo_config` only has `max_rounds` and `seed`. Missing: `k_factor` (Elo K-factor), `initial_rating`, `pairing_strategy` (e.g., "swiss", "random", "round_robin"). Without these, "deterministic" is aspirational.

**Suggestion**: Add `k_factor: number`, `initial_rating: number`, `pairing_strategy: enum["swiss", "random", "round_robin"]` with sensible defaults.

### N10. `search_step_result_v1.schema.json` `new_nodes_artifact_ref` conditional logic

The schema has:
```json
{
  "if": { "properties": { "new_node_ids": { "type": "array", "minItems": 1 } }, "required": ["new_node_ids"] },
  "then": { "required": ["new_nodes_artifact_ref"] }
}
```

This conditional is always true because `new_node_ids` is already `required` and always an array. The intent is "if new_node_ids is non-empty, then new_nodes_artifact_ref is required." But the `if` checks type=array + minItems=1, which only works if the actual value has ≥1 item. This is correct in JSON Schema 2020-12 — `if` validates against the instance. If `new_node_ids` is `[]`, the `if` fails (because `minItems: 1` is not satisfied), so `then` doesn't apply, and `new_nodes_artifact_ref` is not required. ✓ This works correctly.

---

## Real-research fit

### R1. Evidence-first provenance is well-designed

The four-layer grounding audit gate (URI resolution, data consistency, inference transparency, folklore pre-screening) maps directly to real HEP research quality bars. The claim-level provenance in `IdeaCard` with `support_type` and conditional `verification_plan` requirements is exactly what a real researcher would want before investing compute time.

### R2. Operator families align with physics methodology

The mapping from Kuhn/Peirce/Lakatos/Popper to executable operators (`AnomalyAbduction`, `AssumptionInversion`, `ProtectiveBeltPatch`) is not just philosophy decoration — these correspond to real patterns in HEP theory development:
- `AnomalyAbduction`: B-anomalies → leptoquark models, g-2 → BSM explanations
- `SymmetryOperator`: gauge symmetry breaking patterns, discrete symmetry extensions
- `LimitExplorer`: heavy-quark limits, large-N expansions, soft/collinear limits
- `CrossDomainAnalogy`: CFT/gravity duality, condensed matter → particle physics phase transitions

### R3. `minimal_compute_plan` with difficulty estimation is excellent

The `estimated_difficulty` + `required_infrastructure` + `estimated_compute_hours_log10` fields in `IdeaCard` directly address the "is this idea actually doable?" question that kills most paper ideas. The `blockers` field is particularly valuable for real research planning.

### R4. Missing: experimental sensitivity/reach estimates

For HEP phenomenology, the most critical feasibility check is often "can any current/planned experiment actually measure this?" The `required_observables` field is a start, but there's no structured link to experimental programs (LHC Run 3, HL-LHC, Belle II, DUNE, etc.) or projected sensitivities. This would be a high-value `extensions` field for the HEP DomainPack.

### R5. Risk of over-engineering for v0.2

The Team/Role/Community abstraction (§3.4) is ambitious. For a v0.2 that aims to produce working ideas, a simpler `generate → ground → evaluate → rank` pipeline with a single LLM per step would deliver faster. The full multi-agent community can be a v0.3+ feature. The spec acknowledges this ("v0.2 不要求一次性全实现") but the schema and RPC design already bake in `team_policy_id` references that will be stubs.

---

## Robustness & safety

### S1. Hallucination mitigation: strong

The two-stage `RationaleDraft → IdeaCard` pipeline with mandatory grounding audit is the correct architecture for LLM-assisted research. The explicit separation of `llm_inference`/`assumption` from `literature`/`data` support types, with mandatory `verification_plan`, prevents the common failure mode of LLMs confidently citing nonexistent papers.

### S2. Active URI resolution: critical and correctly specified

The requirement for active INSPIRE API / DOI resolution (not just regex validation) in §4.2.1 is essential. Phantom citations are the #1 hallucination risk in LLM-generated research ideas.

### S3. Folklore risk scoring: good but threshold undefined

The `folklore_risk_score ∈ [0,1]` is well-defined in schema, but the threshold for triggering human review (`A0-folklore`) is not specified anywhere in the schemas. It's mentioned in the spec but should be a configurable parameter in `EvaluatorConfig.extensions` or `CampaignCharter.extensions`.

### S4. Idempotency for non-deterministic operations: well-designed

The "store-and-replay" approach for `search.step` is the only correct solution for LLM-based generation. The payload hash via JCS (RFC 8785) is a solid choice for deterministic comparison. The explicit handling of "same key, different payload → reject" prevents subtle replay bugs.

### S5. Budget circuit breaker: good, but degradation_order is advisory only

The `degradation_order` in `BudgetEnvelope` is an ordered list but the spec doesn't mandate that the engine follow it in order. It should be MUST (engine follows degradation order sequentially) or SHOULD with clear documentation that it's a hint.

### S6. Missing: rate limiting / abuse prevention for LLM calls

No schema or spec addresses rate limiting for external API calls (INSPIRE, PDG, LLM backends). A campaign with `max_tokens: 10_000_000` could hammer INSPIRE's API. Consider adding optional rate limit fields to `BudgetEnvelope.extensions`.

### S7. Campaign isolation is well-specified but lacks encryption/access control

Campaign scoping is strictly enforced at the RPC level, but there's no access control model. Any adapter that knows a `campaign_id` UUID can read any node. For v0.x with single-user, this is acceptable, but worth noting for v1.0.

---

## Specific patch suggestions

### P1. `schemas/idea_node_v1.schema.json` — make `created_at` required

```json
// Line: "required": [...]
// Change FROM:
"required": [
    "campaign_id", "idea_id", "node_id", "parent_node_ids",
    "island_id", "operator_id", "origin", "operator_trace", "rationale_draft"
]
// Change TO:
"required": [
    "campaign_id", "idea_id", "node_id", "parent_node_ids",
    "island_id", "operator_id", "origin", "operator_trace", "rationale_draft",
    "created_at"
]
```

### P2. `schemas/idea_core_rpc_v1.openrpc.json` — add `budget_exhausted` to `campaign.topup` errors

```json
// In method "campaign.topup" → "errors" array, add:
{ "code": -32001, "message": "budget_exhausted" }
// Rationale: Even though topup adds budget, the engine may need to signal
// that the topup was insufficient to exit exhausted state. Alternatively,
// document explicitly that topup NEVER returns budget_exhausted.
```

### P3. `schemas/idea_core_rpc_v1.openrpc.json` — clarify `campaign.resume` behavior for `exhausted` state

In the `campaign.resume` description, change:
```
// FROM:
"(this includes status=exhausted, and also paused|early_stopped with exhausted budget)"
// TO:
"(this includes status=exhausted — which is not a valid source state for resume but receives a specific budget_exhausted error rather than campaign_not_active — and also paused|early_stopped where current budget has remaining <= 0 in any dimension)"
```

### P4. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.4 — add `exhausted` to `campaign.resume` domain with explicit rejection

```markdown
// In the "允许的显式迁移" section, change campaign.resume FROM:
- `campaign.resume`：`paused|early_stopped → running`（若预算不足则 `budget_exhausted`）
// TO:
- `campaign.resume`：`paused|early_stopped → running`（若预算不足则 `budget_exhausted`）；`exhausted → budget_exhausted`（不改变状态；调用方应先 `campaign.topup`）；`completed → campaign_not_active`
```

### P5. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.3 — add idempotency replay stale-snapshot clarification

After the "Idempotency replay 规则" section, add:

```markdown
   - **Replayed response freshness（必须明确）**：duplicate hit 返回的响应必须是首次响应的**完整快照**（包括 `budget_snapshot`、`island_states` 等），即使这些字段在首次调用后已经因后续操作而变化。调用方如需当前状态，应额外调用 `campaign.status`。这确保 idempotency 的"same logical response"语义不依赖于外部状态的时序，且 idempotency store 实现只需存储 + 回放，不需要拼接实时数据。
```

### P6. `schemas/elo_config_v1.schema.json` — add k_factor and initial_rating for reproducibility

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "elo_config_v1.schema.json",
  "title": "EloConfig v1",
  "description": "Configuration for Elo-based ranking in rank.compute. Provides a bounded and reproducible tournament specification.",
  "type": "object",
  "required": ["max_rounds", "seed"],
  "properties": {
    "max_rounds": {
      "type": "integer",
      "minimum": 1,
      "description": "Upper bound on Elo tournament rounds/matchups."
    },
    "seed": {
      "type": "integer",
      "minimum": 0,
      "description": "Deterministic seed for pairing/matchup scheduling."
    },
    "k_factor": {
      "type": "number",
      "minimum": 1,
      "default": 32,
      "description": "Elo K-factor controlling rating volatility."
    },
    "initial_rating": {
      "type": "number",
      "minimum": 0,
      "default": 1500,
      "description": "Starting Elo rating for all nodes."
    },
    "pairing_strategy": {
      "enum": ["swiss", "random", "round_robin"],
      "default": "swiss",
      "description": "Matchup scheduling strategy. Must be written into ranking artifact for replay."
    }
  },
  "additionalProperties": false
}
```

### P7. `schemas/budget_snapshot_v1.schema.json` — add optional `exhausted_dimensions`

```json
// Add to properties:
"exhausted_dimensions": {
  "type": "array",
  "items": { "enum": ["tokens", "cost_usd", "wall_clock_s", "steps", "nodes"] },
  "description": "Dimensions that have remaining <= 0. Empty array if no dimension is exhausted. Useful for debugging budget transitions."
}
```

### P8. `schemas/evaluator_config_v1.schema.json` — add folklore threshold

```json
// Add to properties:
"folklore_risk_threshold": {
  "type": "number",
  "minimum": 0,
  "maximum": 1,
  "default": 0.7,
  "description": "Folklore risk score above which A0-folklore human review is required."
}
```

### P9. `schemas/idea_card_v1.schema.json` — add optional `experimental_reach` field

```json
// Add to properties (after required_observables):
"experimental_reach": {
  "type": "array",
  "description": "Optional mapping of observables to experiments/facilities with projected sensitivity (HEP DomainPack extension).",
  "items": {
    "type": "object",
    "required": ["observable", "experiment"],
    "properties": {
      "observable": { "type": "string", "minLength": 1 },
      "experiment": { "type": "string", "minLength": 1 },
      "projected_sensitivity": { "type": "string" },
      "timeline": { "type": "string" },
      "reference_uri": { "type": "string", "format": "uri" }
    },
    "additionalProperties": false
  }
}
```

### P10. `docs/plans/2026-02-12-idea-generator-architecture-spec.md` §2.3 — add eval.run atomicity clarification

In section 2.3, point 1 (Campaign scoping MUST), add after the atomicity note:

```markdown
   - 对 `eval.run` 的原子性保证（明确）：若因预算耗尽或其他原因导致仅部分节点完成评估，engine **必须**回滚所有已写入的 scorecards/eval_info（即：要么全部成功写入，要么全部不写入），然后将 error 存入 idempotency store。调用方如要在 budget 充足后重试，必须使用新的 `idempotency_key`。
```

### P11. All schemas — add `schema_version` field for future-proofing

Add to every schema's `properties` (and optionally `required`):

```json
"schema_version": {
  "const": "1",
  "description": "Schema version for forward-compatible deserialization."
}
```

Start with the three most critical: `idea_node_v1`, `idea_card_v1`, `campaign_charter_v1`.
