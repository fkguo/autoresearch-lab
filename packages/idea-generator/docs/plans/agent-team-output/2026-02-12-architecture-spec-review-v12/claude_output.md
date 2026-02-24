VERDICT: NOT_READY

## Blockers

### B1. `$ref` paths in OpenRPC are malformed for dereferencing

The `components.schemas` in `idea_core_rpc_v1.openrpc.json` uses `$ref` pointing to sibling files (e.g., `"$ref": "./campaign_charter_v1.schema.json"`), which is correct. **However**, the method params reference `#/components/schemas/CampaignCharterV1`, which resolves to `{ "$ref": "./campaign_charter_v1.schema.json" }` — a single-hop indirection through the `components` block. This is technically valid per OpenRPC/JSON-Schema, but many tooling implementations (e.g., `@open-rpc/schema-utils-js`, Python `jsonschema` with `RefResolver`) **fail on cross-file `$ref` inside a `$ref` target** (double-hop). The OpenRPC spec itself does not guarantee recursive resolution through `components` indirection in all tool chains.

**Fix required**: Either (a) add a CI test that mechanically resolves all `$ref` chains end-to-end using a specific resolver (document which one), or (b) flatten `components.schemas` entries to inline the sibling-file `$ref` directly (i.e., method params should `$ref` directly to sibling files, bypassing the components block). Since the spec doc says "bundling must be done by script/CI, not manual," this CI test is a hard prerequisite.

### B2. `campaign.status` is read-only but `campaign_not_active` error not declared

The `campaign.topup` method declares `campaign_not_active` (-32015), but `search.step` does **not**. Per the spec §2.3, a campaign can be `paused`, `early_stopped`, `exhausted`, or `completed`. If a caller issues `search.step` on a `completed` or `paused` campaign, the engine has no declared error code to return. `budget_exhausted` is semantically wrong for `paused`/`completed`. 

**Fix required**: Add `campaign_not_active` (-32015) to `search.step`, `eval.run`, `rank.compute`, and `node.promote` error lists. These are all methods that require the campaign to be in an active state.

### B3. `rank.compute` is side-effecting but spec is ambiguous about what it writes

The spec (§2.3) lists `rank.compute` as a side-effecting method requiring idempotency. The `RankingResultV1` has an optional `ranking_artifact_ref`, but it's not in `required`. If `rank.compute` is side-effecting (persists ranking artifacts), the artifact ref **must** be required in the success result — otherwise there's no way to audit what was written.

**Fix required**: Make `ranking_artifact_ref` required in `ranking_result_v1.schema.json`.

### B4. `search.step` `n_steps` parameter lacks `"required": true` but has a `"default": 1`

OpenRPC `required` defaults to `false` when omitted. JSON Schema `default` is advisory, not enforced. If the engine implementation doesn't inject the default, a missing `n_steps` will be `undefined`, not `1`. This is a common source of bugs.

**Fix required**: Either mark `n_steps` as `required: true` (preferred, since the caller should be explicit about intent), or document in the OpenRPC description that the engine **MUST** treat missing `n_steps` as `1` (and add a conformance test for this).

### B5. No `campaign.pause` / `campaign.resume` / `campaign.complete` methods

The `CampaignStatusV1` declares states `running | paused | early_stopped | exhausted | completed`, and the architecture spec §2.3 mentions `campaign.topup` can operate on `paused | early_stopped | exhausted`. But there is **no RPC method to transition a campaign to `paused` or `completed`**. The only ways to reach non-`running` states are implicit (budget exhaustion, early stop). This means:

- The human/hepar operator cannot explicitly pause a campaign (the spec §1.1 says "system must be able to early_stop").
- There is no way to mark a campaign as `completed` (all ideas promoted, no further work).

**Fix required**: Add at minimum `campaign.pause(campaign_id, idempotency_key)` and `campaign.complete(campaign_id, idempotency_key)` to the v1 method set, with appropriate state-transition validation. Even if hepar manages lifecycle externally, the engine must have these so the campaign state machine is well-defined and testable.

### B6. `IdeaCard.claims` conditional validation for evidence URIs is not machine-enforceable

The `allOf` block in `idea_card_v1.schema.json` attempts to enforce `evidence_uris.minItems: 1` when `support_type` is `literature | data | calculation | expert_consensus`. However, JSON Schema's `if/then` with `properties` constraints doesn't **override** the base schema — it only **adds** constraints. The base `evidence_uris` has no `minItems`, so the `then` block adds `minItems: 1` as an additional constraint. This is actually correct in JSON Schema 2020-12, but **only if the `then` block uses the right structure**. The current form:

```json
"then": { "properties": { "evidence_uris": { "minItems": 1 } } }
```

This **does not require** `evidence_uris` to be present — it only constrains it *if* present. A claim with `support_type: "literature"` and **no `evidence_uris` key at all** would pass validation (since `evidence_uris` is in `required` at the item level — wait, it IS in `required`. OK, so the field will exist). But `evidence_uris: []` (empty array) would also pass the base schema (type: array, no minItems) and the conditional would add `minItems: 1`. Let me re-check... Actually, this IS correct for the case where the field exists but is empty. The conditional properly rejects `evidence_uris: []` for literature/data/calculation/expert_consensus.

However, there's a subtle issue: `llm_inference` and `assumption` claims can have `evidence_uris: []`, which is intentional, but the schema doesn't **require** `evidence_uris` to be non-empty for `calculation` type. If a claim says "I calculated this" but provides no reference to the calculation artifact, that's a provenance gap. Consider whether `calculation` should require a URI to the computation artifact.

**Downgrading from blocker to non-blocking** — the JSON Schema conditional logic is technically correct. See NB1 below.

---

## Non-blocking

### NB1. `calculation` support_type should require computation artifact URI

Claims with `support_type: "calculation"` are subject to the `minItems: 1` conditional, which is good. But the spec doesn't distinguish between "I cite someone else's calculation" (literature-like) and "I performed this calculation" (needs artifact provenance). Consider adding `calculation_artifact_ref` as an optional field for claims where the calculation was performed by the system (linking to hep-calc output).

### NB2. `BudgetSnapshot` doesn't expose per-dimension headroom ratios

The `budget_snapshot_v1.schema.json` has `tokens_remaining`, `cost_usd_remaining`, etc., but the Distributor needs to know **which dimension is the binding constraint** (closest to exhaustion). Adding a `binding_dimension` field (string, optional) or `headroom_pct` per dimension would significantly simplify degradation logic without requiring the adapter to recompute ratios.

### NB3. `EloConfig` lacks K-factor and initial rating

The `elo_config_v1.schema.json` only has `max_rounds` and `seed`. Standard Elo systems require at minimum:
- `k_factor` (controls rating volatility)
- `initial_rating` (starting Elo for unrated nodes)

Without these, implementations will make ad-hoc choices that break cross-implementation reproducibility. Add these with sensible defaults (e.g., `k_factor: 32, initial_rating: 1500`).

### NB4. `IdeaListFilter` lacks `min_score` / `eval_status` / `created_after` filters

For practical campaign management (e.g., "show me all nodes created in the last step that scored above threshold"), the filter is missing temporal and score-based predicates. At minimum, add:
- `created_after` / `created_before` (date-time)
- `min_eval_score` (number, assumes a composite or specific dimension)
- `has_eval_info` (boolean)

### NB5. `island_state_v1` doesn't track diversity metrics

The spec §3.2.1 mentions "top-k semantic diversity below threshold" as a trigger for `EXPLORING → CONVERGING`, but `IslandState` has no diversity metric field. Add `diversity_score: number | null` to make the trigger observable and auditable.

### NB6. `SearchStepResult` doesn't report which operators were used

For Distributor reward learning, the step result should report which `(operator_id, model_backend)` pairs were dispatched and their per-pair costs. Consider adding:
```json
"operator_dispatch_log": [{
  "operator_id": "string",
  "model_backend": "string",
  "tokens_used": "integer",
  "n_nodes_produced": "integer"
}]
```

### NB7. `seed_type` in `SeedPackV1` is unconstrained

`seed_type` is `{ "type": "string", "minLength": 1 }` with no enum or pattern. For HEP-first, at minimum document recommended values: `c1_gap`, `pdg_tension`, `hepdata_anomaly`, `kb_prior`, `user_seed`, `cross_domain_seed`. Consider making this an open enum (enum + `x-extensible: true` pattern) for forward compatibility.

### NB8. No explicit versioning field in artifacts

While schema files have `$id` with `v1`, the actual data objects (e.g., `IdeaNode`) have no `schema_version` field. When v2 schemas arrive, consumers of `idea_candidates_v1.jsonl` will have no in-band signal to distinguish v1 from v2 nodes. Add an optional `schema_version` field (default `"1"`) to at least `IdeaNodeV1`, `IdeaCardV1`, and `RationaleDraftV1`.

### NB9. `formalism_registry` merge semantics underspecified

The `campaign.init` description says "entries are merged (caller entries take precedence on formalism_id collision)." But `FormalismRegistryV1` uses an array of entries, not a map keyed by `formalism_id`. Array-based merge with "last writer wins on collision" requires the engine to scan for duplicates by `formalism_id`. Consider either:
- Changing `entries` to an object keyed by `formalism_id`, or
- Adding `uniqueItems` + a documented merge algorithm (which array index wins?).

### NB10. Pagination `cursor` type inconsistency

In `node.list` params, `cursor` is `{ "type": "string", "minLength": 1 }`, but in `NodeListResultV1`, it's `{ "type": ["string", "null"] }`. The param-side schema doesn't allow `null`, which is correct (don't send null cursor). But it also doesn't allow omission (no `required: false` explicit). This is fine in OpenRPC (params default to not required), but worth a test.

### NB11. `BudgetTopUp` fields use `exclusiveMinimum: 0` for `add_cost_usd` and `add_wall_clock_s` but `minimum: 1` for integer fields

This is semantically correct (can't add 0 dollars but can add 1 token), but the asymmetry could confuse implementers. Add a description clarifying that all top-up amounts must be positive/non-degenerate.

---

## Real-research fit

### R1. The Explain-Then-Formalize pipeline maps well to actual physics research

The `RationaleDraft → IdeaCard` two-stage mirrors how theoretical physicists actually work: intuition/analogy first, then rigorous formulation. The `kill_criteria` requirement in `RationaleDraft` is particularly valuable — it forces the system to think about falsifiability before investing in formalization.

### R2. Operator families are well-chosen for HEP

`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, and `RepresentationShift` are core to HEP-th/ph methodology. `CrossDomainAnalogy` with mandatory `mapping_table` is critical for preventing the "vague analogy" failure mode common in LLM-generated physics ideas.

### R3. Multi-island evolution is appropriate for ideation diversity

This directly addresses the mode-collapse problem in LLM-based generation. The stagnation detection → repopulation cycle maps to how research groups naturally cross-pollinate.

### R4. Grounding audit gate is the single most important safety feature

Active URI resolution + data consistency checks + folklore risk scoring directly address the three main failure modes of LLM-assisted physics ideation:
1. Phantom references (hallucinated papers)
2. Contradicting known data (e.g., wrong PDG values)
3. Rediscovering known results

### R5. Gap: no mechanism for "negative results" or "known dead ends"

Real research benefits enormously from knowing what **doesn't** work. The current schema has `failure_modes` in `eval_info`, but there's no first-class representation of "this approach was explored and failed for reason X." Consider adding a `dead_end_registry` (campaign-scoped, append-only) that stores: `(node_id, failure_reason, evidence_uris, timestamp)`. This prevents the system from rediscovering known failures and provides training signal for operators.

### R6. Gap: no support for "conditional ideas" (if X is true, then Y)

Many physics ideas are contingent on uncertain premises (e.g., "if the muon g-2 anomaly persists at 5σ, then model Z becomes viable"). The current `IdeaCard` doesn't capture this conditional structure. Consider adding an optional `premises` array to `IdeaCard`:
```json
"premises": [{
  "condition": "string",
  "status": "assumed | verified | falsified | pending_data",
  "evidence_uris": ["uri"]
}]
```

---

## Robustness & safety

### S1. Idempotency design is solid but needs TTL/eviction spec

The spec says "records MUST be retained for campaign lifetime." For long-running campaigns (days/weeks), the idempotency store could grow unboundedly. While the "no premature eviction" rule is correct for safety, the spec should also define:
- Maximum key length (to prevent abuse)
- Whether the store is in-memory or persisted (crash recovery semantics)
- Behavior on store corruption (fail-open with warning? fail-closed?)

### S2. Campaign isolation is well-specified but needs enforcement test contract

The spec correctly mandates campaign-scoped isolation, but there's no test contract. Propose: a conformance test suite descriptor in the spec that lists the minimum test cases:
- Cross-campaign node access → `node_not_in_campaign`
- Cross-campaign filter → empty results
- Idempotency key reuse across campaigns → independent (no collision)

### S3. Grounding audit is correctly positioned as a gate, not just a score

Making `node.promote` fail on `grounding_audit.status != pass` is the right design. This is a hard safety boundary that prevents hallucinated ideas from entering downstream computation.

### S4. Risk: `eval.run` atomicity under partial LLM failures

The spec requires atomicity: "if any node_id not in campaign, perform no partial writes." But what about partial LLM failures during evaluation (e.g., evaluating 10 nodes, the 7th call times out)? The spec doesn't address this. Options:
- All-or-nothing: if any eval fails, roll back all → expensive, may waste tokens
- Partial with explicit `eval_info: null` on failed nodes → breaks atomicity promise

**Recommendation**: Clarify that the atomicity guarantee applies to **validation checks** (campaign membership, schema). For **execution failures** (LLM timeout, budget mid-call), the engine should persist partial results with an explicit `partial_failure` status in the `EvalResult`, and the idempotency replay should return the same partial result.

### S5. No rate limiting or concurrency control spec

If multiple adapter instances call `search.step` concurrently on the same campaign, the behavior is undefined. At minimum, specify:
- Whether the engine supports concurrent `search.step` calls on the same campaign
- If not, what error code to return (suggest: `campaign_busy` or reuse `-32015`)
- Whether `eval.run` and `search.step` can run concurrently

### S6. `prompt_hash` and `prompt_snapshot_hash` need hash algorithm evolution path

The pattern `^sha256:[a-f0-9]{64}$` hardcodes SHA-256. While SHA-256 is fine today, consider a more flexible pattern like `^[a-z0-9]+:[a-f0-9]+$` with a documented minimum (SHA-256), or add a version/algorithm field. This is minor but avoids a breaking schema change later.

---

## Specific patch suggestions

### Patch 1: Add `campaign_not_active` to side-effecting methods
**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: In methods `search.step`, `eval.run`, `rank.compute`, and `node.promote`, add to their `errors` arrays:
```json
{ "code": -32015, "message": "campaign_not_active" }
```

### Patch 2: Make `ranking_artifact_ref` required
**File**: `schemas/ranking_result_v1.schema.json`
**Change**: Add `"ranking_artifact_ref"` to the `"required"` array.

### Patch 3: Add `k_factor` and `initial_rating` to EloConfig
**File**: `schemas/elo_config_v1.schema.json`
**Change**:
```json
{
  "properties": {
    "max_rounds": { ... },
    "seed": { ... },
    "k_factor": {
      "type": "number",
      "minimum": 1,
      "default": 32,
      "description": "Elo K-factor controlling rating volatility per matchup."
    },
    "initial_rating": {
      "type": "number",
      "minimum": 0,
      "default": 1500,
      "description": "Starting Elo rating for unrated nodes."
    }
  }
}
```

### Patch 4: Add `diversity_score` to IslandState
**File**: `schemas/island_state_v1.schema.json`
**Change**: Add to `properties`:
```json
"diversity_score": {
  "type": ["number", "null"],
  "minimum": 0,
  "maximum": 1,
  "description": "Semantic diversity of top-k population. null if not yet computed. Used by SearchPolicy triggers."
}
```

### Patch 5: Add `campaign.pause` and `campaign.complete` methods
**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: Add two new methods to the `methods` array:

```json
{
  "name": "campaign.pause",
  "summary": "Pause an active campaign (running → paused). No new steps/evals will be accepted until resumed.",
  "paramStructure": "by-name",
  "params": [
    { "name": "campaign_id", "schema": { "type": "string", "format": "uuid" }, "required": true },
    { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
  ],
  "result": { "name": "campaign_status", "schema": { "$ref": "#/components/schemas/CampaignStatusV1" } },
  "errors": [
    { "code": -32003, "message": "campaign_not_found" },
    { "code": -32015, "message": "campaign_not_active" }
  ]
},
{
  "name": "campaign.resume",
  "summary": "Resume a paused/early_stopped/exhausted campaign (requires prior topup if exhausted).",
  "paramStructure": "by-name",
  "params": [
    { "name": "campaign_id", "schema": { "type": "string", "format": "uuid" }, "required": true },
    { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
  ],
  "result": { "name": "campaign_status", "schema": { "$ref": "#/components/schemas/CampaignStatusV1" } },
  "errors": [
    { "code": -32003, "message": "campaign_not_found" },
    { "code": -32015, "message": "campaign_not_active" }
  ]
}
```

Also add `campaign.complete`:
```json
{
  "name": "campaign.complete",
  "summary": "Mark a campaign as completed (terminal state, no further mutations except reads).",
  "paramStructure": "by-name",
  "params": [
    { "name": "campaign_id", "schema": { "type": "string", "format": "uuid" }, "required": true },
    { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
  ],
  "result": { "name": "campaign_status", "schema": { "$ref": "#/components/schemas/CampaignStatusV1" } },
  "errors": [
    { "code": -32003, "message": "campaign_not_found" },
    { "code": -32015, "message": "campaign_not_active" }
  ]
}
```

### Patch 6: Add `n_steps` as required in `search.step`
**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: In the `search.step` method, change `n_steps` param to `"required": true` and remove `"default": 1`. Document that callers must be explicit.

### Patch 7: Add binding-dimension to BudgetSnapshot
**File**: `schemas/budget_snapshot_v1.schema.json`
**Change**: Add to `properties`:
```json
"binding_dimension": {
  "type": ["string", "null"],
  "enum": ["tokens", "cost_usd", "wall_clock_s", "steps", "nodes", null],
  "description": "The budget dimension closest to exhaustion (lowest headroom ratio). null if all dimensions have >50% headroom."
}
```

### Patch 8: Add `$ref` resolution CI requirement to spec
**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
**Change**: In §2.3, after the "契约 SSOT 规则" paragraph, add:

> **`$ref` resolution conformance test (硬约束)**：CI 必须包含一个自动化测试，使用指定的 JSON Schema / OpenRPC resolver（推荐 `@open-rpc/schema-utils-js` 或 Python `jsonschema` with `RefResolver`）端到端解析 `idea_core_rpc_v1.openrpc.json` 中所有 `$ref` 链（包括 `components` → sibling file → nested `$ref`），确保零未解析引用。该测试必须在 schema 文件变更时自动触发。

### Patch 9: Add atomicity clarification for execution failures in `eval.run`
**File**: `schemas/idea_core_rpc_v1.openrpc.json`
**Change**: In the `eval.run` method `description`, append:

```
"Atomicity scope: The atomicity guarantee (no partial writes on membership/validation errors) applies to pre-execution checks. For execution-phase failures (LLM timeout, partial budget exhaustion mid-call), the engine SHOULD persist successfully-evaluated nodes and return a result with the subset of completed node_ids. The idempotency store MUST record this partial result for replay consistency."
```

And in `eval_result_v1.schema.json`, add an optional field:
```json
"partial_failure": {
  "type": ["object", "null"],
  "properties": {
    "failed_node_ids": { "type": "array", "items": { "type": "string", "format": "uuid" } },
    "failure_reason": { "type": "string" }
  },
  "additionalProperties": false,
  "description": "Non-null if some nodes failed evaluation due to execution errors (not validation errors)."
}
```

### Patch 10: Specify concurrency semantics
**File**: `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
**Change**: Add a new subsection §2.3.1 "Concurrency & Locking":

> **Concurrency contract (v1 minimum)**:
> - `search.step`：同一 campaign 同一时刻最多一个 active `search.step` 调用。若引擎收到并发请求，必须返回 `campaign_busy`（建议错误码 -32016）或排队（必须文档化选择）。
> - `eval.run` 与 `search.step` 可以并发执行（评估不修改搜索状态），但 `eval.run` 之间对相同 `node_ids` 不得并发（防止 eval_info 竞态写入）。
> - `node.promote` 需要独占该 node（防止评估中途被晋升）。
