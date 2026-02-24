VERDICT: NOT_READY

## Blockers

### B1. OpenRPC `$ref` paths are not resolvable URIs — spec is not self-contained

In `idea_core_rpc_v1.openrpc.json`, the `$ref` values (`"$ref": "idea_node_v1.schema.json"`) are bare filenames, not proper JSON Reference URIs. Per the OpenRPC spec and JSON Schema `$ref` resolution rules, these must be either:
- absolute URIs matching the `$id` of the target schema, or
- relative URIs resolvable from the OpenRPC document's base URI.

As written, any compliant OpenRPC validator/codegen tool (e.g., `open-rpc/generator`, `json-schema-ref-parser`) will fail. This means the "machine-enforceable" contract claim is **not actually enforceable** without manual patching.

**Fix:** Use the `$id` values already declared in each schema, e.g., `"$ref": "https://idea-generator/schemas/idea_node_v1.schema.json"`, or bundle all schemas under a `components.schemas` key in the OpenRPC doc (preferred for portability).

### B2. `campaign.init` params `charter`, `seed_pack`, `budget` are opaque `{"type": "object"}` — no contract

These are the most critical inputs to the entire system (they define what the campaign *is*), yet they have zero schema constraints. A consumer cannot validate a campaign init request, and a producer cannot know what fields are required. This defeats the stated goal of "machine-enforceable contracts."

At minimum, `budget` must have required fields (`max_tokens`, `max_cost_usd`, `max_wall_clock_s`) since the Budget Circuit Breaker (§3.3) depends on them. `charter` needs at least `domain`, `scope`, `approval_gate_ref`. `seed_pack` needs at least `seeds: [{seed_type, content, source_uri}]`.

### B3. `search.step` and `eval.run` and `rank.compute` result schemas are `{"type": "object"}` — opaque

The spec mandates that evaluators return "actionable diagnostics" (§6.1) and that ranking produces Pareto/Elo outputs, but the RPC result schemas are unconstrained objects. Downstream consumers (the adapter, hepar, human operator dashboards) cannot parse these reliably. At least `search.step` must declare:
- `new_nodes: IdeaNode[]`
- `budget_remaining: {tokens, cost_usd, wall_clock_s}`
- `island_states: [{island_id, state, population_size}]`

Similarly, `rank.compute` must declare the shape of the ranking (sorted list with scores, Pareto front indices, etc.).

### B4. Multi-Island state machine has no formal schema / enum in the artifact contracts

§3.2.1 declares states (`SEEDING`, `EXPLORING`, `CONVERGING`, `STAGNANT`, `REPOPULATED`, `EXHAUSTED`) and transitions, but:
- There is no `island_state` enum in any schema
- `IdeaNode` has no `island_state` field
- `campaign.status` result is opaque, so island states are unobservable via the RPC

Without this, the state machine is documentation-only, not enforceable. The claimed "hard constraint" of the multi-island architecture has no runtime teeth.

### B5. `idea_card_v1.schema.json` — `candidate_formalisms` is `string[]` but spec requires registry validation

§7 states: *"`candidate_formalisms[]` must come from the DomainPack's formalism registry; otherwise `idea.promote` must fail."* But the schema declares `candidate_formalisms` as a plain `string[]` with no enum or pattern constraint. This means:
- Schema validation alone cannot enforce the registry check
- There's no `formalism_id` schema or registry schema defined anywhere
- The `idea.promote` RPC error list doesn't include a formalism-specific error

At minimum, add a `formalism_registry_v1.schema.json` and declare a pattern like `"pattern": "^[a-z0-9_]+/[a-z0-9_.]+$"` for formalism IDs (namespace/name). The runtime registry check is fine, but the *contract that it happens* must be in the OpenRPC error set and documented.

### B6. `evidence_uris` allows `minItems: 1` even for `support_type: "assumption"` — semantic mismatch

An assumption, by definition, may not have an evidence URI. Requiring `minItems: 1` on `evidence_uris` for all claim types forces authors to either fabricate a URI or fail validation. The conditional `allOf/if/then` block only adds `verification_plan` for `llm_inference`/`assumption` but doesn't relax the `evidence_uris` requirement.

**Fix:** Make `evidence_uris` conditionally required: `minItems: 1` for `literature`, `data`, `calculation`, `expert_consensus`; `minItems: 0` for `llm_inference`, `assumption`.

---

## Non-blocking

### N1. `rationale_draft_v1.schema.json` — `risks` and `kill_criteria` have no `minItems`

The spec says "1–3 kill criteria" but the schema allows an empty array. Add `"minItems": 1` to both.

### N2. `idea_node_v1.schema.json` — `eval_info` allows `"type": ["object", "null"]` but `grounding_audit` same pattern — consider making `required` fields within them actually required when present

Currently if `eval_info` is a non-null object, `fix_suggestions` and `failure_modes` are still optional (only declared as `properties`, not `required`). This means an evaluator can return `eval_info: {}` — technically valid but useless. Use `if/then`:

```json
"eval_info": {
  "if": { "type": "object" },
  "then": { "required": ["fix_suggestions", "failure_modes"] }
}
```

Same for `grounding_audit` — when present and non-null, `status` and `timestamp` should be required.

### N3. No `campaign_id` on `IdeaNode` schema

The spec says `idea_candidates_v1.jsonl` lines represent nodes, and `idea.list` filters by `campaign_id`. But `IdeaNode` has no `campaign_id` field. Either add it or document that campaign membership is extrinsic (maintained by the store). If extrinsic, the JSONL format needs a container/header convention.

### N4. `operator_trace.inputs` and `operator_trace.params` are `{"type": "object"}` — consider at least declaring expected keys per operator family

This is acceptable for v0.2 if you add an `operator_family` field to `IdeaNode` (in addition to `operator_id`) so that downstream tooling can dispatch to family-specific sub-schemas. Currently `operator_family` is mentioned in §3.1's conceptual interface but absent from the actual schema.

### N5. `degradation_order[]` (§3.3) is not represented in any schema or RPC param

The Budget Circuit Breaker's degradation order is a design-time or campaign-init-time parameter, but it's not in the `campaign.init` budget schema. Add it to the budget sub-schema when you flesh out B2.

### N6. `idea.promote` result schema is opaque

Should return at minimum `{handoff_artifact_ref: string, grounding_audit_summary: object}` so the adapter can write a proper `idea_handoff_c2_v1.json`.

### N7. No versioning mechanism for schema evolution

The `$id` URIs contain `v1` but there's no `schema_version` field in the actual data objects, nor any OpenRPC `x-schema-version` extension. When you ship v2, consumers won't know which version a given artifact conforms to. Add a `"schema_version": {"const": "1.0.0"}` required field to each root schema.

### N8. Error codes could collide with JSON-RPC reserved range

JSON-RPC 2.0 reserves `-32000` to `-32099` for implementation-defined server errors. Your codes (`-32001` through `-32011`) are in this range, which is fine, but document that you're intentionally using the implementation-defined sub-range and maintain a registry to avoid collisions as methods grow.

### N9. `search.step` `n_steps` param marked `"required": false` — incorrect OpenRPC syntax

In OpenRPC, param requiredness is expressed as `"required": true/false` at the param level. The current placement is correct syntactically, but the default for OpenRPC params is **required** unless explicitly set to false. Verify that your codegen handles this. Also, default value for `n_steps` should be declared (e.g., `"default": 1`).

### N10. Folklore risk score declared in §4.2.1 but absent from all schemas

`folklore_risk_score ∈ [0,1]` is mentioned in the grounding audit gate but is not in `grounding_audit`, `eval_info`, or `IdeaCard`. Add `"folklore_risk_score": {"type": "number", "minimum": 0, "maximum": 1}` to `grounding_audit`.

---

## Real-research fit

**Strengths:**
1. The operator taxonomy (§3.1) maps well to actual HEP theory research workflows. `AnomalyAbduction` → BSM model building from anomalies, `SymmetryOperator` → standard gauge theory extensions, `LimitExplorer` → effective field theory matching. These are real moves theorists make.
2. The `required_observables` + `minimal_compute_plan` fields in `IdeaCard` force concreteness. A real HEP idea like "resolve the muon g-2 anomaly via a light Z'" can be validated: observables = {Δa_μ, LHC dilepton bounds, neutrino trident}, compute plan = {one-loop calculation, parameter scan, exclusion fit}.
3. The claim-level provenance with `evidence_uris` pointing to INSPIRE records is exactly right for HEP — this community already has excellent bibliographic infrastructure.
4. The grounding audit gate preventing phantom citations addresses a real and severe LLM failure mode in scientific contexts.

**Gaps for real use:**
1. **Experimental constraint checking is underspecified.** For HEP-ph, a huge fraction of idea viability depends on whether existing collider/precision/cosmological bounds already exclude the parameter space. The `feasibility_estimators` DomainPack slot (§7.5) needs to be fleshed out: at minimum, a `constraints_check` step in the grounding audit that queries HEPData/LHC bounds and flags tension.
2. **Collaboration with existing calculation infrastructure.** The `method_compiler` (§7.6) maps IdeaCard → C2, but a real HEP workflow often needs to check "is this calculable with existing tools (FeynCalc, MadGraph, etc.) or does it require new model file generation?" The `tool_hint` field in `minimal_compute_plan` is good but optional; consider making it required for `estimated_difficulty != "straightforward"`.
3. **Temporal dynamics of anomalies.** HEP anomalies appear and disappear as data accumulates (cf. the 750 GeV diphoton, muon g-2 lattice tension). Seeds based on anomalies need a `status` field (active/weakened/resolved) and a mechanism to invalidate downstream ideas when the motivating anomaly is resolved.

---

## Robustness & safety

### Evidence-first integrity

1. **Hallucination mitigation is structurally sound** — the two-phase Explain→Formalize pipeline plus grounding audit gate is the right architecture. However, the audit gate's *implementation* is unspecified: who runs it? Is it an LLM call (turtles all the way down) or a deterministic checker? For `URI resolvable` and `data consistency`, these must be deterministic (HTTP HEAD + numerical comparison). For `folklore pre-screening`, an LLM call is acceptable but must be logged.

2. **The `prompt_hash` and `prompt_snapshot_hash` fields are excellent** for reproducibility. But there's no specification for *where* prompt snapshots are stored. Hash without retrievable content = irreproducible. Add a `prompt_snapshots/` artifact directory convention or a `prompt_snapshot_uri` field.

3. **Clean-room evaluation (§6.1.1)** is correctly specified but the enforcement mechanism is absent from the RPC. `eval.run`'s `evaluator_config` is opaque — it should at minimum declare `{"clean_room": bool, "debate_threshold": number, "evaluator_models": string[]}` so the contract is testable.

### Budget safety

4. **Circuit breaker is well-designed** but the `budget_exhausted` error (-32001) is only on `search.step` and `eval.run`. It should also be on `campaign.init` (what if the requested budget exceeds system limits?) and `rank.compute` (Elo tournaments can be expensive with many ideas).

5. **No rate limiting / cost-per-step tracking in the RPC.** The `search.step` result should always include `cost_this_step` and `budget_remaining` so the adapter can make informed decisions without polling `campaign.status`.

### Failure modes

6. **What happens when grounding audit partially fails?** The schema allows `"status": "partial"` but there's no policy for what to do with partial audits. Can a partial-pass idea be promoted? The spec should declare: partial → which failures are blocking vs. advisory, or simply: partial is treated as fail for promotion but the idea remains in the search space for refinement.

7. **No idempotency guarantees on RPC methods.** `search.step` has side effects (creates nodes, consumes budget). If the transport drops the response, does the caller retry? This risks double-spending budget. Add an `idempotency_key` param or document that steps are append-only and safe to re-read via `idea.list`.

---

## Specific patch suggestions

### Patch 1: `schemas/idea_core_rpc_v1.openrpc.json` — Fix `$ref` resolution and add component schemas

**File:** `schemas/idea_core_rpc_v1.openrpc.json`

**What to change:** Add a `components` block and fix all `$ref` values.

```json
{
  "openrpc": "1.2.6",
  "info": { "..." : "..." },
  "methods": [ "..." ],
  "components": {
    "schemas": {
      "IdeaNode": { "$ref": "https://idea-generator/schemas/idea_node_v1.schema.json" },
      "IdeaCard": { "$ref": "https://idea-generator/schemas/idea_card_v1.schema.json" },
      "RationaleDraft": { "$ref": "https://idea-generator/schemas/rationale_draft_v1.schema.json" },
      "Budget": {
        "type": "object",
        "required": ["max_tokens", "max_cost_usd", "max_wall_clock_s"],
        "properties": {
          "max_tokens": { "type": "integer", "minimum": 1 },
          "max_cost_usd": { "type": "number", "minimum": 0 },
          "max_wall_clock_s": { "type": "number", "minimum": 0 },
          "degradation_order": {
            "type": "array",
            "items": { "enum": ["reduce_eval_rounds", "reduce_islands", "disable_cross_domain_operators", "reduce_population", "early_stop"] }
          }
        },
        "additionalProperties": false
      },
      "CampaignCharter": {
        "type": "object",
        "required": ["domain", "scope", "approval_gate_ref"],
        "properties": {
          "domain": { "type": "string", "enum": ["hep-ph", "hep-th", "nucl-th", "cond-mat", "astro-ph", "math-ph"] },
          "scope": { "type": "string", "minLength": 10 },
          "approval_gate_ref": { "type": "string" },
          "constraints": { "type": "array", "items": { "type": "string" } }
        },
        "additionalProperties": false
      },
      "IslandState": {
        "type": "object",
        "required": ["island_id", "state", "population_size"],
        "properties": {
          "island_id": { "type": "string" },
          "state": { "enum": ["SEEDING", "EXPLORING", "CONVERGING", "STAGNANT", "REPOPULATED", "EXHAUSTED"] },
          "population_size": { "type": "integer", "minimum": 0 },
          "stagnation_counter": { "type": "integer", "minimum": 0 },
          "best_score": { "type": ["number", "null"] }
        },
        "additionalProperties": false
      },
      "BudgetSnapshot": {
        "type": "object",
        "required": ["tokens_used", "tokens_remaining", "cost_usd_used", "cost_usd_remaining", "wall_clock_s_elapsed"],
        "properties": {
          "tokens_used": { "type": "integer" },
          "tokens_remaining": { "type": "integer" },
          "cost_usd_used": { "type": "number" },
          "cost_usd_remaining": { "type": "number" },
          "wall_clock_s_elapsed": { "type": "number" }
        },
        "additionalProperties": false
      },
      "SearchStepResult": {
        "type": "object",
        "required": ["new_node_ids", "island_states", "budget_snapshot"],
        "properties": {
          "new_node_ids": { "type": "array", "items": { "type": "string", "format": "uuid" } },
          "island_states": { "type": "array", "items": { "$ref": "#/components/schemas/IslandState" } },
          "budget_snapshot": { "$ref": "#/components/schemas/BudgetSnapshot" },
          "early_stopped": { "type": "boolean", "default": false },
          "early_stop_reason": { "type": "string" }
        },
        "additionalProperties": false
      },
      "RankingResult": {
        "type": "object",
        "required": ["method", "ranked_ideas"],
        "properties": {
          "method": { "enum": ["pareto", "elo"] },
          "ranked_ideas": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["idea_id", "rank", "scores"],
              "properties": {
                "idea_id": { "type": "string", "format": "uuid" },
                "rank": { "type": "integer", "minimum": 1 },
                "scores": { "type": "object" },
                "pareto_front": { "type": "boolean" },
                "elo_rating": { "type": "number" }
              }
            }
          }
        },
        "additionalProperties": false
      },
      "PromotionResult": {
        "type": "object",
        "required": ["handoff_artifact_ref", "grounding_audit_summary"],
        "properties": {
          "handoff_artifact_ref": { "type": "string" },
          "grounding_audit_summary": {
            "type": "object",
            "required": ["status", "uri_resolution_pass", "data_consistency_pass", "inference_transparency_pass"],
            "properties": {
              "status": { "enum": ["pass", "fail"] },
              "uri_resolution_pass": { "type": "boolean" },
              "data_consistency_pass": { "type": "boolean" },
              "inference_transparency_pass": { "type": "boolean" },
              "folklore_risk_score": { "type": "number", "minimum": 0, "maximum": 1 }
            }
          }
        }
      }
    },
    "errors": {
      "BudgetExhausted": { "code": -32001, "message": "budget_exhausted" },
      "SchemaValidationFailed": { "code": -32002, "message": "schema_validation_failed" },
      "CampaignNotFound": { "code": -32003, "message": "campaign_not_found" },
      "IdeaNotFound": { "code": -32004, "message": "idea_not_found" },
      "InvalidCharter": { "code": -32010, "message": "invalid_charter" },
      "GroundingAuditFailed": { "code": -32011, "message": "grounding_audit_failed" },
      "FormalismNotInRegistry": { "code": -32012, "message": "formalism_not_in_registry" }
    }
  }
}
```

Then update method references: `campaign.init`'s `budget` param → `{"$ref": "#/components/schemas/Budget"}`, `charter` → `{"$ref": "#/components/schemas/CampaignCharter"}`, `search.step` result → `{"$ref": "#/components/schemas/SearchStepResult"}`, etc.

---

### Patch 2: `schemas/idea_card_v1.schema.json` — Fix `evidence_uris` conditional requirement

**File:** `schemas/idea_card_v1.schema.json`

**What to change:** In the `claims` items schema, replace the top-level `"required": [..., "evidence_uris"]` with conditional requirements:

```json
"claims": {
  "type": "array",
  "minItems": 1,
  "items": {
    "type": "object",
    "required": ["claim_text", "support_type"],
    "properties": {
      "claim_text": { "type": "string", "minLength": 1 },
      "support_type": {
        "enum": ["literature", "data", "calculation", "llm_inference", "assumption", "expert_consensus"]
      },
      "evidence_uris": { "type": "array", "items": { "type": "string", "format": "uri" } },
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
      "verification_plan": { "type": "string" },
      "verification_status": { "enum": ["verified", "unverified", "falsified"] },
      "verification_notes": { "type": "string" }
    },
    "allOf": [
      {
        "if": { "properties": { "support_type": { "enum": ["literature", "data", "calculation", "expert_consensus"] } } },
        "then": { "required": ["evidence_uris"], "properties": { "evidence_uris": { "minItems": 1 } } }
      },
      {
        "if": { "properties": { "support_type": { "enum": ["llm_inference", "assumption"] } } },
        "then": { "required": ["verification_plan"] }
      }
    ],
    "additionalProperties": false
  }
}
```

---

### Patch 3: `schemas/idea_node_v1.schema.json` — Add missing fields

**File:** `schemas/idea_node_v1.schema.json`

**What to change:** Add `campaign_id`, `operator_family`, `schema_version`, and `folklore_risk_score` in grounding_audit. Also enforce non-null sub-objects have required fields.

```json
{
  "required": [
    "idea_id", "node_id", "parent_node_ids", "island_id",
    "operator_id", "operator_family", "origin", "operator_trace",
    "rationale_draft", "schema_version"
  ],
  "properties": {
    "schema_version": { "const": "1.0.0" },
    "campaign_id": { "type": "string" },
    "operator_family": {
      "type": "string",
      "enum": [
        "AnomalyAbduction", "AssumptionInversion", "SymmetryOperator",
        "LimitExplorer", "CrossDomainAnalogy", "CombinatorialSynthesis",
        "ProtectiveBeltPatch", "RepresentationShift", "custom"
      ]
    },
    "grounding_audit": {
      "oneOf": [
        { "type": "null" },
        {
          "type": "object",
          "required": ["status", "timestamp"],
          "properties": {
            "status": { "enum": ["pass", "fail", "partial"] },
            "failures": { "type": "array", "items": { "type": "string" } },
            "folklore_risk_score": { "type": "number", "minimum": 0, "maximum": 1 },
            "timestamp": { "type": "string", "format": "date-time" }
          },
          "additionalProperties": false
        }
      ]
    }
  }
}
```

---

### Patch 4: `schemas/rationale_draft_v1.schema.json` — Add `minItems`

**File:** `schemas/rationale_draft_v1.schema.json`

**What to change:**
```json
"risks": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
"kill_criteria": { "type": "array", "minItems": 1, "maxItems": 5, "items": { "type": "string", "minLength": 1 } }
```

---

### Patch 5: `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Add §4.2.2 and §3.3.1

**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md`

**What to change — Add after §4.2.1:**

```markdown
#### 4.2.2 Partial Grounding Audit Policy

- `status = "partial"` means ≥1 check passed but ≥1 failed.
- **Promotion rule:** `partial` is treated as `fail` for `idea.promote`. The idea remains in the search space and evaluators SHOULD emit `fix_suggestions` targeting the failed checks.
- **Advisory failures** (folklore_risk above threshold but below hard block): flagged for human review but do not block continued search iteration.
```

**What to change — Add after §3.3 Distributor:**

```markdown
#### 3.3.1 Idempotency and Retry Safety

- `search.step` is **not idempotent**: each call consumes budget and creates nodes. The result includes `step_id` (UUID) for deduplication.
- If the adapter does not receive a response (transport failure), it MUST call `campaign.status` to discover whether the step was committed, before retrying.
- `idea.get`, `idea.list`, `campaign.status`, `rank.compute` are read-only and safe to retry.
- `eval.run` is idempotent if called with the same `idea_ids` + `evaluator_config` (results are cached by content hash).
```

---

### Patch 6: New file `schemas/formalism_registry_v1.schema.json`

**New file:** `schemas/formalism_registry_v1.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://idea-generator/schemas/formalism_registry_v1.schema.json",
  "title": "Formalism Registry v1",
  "description": "DomainPack-provided mapping from formalism_id to C2 compiler metadata. IdeaCard.candidate_formalisms must reference entries in this registry.",
  "type": "object",
  "required": ["domain", "formalisms"],
  "properties": {
    "domain": { "type": "string" },
    "formalisms": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["c2_schema_ref", "description"],
        "properties": {
          "c2_schema_ref": { "type": "string", "format": "uri" },
          "description": { "type": "string" },
          "validator": { "type": "string", "description": "Module path or script for validating IdeaCard against this formalism." },
          "compiler": { "type": "string", "description": "Module path or script for compiling IdeaCard to C2 handoff." },
          "required_observables_hint": { "type": "array", "items": { "type": "string" } },
          "tool_requirements": { "type": "array", "items": { "type": "string" } }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

This makes the §7 requirement concrete: `candidate_formalisms[]` entries are validated against `Object.keys(registry.formalisms)` at `idea.promote` time.
