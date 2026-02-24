VERDICT: NOT_READY

## Blockers

### B1. `idea.get` uses `idea_id` but IdeaNode has both `idea_id` and `node_id` — semantic ambiguity will cause bugs

The spec says `idea_id` and `node_id` are both UUIDs on `IdeaNode`. Multiple nodes can share the same `idea_id` (a lineage of refinements). But `idea.get` takes only `idea_id` and returns a single `IdeaNodeV1`. This is ambiguous: does it return the *latest* node for that idea? All nodes? The first? The RPC has no `node.get` method.

**Fix required**: Either (a) add a `node.get(node_id) -> IdeaNodeV1` method *and* make `idea.get` return an array (or the latest node with a `node_id` field), or (b) document that `idea_id` is 1:1 with `node_id` (but then why have both?). The current contract is not machine-enforceable on this point.

### B2. `idea.list` result `IdeaListResultV1` is missing pagination — will fail at scale

`idea.list` has a `limit` param but `IdeaListResultV1` has no `cursor`/`offset`/`total_count`. With hundreds of nodes per campaign this becomes unusable. More critically, without a cursor the contract is incomplete: callers cannot enumerate all nodes deterministically.

**Fix required**: Add `cursor: string | null` and `total_count: integer` to `IdeaListResultV1`.

### B3. `eval.run` has no `campaign_id` param — cannot enforce budget circuit breaker

`eval.run` takes `idea_ids` and `evaluator_config` but no `campaign_id`. The budget circuit breaker is campaign-scoped. Without `campaign_id`, the engine cannot debit the correct budget envelope, and the returned `budget_snapshot` is meaningless (snapshot of *what*?).

**Fix required**: Add `campaign_id` as a required param to `eval.run`.

### B4. `rank.compute` has no `campaign_id` → `eval.run` dependency enforced

Nothing in the RPC or schema prevents calling `rank.compute` on ideas that have never been evaluated. The spec says ranking uses evaluator output, but the contract doesn't enforce it. At minimum, `rank.compute` should declare an error for `no_eval_data`.

**Fix required**: Add error code `{ "code": -32013, "message": "insufficient_eval_data" }` to `rank.compute`.

### B5. OpenRPC `params[].required` is non-standard — tooling will ignore it

In the OpenRPC spec, `required` is not a per-param field (unlike OpenAPI). Optional params should use `"schema": { "oneOf": [<type>, {"type": "null"}] }` or be specified via the method-level `paramStructure` and schema-level `required` array. Current optional params (`idempotency_key`, `n_steps`, `filter`, `limit`) use a non-standard `"required": false` that conformant parsers will silently drop, making them appear required.

**Fix required**: Remove per-param `"required": false` and instead either (a) mark params as not included in a method-level required list (by-name param structure), or (b) use `"schema": {"oneOf": [..., {"type": "null"}]}`.

### B6. Standalone schema files use relative `$ref` but OpenRPC inlines everything — dual source of truth

`idea_node_v1.schema.json` uses `"$ref": "rationale_draft_v1.schema.json"` (relative file ref), while the OpenRPC doc inlines all schemas under `#/components/schemas`. These are two separate copies that can (will) drift. There is no stated CI gate that validates they stay in sync.

**Fix required**: Either (a) declare the OpenRPC `components.schemas` as SSOT and generate standalone files, or (b) declare standalone files as SSOT and have the OpenRPC `$ref` point to them (requires a resolver). Add a CI validation step either way.

---

## Non-blocking

### N1. `novelty_delta_table` is optional in `eval_info` but mandatory per spec §6.2

The spec prose says "Referee 在输出 novelty 结论时**必须**包含一个 `novelty_delta_table`", but in the schema it's not in `eval_info`'s required fields (only `fix_suggestions` and `failure_modes` are required when eval_info is non-null). Either the prose overstates or the schema understates. Recommend making it required when `eval_info` is non-null, or adding a separate `referee_eval_info` subtype that requires it.

### N2. No `formalism_registry` param on `campaign.init` — runtime validation of formalisms is under-specified

The spec (§7) says `candidate_formalisms[]` must come from the DomainPack registry, and `idea.promote` fails if not. But the registry is never passed to the engine. How does `idea-core` know which formalisms are valid? Add an optional `formalism_registry` param to `campaign.init` (or a dedicated `registry.load` RPC method).

### N3. `campaign.init` result is anemic

`CampaignInitResultV1` only returns `campaign_id`. It should also return the initial `island_states[]` and `budget_snapshot` so the caller can verify initialization without a follow-up `campaign.status` call. (Reduces round-trips; makes testing simpler.)

### N4. `seed_type` in `SeedPackV1` is free-form string — should be an enum

The spec (§8.1) enumerates seed sources: `c1_gap`, `kb_prior`, `pdg_tension`, `user_seed`. The schema allows any string. Recommend an enum (with `"other"` escape hatch) for validation and analytics.

### N5. No `campaign.pause` / `campaign.resume` RPC

The spec (§1.1.5) says the system must support early stop/pruning/degradation, and hepar supports pause/resume. But there's no `campaign.pause` or `campaign.resume` in the RPC. The adapter would need to implement this outside the protocol, breaking the "all control through RPC" principle.

### N6. Team/Role model (§3.4) has no schema or RPC surface

The Physicist Community concept is well-articulated in prose but has zero schema or RPC presence. There's no `TeamConfig`, `RoleSpec`, or way to configure/observe team topology through the protocol. This is fine for v0.2 if explicitly deferred, but the spec reads as if it's in-scope. Recommend adding a `team_config_v1.schema.json` stub (even if the fields are minimal) and referencing it from `CampaignCharterV1.team_policy_id`.

### N7. `BudgetSnapshot` missing `steps_used` / `steps_remaining`

`BudgetEnvelopeV1` has `max_steps` but `BudgetSnapshotV1` has no step counter. The circuit breaker can't enforce step limits without this.

### N8. `grounding_audit.folklore_risk_score` is optional but spec §4.2.1 says it's mandatory output

The schema allows `grounding_audit` to be non-null with `status`, `failures`, `timestamp` but no `folklore_risk_score`. The spec says the audit "产出 `folklore_risk_score ∈ [0,1]`" — make it required when `grounding_audit` is non-null.

### N9. `idea.promote` should accept `campaign_id` for formalism registry lookup

Currently `idea.promote` only takes `idea_id`. But formalism validation requires knowing which DomainPack/registry applies, which is campaign-scoped. The engine would need to look up the campaign from the idea, which adds an implicit dependency. Cleaner to pass `campaign_id` explicitly.

### N10. No versioning/migration strategy for schemas

All schemas are `v1` with `additionalProperties: false`. When v2 adds a field, all existing persisted artifacts become invalid. Recommend either (a) `additionalProperties: true` at the top level with a `schema_version` field, or (b) a stated migration policy doc. The `additionalProperties: false` is good for strictness but needs a compatibility story.

---

## Real-research fit

### Strong points

1. **Evidence-first provenance is genuine, not decorative.** The `claims[]` structure with conditional `verification_plan` for LLM inferences, the `grounding_audit` gate, and the `folklore_risk_score` threshold → human escalation flow are exactly what's needed to prevent the "LLM confidently cites nonexistent papers" failure mode that plagues every existing AI-for-science system. A real HEP researcher would find this auditable.

2. **The operator taxonomy maps to real physics reasoning patterns.** `AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`, `AssumptionInversion` — these correspond to how theorists actually generate ideas (e.g., "what if we break this symmetry?", "what happens in the strong-coupling limit?"). The `RepresentationShift` operator is particularly well-suited to HEP-th (dualities, gauge choices). This is not generic creativity-speak; it's grounded in physics methodology.

3. **Multi-island with stagnation detection is the right topology for theoretical physics.** Real research groups explore multiple approaches in parallel and kill dead ends. The `STAGNANT → REPOPULATED` transition with cross-island migration directly models the "our approach is stuck, let's borrow techniques from the other group's formalism" pattern.

4. **The `novelty_delta_table` addresses a real and pernicious problem.** In HEP, "parameter scan over slightly different values" or "same model with different notation" is routinely disguised as novelty. The `non_novelty_flags` (especially `equivalent_reformulation` and `no_new_prediction`) are excellent. The requirement that each delta be a "falsifiable statement" is the right bar.

### Concerns for real usage

5. **The `minimal_compute_plan` in IdeaCard needs resource estimation.** A real HEP computation can range from "30 seconds on a laptop" (tree-level cross-section) to "6 months on a cluster" (lattice QCD). The current `estimated_difficulty` enum (`straightforward` → `research_frontier`) is too coarse. Recommend adding `estimated_compute_hours` (order of magnitude) and `required_infrastructure` (laptop | workstation | cluster | unavailable_technology) fields.

6. **No explicit connection to INSPIRE-HEP search semantics.** The `retrieval_recipes` DomainPack extension is mentioned but not specified. For real HEP usage, the seed-to-evidence pipeline must know how to query INSPIRE (e.g., `find a "dark matter" and d > 2023 and tc p`), PDG tables (branching ratios, mass limits), and HEPData (experimental measurements). The `evidence_uris` format should define prefixes like `inspire:`, `pdg:`, `hepdata:` to make URI resolution deterministic.

7. **The `Checker` role (clean-room re-derivation) is critical but under-specified.** In real theoretical physics, the most important validation is independent re-derivation. The spec mentions it as a role but doesn't specify what artifacts the Checker produces or what "inconsistency" means structurally. For HEP, this should at minimum produce a `consistency_report` with fields: `symmetry_check`, `dimensional_analysis`, `known_limits_reproduced[]`, `gauge_invariance_check`.

---

## Robustness & safety

### R1. Hallucination vector: phantom INSPIRE references

The grounding audit checks URI resolvability, but LLMs are known to generate plausible-looking but nonexistent arXiv IDs (e.g., `2301.12345` that doesn't exist). The spec needs to mandate that URI resolution is **active** (HTTP HEAD or INSPIRE API lookup), not just format validation. This is the single most dangerous hallucination mode for this system.

**Recommendation**: Add to the spec: "URI resolution MUST be active (network lookup) for `evidence_uris` with `support_type ∈ {literature, data, calculation}`. Format-only validation is insufficient."

### R2. Budget circuit breaker has no hysteresis / cooldown

The spec says "immediately terminate all pending" when budget is exceeded. But with parallel islands + async LLM calls, "immediately" is ambiguous. In-flight calls may complete after the breaker trips, causing over-budget spend. Need to specify: (a) pre-check before each LLM call, (b) what happens to in-flight calls (cancel vs. allow completion), (c) a `budget_headroom` field (reserve for in-flight).

### R3. `prompt_hash` is necessary but not sufficient for reproducibility

The `origin.prompt_hash` captures the prompt, but LLM outputs also depend on system prompt, tool definitions, and API-level parameters (top_p, frequency_penalty, etc.). For true reproducibility, `origin` should include `system_prompt_hash` and a `full_config_hash` that covers all generation parameters.

### R4. No rate limiting or retry semantics in RPC

The OpenRPC spec has no mention of rate limits, retry-after headers, or idempotency semantics beyond the optional `idempotency_key`. For a system that orchestrates multiple LLM backends, this needs to be specified: what happens on a timeout? Is `search.step` safe to retry? (The `idempotency_key` helps, but its semantics — dedup window, conflict behavior — are undefined.)

### R5. `eval_info.fix_suggestions[].operator_hint` creates a feedback loop risk

If the evaluator suggests which operator to apply next, and the search policy blindly follows, you get a self-reinforcing loop where the evaluator's biases steer the entire search. Recommend that `operator_hint` be treated as advisory only, with the SearchPolicy maintaining its own exploration-exploitation balance (logged as a decision trace).

### R6. No schema for the `idea_handoff_c2_v1.json` artifact

The spec (§8.2) says this is "the only allowed entry into C2" but no schema is provided. This is a critical boundary contract — if it's underspecified, the entire downstream pipeline is at risk.

---

## Specific patch suggestions

### Patch 1: `schemas/idea_core_rpc_v1.openrpc.json` — Fix `eval.run` missing `campaign_id`

```jsonc
// In methods[name="eval.run"].params, add as first param:
{
  "name": "campaign_id",
  "schema": { "type": "string", "minLength": 1 }
}
```

### Patch 2: `schemas/idea_core_rpc_v1.openrpc.json` — Fix non-standard `required: false` on params

Remove all `"required": false` from param objects. Instead, for `campaign.init`, `search.step`, and `idea.list`, switch to `"paramStructure": "by-name"` at the method level and document optional params in their descriptions. Specifically, delete `"required": false` from:
- `campaign.init` → `idempotency_key`
- `search.step` → `n_steps`, `idempotency_key`
- `idea.list` → `filter`, `limit`

### Patch 3: `schemas/idea_core_rpc_v1.openrpc.json` — Add `idea.get` disambiguation + `rank.compute` error

```jsonc
// Option A: Rename idea.get to node.get, take node_id
// In methods[name="idea.get"], change:
{
  "name": "node.get",
  "params": [{ "name": "node_id", "schema": { "type": "string", "format": "uuid" } }],
  // ...
}

// AND add a separate idea.get that returns latest node:
{
  "name": "idea.get",
  "summary": "Fetch the latest IdeaNode for a given idea_id.",
  "params": [{ "name": "idea_id", "schema": { "type": "string", "format": "uuid" } }],
  "result": { "name": "idea_node", "schema": { "$ref": "#/components/schemas/IdeaNodeV1" } },
  "errors": [{ "code": -32004, "message": "idea_not_found" }]
}

// In methods[name="rank.compute"].errors, add:
{ "code": -32013, "message": "insufficient_eval_data" }
```

### Patch 4: `schemas/idea_core_rpc_v1.openrpc.json` — Add pagination to `IdeaListResultV1`

```jsonc
// In components.schemas.IdeaListResultV1:
{
  "type": "object",
  "required": ["ideas"],
  "properties": {
    "ideas": { "type": "array", "items": { "$ref": "#/components/schemas/IdeaNodeV1" } },
    "cursor": { "type": ["string", "null"], "description": "Opaque pagination cursor. null if no more results." },
    "total_count": { "type": "integer", "minimum": 0 }
  },
  "additionalProperties": false
}
```

### Patch 5: `schemas/budget_snapshot_v1.schema.json` — Add step counters

```jsonc
// Add to both standalone schema and OpenRPC BudgetSnapshotV1:
"steps_used": { "type": "integer", "minimum": 0 },
"steps_remaining": { "type": ["integer", "null"], "minimum": 0, "description": "null if max_steps was not set" }
// Add "steps_used" to "required" array
```

### Patch 6: `schemas/idea_card_v1.schema.json` — Add compute resource estimation

```jsonc
// In minimal_compute_plan items, add:
"estimated_compute_hours_log10": {
  "type": "number",
  "description": "Order-of-magnitude estimate: log10(compute hours). E.g., -2 = seconds, 0 = ~1 hour, 3 = ~1000 hours."
},
"required_infrastructure": {
  "enum": ["laptop", "workstation", "cluster", "not_yet_feasible"]
}
```

### Patch 7: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Schema SSOT declaration

Add after §2.3 (after the "备注" line):

```markdown
> **Schema SSOT rule**: The standalone `schemas/*.schema.json` files are the single source of truth.
> The `components.schemas` block in the OpenRPC document MUST be mechanically generated from
> the standalone files (via a CI step, e.g., `scripts/sync-openrpc-schemas.py`).
> Any manual edit to the OpenRPC `components.schemas` without updating the standalone files
> is a build-breaking violation. CI MUST validate equivalence on every commit.
```

### Patch 8: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Active URI resolution mandate

In §4.2.1 (Grounding Audit Gate), after bullet 1 "URI 可解析", replace with:

```markdown
1. **URI 可解析（active resolution）**：`claims[].evidence_uris[]` 必须通过 **active network lookup**
   验证（INSPIRE API / DOI resolver / KB artifact existence check），不得仅做格式校验。
   不存在 phantom 引用。Active resolution failure 必须标记为 `grounding_audit.status = "fail"`
   并记录具体失败 URI 到 `failures[]`。
```

### Patch 9: New file `schemas/idea_handoff_c2_v1.schema.json` — Critical missing boundary contract

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://idea-generator/schemas/idea_handoff_c2_v1.schema.json",
  "title": "IdeaHandoffC2 v1",
  "description": "The sole entry artifact for C2 Method Design. Must be schema-valid and grounding-audited.",
  "type": "object",
  "required": [
    "idea_id", "campaign_id", "idea_card", "grounding_audit_summary",
    "formalism_check", "promotion_timestamp"
  ],
  "properties": {
    "idea_id": { "type": "string", "format": "uuid" },
    "campaign_id": { "type": "string", "minLength": 1 },
    "idea_card": { "$ref": "idea_card_v1.schema.json" },
    "rationale_draft": { "$ref": "rationale_draft_v1.schema.json" },
    "grounding_audit_summary": {
      "type": "object",
      "required": ["status", "folklore_risk_score"],
      "properties": {
        "status": { "enum": ["pass"] },
        "folklore_risk_score": { "type": "number", "minimum": 0, "maximum": 1 }
      },
      "additionalProperties": false
    },
    "formalism_check": {
      "type": "object",
      "required": ["status"],
      "properties": {
        "status": { "enum": ["pass"] },
        "resolved_formalisms": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["formalism_id", "c2_schema_ref"],
            "properties": {
              "formalism_id": { "type": "string", "pattern": "^[a-z0-9_]+\\/[a-z0-9_.-]+$" },
              "c2_schema_ref": { "type": "string", "format": "uri" }
            },
            "additionalProperties": false
          }
        }
      },
      "additionalProperties": false
    },
    "promotion_timestamp": { "type": "string", "format": "date-time" },
    "provenance": {
      "type": "object",
      "properties": {
        "node_id": { "type": "string", "format": "uuid" },
        "operator_trace_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
        "eval_scorecards_ref": { "type": "string", "format": "uri" }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

### Patch 10: `schemas/idea_node_v1.schema.json` — Make `folklore_risk_score` required in grounding_audit

```jsonc
// In grounding_audit, change the allOf to:
"allOf": [
  {
    "if": { "type": "object" },
    "then": { "required": ["status", "folklore_risk_score", "failures", "timestamp"] }
  }
]
```

### Patch 11: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Defer Team/Role schema explicitly

At the end of §3.4.3, add:

```markdown
> **v0.2 scope**: Team/Role topology is a **design-only** deliverable in v0.2. The runtime schema
> (`team_config_v1.schema.json`) and RPC surface (`team.configure` / `team.status`) are deferred
> to v0.3. In v0.2, `CampaignCharter.team_policy_id` is a free-form string resolved by the adapter;
> idea-core treats it as opaque metadata.
```
